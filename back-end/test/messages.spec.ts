import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { bidMessage, depositMessage, ERROR_MESSAGES, formatBrl, withMessage } from "../src/common/messages";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : path.endsWith(".ts") ? [path] : [];
  });
}

describe("mensagens (B1/B2)", () => {
  it("todo código de ApiException usado em src/ existe no mapa com o mesmo status", () => {
    const used = new Map<string, Set<number>>();
    for (const file of files(join(__dirname, "../src"))) {
      for (const match of readFileSync(file, "utf8").matchAll(/ApiException\((\d{3}), "([A-Z_]+)"\)/g)) {
        const set = used.get(match[2] ?? "") ?? new Set<number>();
        set.add(Number(match[1]));
        used.set(match[2] ?? "", set);
      }
    }
    expect(used.size).toBeGreaterThan(20);
    for (const [code, statuses] of used) {
      expect({ code, known: Boolean(ERROR_MESSAGES[code]) }).toEqual({ code, known: true });
      for (const status of statuses) expect({ code, status }).toEqual({ code, status: ERROR_MESSAGES[code]?.status });
    }
  });

  it("formata valores em reais sem Intl", () => {
    expect(formatBrl("100")).toBe("R$ 1,00");
    expect(formatBrl("5")).toBe("R$ 0,05");
    expect(formatBrl("123456789")).toBe("R$ 1.234.567,89");
    expect(bidMessage("150000")).toBe("Lance de R$ 1.500,00 registrado.");
    expect(depositMessage("20000")).toBe("Depósito de R$ 200,00 adicionado à carteira.");
  });

  it("withMessage só acrescenta o campo", () => {
    expect(withMessage({ a: 1 }, "ok")).toEqual({ a: 1, message: "ok" });
  });
});
