import { generateKeyPairSync, sign } from "node:crypto";
import { verifyGoogleIdToken } from "../src/auth/google-token";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "test-key", alg: "RS256", use: "sig" };
const now = Math.floor(Date.now()/1000);
function token(claims: object, key = privateKey) {
  const head = Buffer.from(JSON.stringify({ alg: "RS256", kid: "test-key" })).toString("base64url");
  const body = Buffer.from(JSON.stringify({ iss: "https://accounts.google.com", aud: "test-client", sub: "123", email: "ana@example.com", email_verified: true, nonce: "nonce-test", exp: now+60, iat: now, name: "Ana", ...claims })).toString("base64url");
  const payload = `${head}.${body}`;
  return `${payload}.${sign("RSA-SHA256", Buffer.from(payload), key).toString("base64url")}`;
}
it("valida assinatura/claims Google sem aceitar identidade forjada", () => {
  expect(verifyGoogleIdToken(token({}), { keys: [jwk] }, "test-client", "nonce-test", now)).toMatchObject({ subject: "123", email: "ana@example.com", name: "Ana" });
  for (const claims of [{ iss: "https://evil" }, { aud: "evil" }, { aud: ["test-client", "other"], azp: "other" }, { nonce: "wrong" }, { exp: now-1 }, { iat: now+600 }, { email_verified: false }, { sub: "" }]) {
    expect(() => verifyGoogleIdToken(token(claims), { keys: [jwk] }, "test-client", "nonce-test", now)).toThrow();
  }
  const other = generateKeyPairSync("rsa", { modulusLength: 2048 });
  expect(() => verifyGoogleIdToken(token({}, other.privateKey), { keys: [jwk] }, "test-client", "nonce-test", now)).toThrow();
  expect(() => verifyGoogleIdToken(token({}), { keys: [{ ...jwk, kid: "other" }] }, "test-client", "nonce-test", now)).toThrow();
});
