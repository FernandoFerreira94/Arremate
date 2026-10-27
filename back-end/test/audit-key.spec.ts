import "reflect-metadata";
import { auditKeyFromEnv } from "../src/app";

describe("chave da auditoria no boot (auditoria item 5)", () => {
  const logger = () => ({ error: jest.fn() });

  it("aceita 32+ bytes em hexadecimal sem avisar", () => {
    const log = logger();
    const key = auditKeyFromEnv({ AUDIT_HMAC_KEY: "ab".repeat(32) }, log);
    expect(key?.byteLength).toBe(32);
    expect(log.error).not.toHaveBeenCalled();
  });

  it("avisa com erro claro quando falta ou é inválida, sem expor o valor", () => {
    const missing = logger();
    expect(auditKeyFromEnv({}, missing)).toBeNull();
    expect(missing.error).toHaveBeenCalledWith(expect.stringContaining("AUDIT_HMAC_KEY ausente"));

    const invalid = logger();
    expect(auditKeyFromEnv({ AUDIT_HMAC_KEY: "segredo-curto" }, invalid)).toBeNull();
    expect(invalid.error).toHaveBeenCalledWith(expect.stringContaining("AUDIT_HMAC_KEY inválida"));
    expect(invalid.error.mock.calls[0][0]).not.toContain("segredo-curto");
  });
});
