-- Supabase migration: performance indexes for search & filtering
-- Run in Supabase SQL Editor (Primary Database).

-- Trigram indexes speed up ILIKE/contains searches.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Patients
CREATE INDEX IF NOT EXISTS "patients_identificacion_trgm_idx"
  ON "public"."patients" USING gin ("identificacion" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "patients_nombre_trgm_idx"
  ON "public"."patients" USING gin ("nombre" gin_trgm_ops);

-- Medications
CREATE INDEX IF NOT EXISTS "medications_nombre_trgm_idx"
  ON "public"."medications" USING gin ("nombre" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "medications_codigoInstitucional_trgm_idx"
  ON "public"."medications" USING gin ("codigoInstitucional" gin_trgm_ops);

-- Prep requests
CREATE INDEX IF NOT EXISTS "prep_requests_fechaRecepcion_idx"
  ON "public"."prep_requests" ("fechaRecepcion" DESC);

CREATE INDEX IF NOT EXISTS "prep_requests_finalizadoAt_idx"
  ON "public"."prep_requests" ("finalizadoAt");

CREATE INDEX IF NOT EXISTS "prep_requests_numeroReceta_trgm_idx"
  ON "public"."prep_requests" USING gin ("numeroReceta" gin_trgm_ops);

-- Staff
CREATE INDEX IF NOT EXISTS "pharmacists_codigo_trgm_idx"
  ON "public"."pharmacists" USING gin ("codigo" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "pharmacists_nombres_trgm_idx"
  ON "public"."pharmacists" USING gin ("nombres" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "pharmacists_apellidos_trgm_idx"
  ON "public"."pharmacists" USING gin ("apellidos" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "prescribers_codigo_trgm_idx"
  ON "public"."prescribers" USING gin ("codigo" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "prescribers_nombres_trgm_idx"
  ON "public"."prescribers" USING gin ("nombres" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "prescribers_apellidos_trgm_idx"
  ON "public"."prescribers" USING gin ("apellidos" gin_trgm_ops);

