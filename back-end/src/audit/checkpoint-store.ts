import { randomUUID } from "node:crypto";
import { mkdir, open, readdir, readFile, rename, rm } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { encodeCheckpoint, parseCheckpoint } from "./audit-chain";
import type { Checkpoint } from "./audit.types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type FailStage = "write" | "fsync" | "rename";
export type DirectorySync = "pending" | "synced" | "unsupported";

export interface CheckpointStore {
  read(lotId: string): Promise<Checkpoint | null>;
  readPending(lotId: string): Promise<Checkpoint | null>;
  writePending(checkpoint: Checkpoint): Promise<void>;
  clearPending(lotId: string): Promise<void>;
  advance(expectedRevision: number, next: Checkpoint): Promise<void>;
  pendingLots?(): Promise<string[]>;
}

export class FileCheckpointStore implements CheckpointStore {
  failNextAdvance: FailStage | null = null;
  directorySync: DirectorySync = "pending";
  private readonly root: string;
  private readonly tails = new Map<string, Promise<void>>();

  constructor(root: string) {
    this.root = resolve(root);
  }

  async read(lotId: string): Promise<Checkpoint | null> {
    return this.readAt(this.file(lotId, "checkpoint"));
  }

  async readPending(lotId: string): Promise<Checkpoint | null> {
    return this.readAt(this.file(lotId, "pending"));
  }

  async writePending(checkpoint: Checkpoint): Promise<void> {
    await this.exclusive(checkpoint.lotId, async () => {
      const target = this.file(checkpoint.lotId, "pending");
      if (await this.readAt(target)) {
        throw new Error("intenção já existe");
      }
      await this.persist(target, encodeCheckpoint(checkpoint), "pending");
    });
  }

  /** Lotes com intenção pendente (testemunha não confirmada); base da nova tentativa no startup. */
  async pendingLots(): Promise<string[]> {
    const entries = await readdir(this.root, { withFileTypes: true }).catch(() => []);
    const lots: string[] = [];
    for (const entry of entries) {
      if (entry.isDirectory() && UUID.test(entry.name) && (await this.readAt(this.file(entry.name, "pending")).catch(() => null))) lots.push(entry.name);
    }
    return lots;
  }

  async clearPending(lotId: string): Promise<void> {
    await this.exclusive(lotId, async () => {
      await rm(this.file(lotId, "pending"), { force: true });
    });
  }

  async advance(expectedRevision: number, next: Checkpoint): Promise<void> {
    await this.exclusive(next.lotId, async () => {
      const current = await this.read(next.lotId);
      if (!current) {
        if (expectedRevision !== 0 || next.revision !== 0) {
          throw new Error("revisão divergente");
        }
      } else if (next.revision <= current.revision) {
        throw new Error("revisão recuada");
      } else if (current.revision !== expectedRevision || next.revision !== expectedRevision + 1) {
        throw new Error("revisão divergente");
      }
      await this.persist(this.file(next.lotId, "checkpoint"), encodeCheckpoint(next), "committed");
    });
  }

  private file(lotId: string, name: "checkpoint" | "pending"): string {
    if (!UUID.test(lotId)) {
      throw new Error("lotId inválido");
    }
    const directory = resolve(this.root, lotId);
    const relativePath = relative(this.root, directory);
    if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
      throw new Error("lotId inválido");
    }
    return join(directory, name);
  }

  private async readAt(target: string): Promise<Checkpoint | null> {
    try {
      return parseCheckpoint(await readFile(target));
    } catch (error) {
      if (errorCode(error) === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  private async persist(target: string, bytes: Buffer, kind: "pending" | "committed"): Promise<void> {
    const fail = kind === "committed" ? this.failNextAdvance : null;
    if (fail) {
      this.failNextAdvance = null;
    }
    await mkdir(resolve(target, ".."), { recursive: true });
    const temporary = `${target}.${randomUUID()}.tmp`;
    const handle = await open(temporary, "w", 0o600);
    try {
      if (fail === "write") {
        throw new Error("checkpoint write falhou");
      }
      const written = await handle.write(bytes);
      if (written.bytesWritten !== bytes.length) {
        throw new Error("checkpoint write falhou");
      }
      if (fail === "fsync") {
        throw new Error("checkpoint fsync falhou");
      }
      await handle.sync();
    } catch (error) {
      await handle.close();
      await rm(temporary, { force: true });
      throw error;
    }
    await handle.close();
    if (fail === "rename") {
      await rm(temporary, { force: true });
      throw new Error("checkpoint rename falhou");
    }
    await replaceFile(temporary, target);
    this.directorySync = await syncDirectory(resolve(target, ".."));
  }

  private async exclusive<T>(lotId: string, action: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(lotId) ?? Promise.resolve();
    let release = (): void => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = previous.then(() => gate);
    this.tails.set(lotId, tail);
    await previous;
    try {
      return await action();
    } finally {
      release();
      // Auditoria item 14: sem ninguém na fila, a entrada sai do mapa (não cresce um por lote para sempre).
      if (this.tails.get(lotId) === tail) this.tails.delete(lotId);
    }
  }
}

async function replaceFile(temporary: string, target: string): Promise<void> {
  try {
    await rename(temporary, target);
  } catch (error) {
    const code = errorCode(error);
    if (code !== "EPERM" && code !== "EEXIST") {
      throw error;
    }
    const backup = `${target}.replaced`;
    await rm(backup, { force: true });
    await rename(target, backup);
    try {
      await rename(temporary, target);
    } catch (replaceError) {
      await rename(backup, target);
      throw replaceError;
    }
    await rm(backup, { force: true });
  }
}

async function syncDirectory(directory: string): Promise<Exclude<DirectorySync, "pending">> {
  try {
    const handle = await open(directory, "r");
    try {
      await handle.sync();
      return "synced";
    } finally {
      await handle.close();
    }
  } catch (error) {
    const code = errorCode(error);
    if (code === "EPERM" || code === "EISDIR" || code === "EINVAL" || code === "ENOTSUP" || code === "EACCES" || code === "EBADF") {
      return "unsupported";
    }
    throw error;
  }
}

function errorCode(error: unknown): string {
  return typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
}
