-- Supabase migration: move pg_trgm out of public schema
-- This resolves Supabase Security Advisor warning "Extension in Public".

CREATE SCHEMA IF NOT EXISTS extensions;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT USAGE ON SCHEMA extensions TO anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT USAGE ON SCHEMA extensions TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT USAGE ON SCHEMA extensions TO service_role;
  END IF;
END $$;

DO $$
DECLARE
  ext_schema TEXT;
BEGIN
  SELECT n.nspname
    INTO ext_schema
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
   WHERE e.extname = 'pg_trgm';

  IF ext_schema IS NULL THEN
    CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
  ELSIF ext_schema = 'public' THEN
    ALTER EXTENSION pg_trgm SET SCHEMA extensions;
  END IF;
END $$;
