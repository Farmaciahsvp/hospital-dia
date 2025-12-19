-- Supabase migration: add fields to medications catalog
-- Run in Supabase SQL Editor (Primary Database).

ALTER TABLE "public"."medications"
  ADD COLUMN IF NOT EXISTS "concentracion" TEXT;

ALTER TABLE "public"."medications"
  ADD COLUMN IF NOT EXISTS "viaAdministracion" TEXT;

