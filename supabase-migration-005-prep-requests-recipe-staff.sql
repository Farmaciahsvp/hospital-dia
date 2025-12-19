-- Supabase migration: add receta + recepción + staff to prep_requests
-- Run in Supabase SQL Editor (Primary Database).

ALTER TABLE "public"."prep_requests"
  ADD COLUMN IF NOT EXISTS "fechaRecepcion" DATE;

ALTER TABLE "public"."prep_requests"
  ADD COLUMN IF NOT EXISTS "numeroReceta" TEXT;

ALTER TABLE "public"."prep_requests"
  ADD COLUMN IF NOT EXISTS "prescriberId" TEXT;

ALTER TABLE "public"."prep_requests"
  ADD COLUMN IF NOT EXISTS "pharmacistId" TEXT;

CREATE INDEX IF NOT EXISTS "prep_requests_numeroReceta_idx" ON "public"."prep_requests"("numeroReceta");

ALTER TABLE "public"."prep_requests"
  ADD CONSTRAINT "prep_requests_prescriberId_fkey"
  FOREIGN KEY ("prescriberId") REFERENCES "public"."prescribers"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."prep_requests"
  ADD CONSTRAINT "prep_requests_pharmacistId_fkey"
  FOREIGN KEY ("pharmacistId") REFERENCES "public"."pharmacists"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

