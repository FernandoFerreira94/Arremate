/**
 * O E2E sobe API e web próprias em portas separadas, apontadas para o banco de TESTE (5463),
 * para não encher a vitrine de desenvolvimento (5462, API 4300, web 3300).
 */
export const E2E_WEB_PORT = 3310;
export const E2E_API_PORT = 4310;
export const E2E_BASE = `http://127.0.0.1:${E2E_WEB_PORT}`;
export const E2E_API = `http://127.0.0.1:${E2E_API_PORT}`;

/** Só aceita o banco local de teste: host de loopback, porta 5463 e banco casadeleilao_test. */
export function e2eDatabaseUrl(raw: string | undefined): string {
  if (!raw) throw new Error("TEST_DATABASE_URL ausente para o E2E");
  const url = new URL(raw);
  if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "5463" || url.pathname !== "/casadeleilao_test") {
    throw new Error("E2E só roda no banco local de teste (5463/casadeleilao_test)");
  }
  return raw;
}
