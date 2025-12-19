-- Supabase migration: add frecuencia and adquisicion to prep_request_items
-- Run in Supabase SQL Editor (Primary Database).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AcquisitionType') THEN
    CREATE TYPE "public"."AcquisitionType" AS ENUM ('almacenable', 'compra_local');
  END IF;
END $$;

ALTER TABLE "public"."prep_request_items"
  ADD COLUMN IF NOT EXISTS "frecuencia" TEXT;

ALTER TABLE "public"."prep_request_items"
  ADD COLUMN IF NOT EXISTS "adquisicion" "public"."AcquisitionType" NOT NULL DEFAULT 'almacenable';

