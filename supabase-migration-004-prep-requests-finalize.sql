-- Supabase migration: add finalized flags to prep_requests
-- Run in Supabase SQL Editor (Primary Database).

ALTER TABLE "public"."prep_requests"
  ADD COLUMN IF NOT EXISTS "finalizadoAt" TIMESTAMP(3);

ALTER TABLE "public"."prep_requests"
  ADD COLUMN IF NOT EXISTS "finalizadoBy" TEXT;

