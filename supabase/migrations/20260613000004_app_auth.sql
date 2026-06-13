-- MN Enterprises: simple phone + PIN login for the whole app
create extension if not exists pgcrypto with schema extensions;

create table app_auth (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  pin_hash text not null,
  created_at timestamptz not null default now()
);

alter table app_auth enable row level security;
-- No policies are defined, so app_auth is inaccessible via the anon/authenticated
-- API roles. Only the security-definer function below can read it.

-- Verifies a phone + 4-digit PIN against app_auth. Runs as the function owner
-- (bypassing RLS) so the anon key can call it without exposing pin_hash directly.
create or replace function verify_pin(p_phone text, p_pin text)
returns boolean
language sql
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1 from app_auth
    where phone = p_phone
      and pin_hash = extensions.crypt(p_pin, pin_hash)
  );
$$;

revoke all on function verify_pin(text, text) from public;
grant execute on function verify_pin(text, text) to anon, authenticated;

-- Seed the owner's login (phone 9912063801, PIN 3801)
insert into app_auth (phone, pin_hash)
values ('9912063801', extensions.crypt('3801', extensions.gen_salt('bf')));
