import { describe, expect, it } from "vitest";
import { bidShortcuts, clockOffset, remainingMs, formatCountdown, rankByBidder, insufficientBalanceMessage, followsMinimum, confirmationHolds, becameOutbid } from "./room-logic";

describe("bidShortcuts", () => {
  it("mínimo, +1 e +2 incrementos sobre o mínimo", () => {
    expect(bidShortcuts("1290000", "50000")).toEqual(["1290000", "1340000", "1390000"]);
  });
});

describe("relógio pelo serverNow", () => {
  it("offset corrige relógio local adiantado; restante nunca negativo", () => {
    const offset = clockOffset("2026-10-23T12:00:00.000Z", Date.parse("2026-10-23T12:00:05.000Z"));
    expect(offset).toBe(-5000);
    expect(remainingMs("2026-10-23T12:01:00.000Z", Date.parse("2026-10-23T12:00:05.000Z"), offset)).toBe(60000);
    expect(remainingMs("2026-10-23T11:00:00.000Z", Date.parse("2026-10-23T12:00:05.000Z"), offset)).toBe(0);
  });
  it("formata h:mm:ss e d h", () => {
    expect(formatCountdown(134_000)).toBe("02:14");
    expect(formatCountdown(7_754_000)).toBe("02:09:14");
    expect(formatCountdown(2 * 86_400_000 + 4 * 3_600_000)).toBe("2 d 4 h");
  });
});

describe("rankByBidder", () => {
  it("um por participante, pelo maior lance, ordenado", () => {
    const rows = rankByBidder([
      { alias: "A", amountCents: "100", sequence: 1, acceptedAt: "" },
      { alias: "B", amountCents: "150", sequence: 2, acceptedAt: "" },
      { alias: "A", amountCents: "200", sequence: 3, acceptedAt: "" },
    ]);
    expect(rows.map((r) => [r.position, r.alias, r.amountCents])).toEqual([[1, "A", "200"], [2, "B", "150"]]);
  });
});

describe("insufficientBalanceMessage (QA MÉDIA 5)", () => {
  it("diz o disponível e quanto falta", () => {
    expect(insufficientBalanceMessage("2130000", "600000")).toBe("Saldo insuficiente: você tem R$ 6.000,00 disponível e faltam R$ 15.300,00 para este lance.");
  });
});

describe("QA N1: confirmação do lance", () => {
  it("vale enquanto o lance atual é o confirmado", () => {
    expect(confirmationHolds("10000", "10000")).toBe(true);
    expect(confirmationHolds("10000", null)).toBe(true);
  });
  it("some quando outro licitante cobre", () => {
    expect(confirmationHolds("10000", "12000")).toBe(false);
  });
});

describe("QA N4: virada para superado", () => {
  it("só de LEADING para OUTBID", () => {
    expect(becameOutbid("LEADING", "OUTBID")).toBe(true);
    expect(becameOutbid(undefined, "OUTBID")).toBe(false);
    expect(becameOutbid("OUTBID", "OUTBID")).toBe(false);
    expect(becameOutbid("OUTBID", "LEADING")).toBe(false);
  });
});

describe("followsMinimum (auditoria item 13)", () => {
  it("acompanha o novo mínimo quando o valor digitado ficou abaixo dele; preserva valor maior", () => {
    expect(followsMinimum("1.000,00", "105000")).toBe(true);
    expect(followsMinimum("", "105000")).toBe(true);
    expect(followsMinimum("2.000,00", "105000")).toBe(false);
  });
});
