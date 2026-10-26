// Provisiona o papel de runtime no banco hospedado, com a URL do owner (DIRECT_URL).
// Equivale ao infra/postgres/init-app-user.sh do Compose; idempotente.
//   node infra/deploy/bootstrap-db.cjs before   -> cria auction_app antes das migrations
//   node infra/deploy/bootstrap-db.cjs after    -> tira de auction_app o acesso a _prisma_migrations
const { Client } = require("pg");

async function main() {
  const phase = process.argv[2];
  const url = process.env.DIRECT_URL;
  const appPassword = process.env.APP_DATABASE_PASSWORD;
  if (!url) throw new Error("DIRECT_URL ausente.");
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    if (phase === "before") {
      if (!appPassword) throw new Error("APP_DATABASE_PASSWORD ausente.");
      const exists = await client.query("SELECT 1 FROM pg_roles WHERE rolname = 'auction_app'");
      const verb = exists.rowCount ? "ALTER" : "CREATE";
      // Senha como literal escapado pelo próprio PostgreSQL; nunca vai para log.
      const { rows } = await client.query("SELECT quote_literal($1) AS pw", [appPassword]);
      await client.query(`${verb} ROLE auction_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD ${rows[0].pw}`);
      await client.query("REVOKE ALL ON SCHEMA public FROM PUBLIC");
      await client.query("GRANT USAGE ON SCHEMA public TO auction_app");
    } else if (phase === "after") {
      await client.query("REVOKE ALL PRIVILEGES ON TABLE public._prisma_migrations FROM auction_app");
    } else {
      throw new Error("Use: before | after");
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Falha no bootstrap do banco.");
  process.exit(1);
});
