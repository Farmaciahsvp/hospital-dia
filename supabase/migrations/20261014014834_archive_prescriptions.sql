alter table public.prep_requests
  add column "archivedAt" timestamptz,
  add column "archivedBy" text;

create index prep_requests_archived_at_idx
  on public.prep_requests ("archivedAt");

create index prep_requests_recipe_archive_idx
  on public.prep_requests (
    "patientId",
    "numeroReceta",
    "fechaRecepcion",
    "archivedAt"
  );

comment on column public.prep_requests."archivedAt" is
  'Momento en que la receta dejo de mostrarse como activa, sin eliminar su historial.';

comment on column public.prep_requests."archivedBy" is
  'Identidad verificada que archivo la receta.';
