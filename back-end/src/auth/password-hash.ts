import { hash, verify, Algorithm } from "@node-rs/argon2";

const options = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

let dummyHash: Promise<string> | undefined;

export function hashPassword(password: string): Promise<string> {
  return hash(password, options);
}

export function verifyPassword(encoded: string, password: string): Promise<boolean> {
  return verify(encoded, password).catch(() => false);
}

export function dummyPasswordHash(): Promise<string> {
  dummyHash ??= hash("placeholder-not-a-user-password", options);
  return dummyHash;
}
