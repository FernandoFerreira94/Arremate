const WINDOW_MS = 60_000;
const LIMITS = { login: 10, mutation: 60, catalog: 30, audit: 30 } as const;

export type RateBucket = keyof typeof LIMITS;

export class RateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();
  private readonly sse = new Map<string, number>();

  constructor(private readonly now: () => number) {}

  consume(bucket: RateBucket, key: string): void {
    const id = `${bucket}:${key}`;
    const now = this.now();
    const current = this.hits.get(id);
    if (!current || now >= current.resetAt) {
      this.hits.set(id, { count: 1, resetAt: now + WINDOW_MS });
      return;
    }
    if (current.count >= LIMITS[bucket]) throw new Error("LIMITE_EXCEDIDO");
    current.count += 1;
  }

  tryAcquireSse(key: string): boolean {
    const count = this.sse.get(key) ?? 0;
    if (count >= 3) return false;
    this.sse.set(key, count + 1);
    return true;
  }

  releaseSse(key: string): void {
    const count = this.sse.get(key) ?? 0;
    if (count <= 1) this.sse.delete(key);
    else this.sse.set(key, count - 1);
  }
}
