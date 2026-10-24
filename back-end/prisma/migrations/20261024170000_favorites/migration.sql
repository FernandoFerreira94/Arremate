-- D21 (Fernando, 24/10/2026 17:00): favoritos (R11). Sem FK para lots: ver comentário no schema.
CREATE TABLE "favorites" (
    "user_id" UUID NOT NULL,
    "lot_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("user_id","lot_id")
);

CREATE INDEX "favorites_user_id_created_at_idx" ON "favorites"("user_id", "created_at");

ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Runtime role: só o DML necessário.
GRANT SELECT, INSERT, DELETE ON TABLE "favorites" TO auction_app;
