# Deploy da demo: site (Next) e API (Nest) no mesmo container.
# O site encaminha /api para a API em 127.0.0.1:4300, a mesma topologia do E2E:
# a API só confia no IP repassado pelo salto local (D26, M1).
FROM node:24.22.1-bookworm-slim

ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

COPY package.json package-lock.json .npmrc ./
COPY front-end/package.json front-end/package.json
COPY back-end/package.json back-end/package.json
# Dependências de desenvolvimento ficam: o seed e o Prisma CLI rodam dentro do container.
RUN npm ci

COPY . .
RUN npm run build --workspace back-end && npm run build --workspace front-end

ENV NODE_ENV=production \
    API_HOST=127.0.0.1 \
    API_PORT=4300 \
    AUDIT_WITNESS_DIR=/data/witness \
    MEDIA_DIR=/data/media

# /data deve ser um volume persistente montado pela hospedagem: testemunha da auditoria e imagens
# precisam sobreviver a restart e deploy (sem VOLUME aqui; o Railway não aceita a instrução).
EXPOSE 3000
CMD ["sh", "infra/deploy/start.sh"]
