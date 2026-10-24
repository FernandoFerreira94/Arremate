-- D17 (Fernando, 24/10/2026): estimativa e laudo simulados para demonstração.
ALTER TABLE "lots" ADD COLUMN "estimate_low_cents" BIGINT,
ADD COLUMN "estimate_high_cents" BIGINT,
ADD COLUMN "condition_report" TEXT;

-- Checks that Prisma 7 cannot represent in schema.prisma.
ALTER TABLE "lots" ADD CONSTRAINT "lots_simulated_estimate" CHECK (
  ("estimate_low_cents" IS NULL AND "estimate_high_cents" IS NULL)
  OR ("estimate_low_cents" > 0 AND "estimate_high_cents" >= "estimate_low_cents")
);
ALTER TABLE "lots" ADD CONSTRAINT "lots_condition_report_bounds" CHECK (
  "condition_report" IS NULL OR char_length("condition_report") BETWEEN 1 AND 2000
);
