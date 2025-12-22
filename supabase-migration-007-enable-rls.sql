-- Enable RLS for public tables (Supabase Security Advisor)
-- This app reads/writes through server-side API routes (Prisma), so we deny direct access for anon/auth roles.

ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prep_request_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prep_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescribers ENABLE ROW LEVEL SECURITY;

-- Deny-all policies for direct client roles.
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'medications',
    'patients',
    'pharmacists',
    'prep_request_items',
    'prep_requests',
    'prescribers'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS deny_anon ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS deny_authenticated ON public.%I', t);

    EXECUTE format('CREATE POLICY deny_anon ON public.%I FOR ALL TO anon USING (false) WITH CHECK (false)', t);
    EXECUTE format('CREATE POLICY deny_authenticated ON public.%I FOR ALL TO authenticated USING (false) WITH CHECK (false)', t);
  END LOOP;
END $$;

