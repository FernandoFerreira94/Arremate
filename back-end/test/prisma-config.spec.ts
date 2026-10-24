import type prismaConfig from "../prisma.config";

jest.mock("dotenv", () => ({ config: jest.fn() }));

const runtimeUrl = "postgresql://auction_app@runtime.invalid:5432/arremate";
const migrationUrl = "postgresql://migration_owner@direct.invalid:5432/arremate";

function loadConfig(): typeof prismaConfig {
  return jest.requireActual<typeof import("../prisma.config")>("../prisma.config").default;
}

describe("Conexão do Prisma CLI", () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousDirectUrl = process.env.DIRECT_URL;

  beforeEach(() => {
    jest.resetModules();
    process.env.DATABASE_URL = runtimeUrl;
    delete process.env.DIRECT_URL;
  });

  afterAll(() => {
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
    if (previousDirectUrl === undefined) delete process.env.DIRECT_URL;
    else process.env.DIRECT_URL = previousDirectUrl;
    jest.resetModules();
  });

  it("prefere DIRECT_URL sem substituir a conexão runtime", () => {
    process.env.DIRECT_URL = migrationUrl;
    expect(loadConfig().datasource?.url).toBe(migrationUrl);
    expect(process.env.DATABASE_URL).toBe(runtimeUrl);
  });

  it("funciona no runner de migration sem DATABASE_URL", () => {
    delete process.env.DATABASE_URL;
    process.env.DIRECT_URL = migrationUrl;
    expect(loadConfig().datasource?.url).toBe(migrationUrl);
  });

  it.each([undefined, "", "   "])("mantém o fallback local com DIRECT_URL=%s", (directUrl) => {
    if (directUrl === undefined) delete process.env.DIRECT_URL;
    else process.env.DIRECT_URL = directUrl;
    expect(loadConfig().datasource?.url).toBe(runtimeUrl);
  });

  it("falha sem inventar conexão quando nenhuma URL foi definida", () => {
    delete process.env.DATABASE_URL;
    expect(() => loadConfig()).toThrow("DATABASE_URL");
  });
});
