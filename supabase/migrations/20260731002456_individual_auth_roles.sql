create type public."AppRole" as enum (
  'administrator',
  'pharmacist',
  'auditor'
);

create table public.app_users (
  id uuid primary key default gen_random_uuid(),
  "authUserId" uuid not null unique
    references auth.users(id) on delete cascade,
  email text not null unique,
  "displayName" text not null,
  role public."AppRole" not null default 'auditor',
  active boolean not null default true,
  "lastLoginAt" timestamptz,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  constraint app_users_email_normalized
    check (email = lower(trim(email))),
  constraint app_users_display_name_present
    check (length(trim("displayName")) > 0)
);

create index app_users_active_role_idx
  on public.app_users(active, role);

alter table public.app_users enable row level security;

revoke all on table public.app_users from anon, authenticated, public;
grant select (
  id,
  "authUserId",
  email,
  "displayName",
  role,
  active,
  "lastLoginAt"
) on table public.app_users to authenticated;

create policy app_users_read_own_profile
  on public.app_users
  for select
  to authenticated
  using ((select auth.uid()) = "authUserId");

comment on table public.app_users is
  'Usuarios autorizados de Hospital Dia vinculados a Supabase Auth.';
comment on column public.app_users.role is
  'Rol autorizado por la institucion; nunca se deriva de user_metadata.';
