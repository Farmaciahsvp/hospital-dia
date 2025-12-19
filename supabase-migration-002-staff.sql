-- Supabase migration: pharmacists and prescribers
-- Run in Supabase SQL Editor (Primary Database).

CREATE TABLE IF NOT EXISTS "public"."pharmacists" (
  "id" TEXT NOT NULL,
  "codigo" TEXT NOT NULL,
  "nombres" TEXT NOT NULL,
  "apellidos" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "pharmacists_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "pharmacists_codigo_key" ON "public"."pharmacists"("codigo");

CREATE TABLE IF NOT EXISTS "public"."prescribers" (
  "id" TEXT NOT NULL,
  "codigo" TEXT NOT NULL,
  "nombres" TEXT NOT NULL,
  "apellidos" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "prescribers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "prescribers_codigo_key" ON "public"."prescribers"("codigo");

