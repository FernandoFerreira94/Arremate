import { createHmac, timingSafeEqual } from "node:crypto";

export function csrfTokenForSession(sessionToken: string): string {
  return createHmac("sha256", sessionToken).update("csrf-v1").digest("base64url");
}

export function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  const size = Math.max(a.length, b.length, 1);
  const x = Buffer.alloc(size);
  const y = Buffer.alloc(size);
  a.copy(x);
  b.copy(y);
  return timingSafeEqual(x, y) && a.length === b.length;
}
