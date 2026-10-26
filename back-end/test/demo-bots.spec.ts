import { DEMO_BOT_EMAILS, demoBotConfig, pickBotBids, type BotLot } from "../src/lots/demo-bot-runner";

const config = { maxBidsPerTick: 2, ceilingFactor: 3, maxBotBidsPerLot: 12 };
const lot = (over: Partial<BotLot> = {}): BotLot => ({ id: "l1", initialCents: 10000n, incrementCents: 500n, currentCents: null, leaderId: null, botBids: 0, ...over });

describe("licitantes automáticos (D31)", () => {
  it("desligado por padrão, sem DEMO_BOTS=1 e sempre em NODE_ENV=test", () => {
    expect(demoBotConfig({})).toBe(false);
    expect(demoBotConfig({ DEMO_BOTS: "true" })).toBe(false);
    expect(demoBotConfig({ DEMO_BOTS: "1", NODE_ENV: "test" })).toBe(false);
  });

  it("ligado com DEMO_BOTS=1, com padrões e valores fora da faixa ignorados", () => {
    expect(demoBotConfig({ DEMO_BOTS: "1" })).toEqual({ intervalMs: 15000, maxBidsPerTick: 2, ceilingFactor: 3, maxBotBidsPerLot: 12, emails: DEMO_BOT_EMAILS });
    expect(demoBotConfig({ DEMO_BOTS: "1", DEMO_BOT_INTERVAL_MS: "10", DEMO_BOT_MAX_BIDS: "5", DEMO_BOT_EMAILS: " Robo@X.demo , " })).toMatchObject({ intervalMs: 15000, maxBidsPerTick: 5, emails: ["robo@x.demo"] });
  });

  it("cobre a pessoa que lidera com o mínimo exato e nunca cobre outro robô", () => {
    const bids = pickBotBids([lot({ id: "humano", currentCents: 12000n, leaderId: "pessoa" }), lot({ id: "robo", currentCents: 12000n, leaderId: "b1" })], ["b1", "b2"], config, () => 0);
    expect(bids).toEqual([{ lotId: "humano", botId: "b1", amountCents: 12500n }]);
  });

  it("para no teto (inicial × fator) e no limite de lances de robô por lote", () => {
    expect(pickBotBids([lot({ currentCents: 29600n, leaderId: "pessoa" })], ["b1"], config, () => 0)).toEqual([]);
    expect(pickBotBids([lot({ currentCents: 12000n, leaderId: "pessoa", botBids: 12 })], ["b1"], config, () => 0)).toEqual([]);
  });

  it("respeita o máximo por rodada e só às vezes abre lote sem lance", () => {
    const many = ["a", "b", "c"].map((id) => lot({ id, currentCents: 11000n, leaderId: "pessoa" }));
    expect(pickBotBids(many, ["b1"], config, () => 0)).toHaveLength(2);
    expect(pickBotBids([lot()], ["b1"], config, () => 0.9)).toEqual([]);
    expect(pickBotBids([lot()], ["b1"], config, () => 0.1)).toEqual([{ lotId: "l1", botId: "b1", amountCents: 10000n }]);
    expect(pickBotBids([lot({ leaderId: "pessoa", currentCents: 11000n })], [], config)).toEqual([]);
  });
});
