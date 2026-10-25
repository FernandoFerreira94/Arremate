-- D21 (Fernando, 25/10/2026): "Avise-me quando abrir" e notificações in-app. Sem FK para lots (ver schema).
CREATE TABLE "lot_watches" (
    "user_id" UUID NOT NULL,
    "lot_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lot_watches_pkey" PRIMARY KEY ("user_id","lot_id")
);

CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "lot_id" UUID NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'LOT_OPENED',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMPTZ(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lot_watches_lot_id_idx" ON "lot_watches"("lot_id");
CREATE UNIQUE INDEX "notifications_user_id_lot_id_kind_key" ON "notifications"("user_id", "lot_id", "kind");
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

ALTER TABLE "lot_watches" ADD CONSTRAINT "lot_watches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Runtime role: só o DML necessário.
GRANT SELECT, INSERT, DELETE ON TABLE "lot_watches" TO auction_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "notifications" TO auction_app;
