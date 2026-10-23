-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('AUCTIONEER', 'BIDDER');

-- CreateEnum
CREATE TYPE "lot_status" AS ENUM ('PUBLISHED', 'CANCELLED', 'CLOSED_PENDING', 'SETTLED', 'CLOSED_NO_BIDS');

-- CreateEnum
CREATE TYPE "wallet_entry_kind" AS ENUM ('DEPOSIT', 'RESERVE', 'RELEASE', 'SETTLEMENT_DEBIT', 'SETTLEMENT_CREDIT');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "role" "user_role" NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_item_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "attributes" JSONB NOT NULL,
    "credit" TEXT NOT NULL,
    "license" TEXT NOT NULL,
    "media_key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catalog_item_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_id" UUID NOT NULL,
    "snapshot_id" UUID NOT NULL,
    "initial_cents" BIGINT NOT NULL,
    "increment_cents" BIGINT NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "status" "lot_status" NOT NULL DEFAULT 'PUBLISHED',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bids" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lot_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "alias" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "amount_cents" BIGINT NOT NULL,
    "accepted_at" TIMESTAMPTZ(3) NOT NULL,
    "signature" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bids_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "total_cents" DECIMAL(38,0) NOT NULL DEFAULT 0,
    "committed_cents" DECIMAL(38,0) NOT NULL DEFAULT 0,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "wallet_id" UUID NOT NULL,
    "kind" "wallet_entry_kind" NOT NULL,
    "amount_cents" BIGINT NOT NULL,
    "reference" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lot_id" UUID NOT NULL,
    "winner_bid_id" UUID,
    "settled_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "settlement_id" UUID NOT NULL,
    "public_token" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "operation" TEXT NOT NULL,
    "resource_key" TEXT NOT NULL,
    "idempotency_key" UUID NOT NULL,
    "request_hash" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_item_snapshots_provider_external_id_key" ON "catalog_item_snapshots"("provider", "external_id");

-- CreateIndex
CREATE INDEX "lots_status_ends_at_idx" ON "lots"("status", "ends_at");

-- CreateIndex
CREATE INDEX "lots_owner_id_idx" ON "lots"("owner_id");

-- CreateIndex
CREATE INDEX "lots_snapshot_id_idx" ON "lots"("snapshot_id");

-- CreateIndex
CREATE INDEX "bids_user_id_lot_id_idx" ON "bids"("user_id", "lot_id");

-- CreateIndex
CREATE UNIQUE INDEX "bids_lot_id_sequence_key" ON "bids"("lot_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_user_id_key" ON "wallets"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_entries_reference_key" ON "wallet_entries"("reference");

-- CreateIndex
CREATE INDEX "wallet_entries_wallet_id_idx" ON "wallet_entries"("wallet_id");

-- CreateIndex
CREATE UNIQUE INDEX "settlements_lot_id_key" ON "settlements"("lot_id");

-- CreateIndex
CREATE UNIQUE INDEX "settlements_winner_bid_id_key" ON "settlements"("winner_bid_id");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_settlement_id_key" ON "receipts"("settlement_id");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_public_token_key" ON "receipts"("public_token");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_scope" ON "idempotency_records"("user_id", "operation", "resource_key", "idempotency_key");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "catalog_item_snapshots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bids" ADD CONSTRAINT "bids_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bids" ADD CONSTRAINT "bids_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_entries" ADD CONSTRAINT "wallet_entries_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_winner_bid_id_fkey" FOREIGN KEY ("winner_bid_id") REFERENCES "bids"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "settlements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Checks that Prisma 7 cannot represent in schema.prisma.
ALTER TABLE "users" ADD CONSTRAINT "users_email_normalized" CHECK ("email" = lower("email") AND "email" = btrim("email") AND char_length("password_hash") > 0);
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_token_present" CHECK (char_length("token_hash") > 0);
ALTER TABLE "catalog_item_snapshots" ADD CONSTRAINT "catalog_item_snapshots_identity" CHECK (char_length("provider") > 0 AND char_length("external_id") > 0 AND char_length("media_key") > 0 AND char_length("license") > 0);
ALTER TABLE "lots" ADD CONSTRAINT "lots_amounts_and_window" CHECK ("initial_cents" > 0 AND "increment_cents" > 0 AND "ends_at" > "starts_at" AND "revision" >= 0);
ALTER TABLE "bids" ADD CONSTRAINT "bids_amount_positive" CHECK ("amount_cents" > 0 AND "sequence" > 0 AND char_length("alias") > 0 AND char_length("signature") > 0);
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_balance_bounds" CHECK ("total_cents" >= 0 AND "committed_cents" >= 0 AND "committed_cents" <= "total_cents" AND "revision" >= 0);
ALTER TABLE "wallet_entries" ADD CONSTRAINT "wallet_entries_amount_positive" CHECK ("amount_cents" > 0 AND char_length("reference") > 0);
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_token_present" CHECK (char_length("public_token") > 0);
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_response_bounds" CHECK (octet_length("response"::text) <= 32768 AND char_length("operation") > 0 AND char_length("request_hash") > 0);

-- Runtime role: DML only. DDL stays with the migration owner.
DO $$
DECLARE
  target_schema text := current_schema();
BEGIN
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA %I TO auction_app', target_schema);
  EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA %I TO auction_app', target_schema);
END $$;
GRANT USAGE ON TYPE "user_role", "lot_status", "wallet_entry_kind" TO auction_app;
