#!/bin/sh
# Sobe a API e o site no mesmo container (ver Dockerfile). Se um dos dois cair, o container cai
# e a hospedagem reinicia os dois juntos.
set -eu

: "${DATABASE_URL:?Configure DATABASE_URL (papel auction_app, sem DDL)}"
: "${AUDIT_HMAC_KEY:?Configure AUDIT_HMAC_KEY (hex, 32+ bytes)}"
: "${WEB_ORIGIN:?Configure WEB_ORIGIN com a URL pública (https://...)}"

mkdir -p "$AUDIT_WITNESS_DIR" "$MEDIA_DIR"

# Migrations só com a URL do owner, e só quando ela existe (DIRECT_URL nunca chega à API).
if [ -n "${DIRECT_URL:-}" ]; then
  node infra/deploy/bootstrap-db.cjs before
  (cd back-end && npx prisma migrate deploy)
  node infra/deploy/bootstrap-db.cjs after
fi

(cd back-end && env -u DIRECT_URL node dist/main.js) &
api=$!

i=0
until node -e "fetch('http://127.0.0.1:4300/api/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; do
  i=$((i + 1))
  if [ "$i" -ge 60 ]; then echo "API não ficou pronta em 60 s." >&2; exit 1; fi
  sleep 1
done

(cd front-end && SITE_URL="${SITE_URL:-$WEB_ORIGIN}" npx next start --hostname 0.0.0.0 --port "${PORT:-3000}") &
web=$!

# Encerra quando qualquer um dos dois terminar.
while kill -0 "$api" 2>/dev/null && kill -0 "$web" 2>/dev/null; do sleep 2; done
kill "$api" "$web" 2>/dev/null || true
exit 1
