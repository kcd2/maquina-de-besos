-- Ejecuta este archivo una sola vez en Supabase → SQL Editor.
-- El navegador no obtiene permisos directos sobre estas tablas; solo la función
-- privada "couple" puede leerlas o escribirlas con su clave de servidor.

create extension if not exists pgcrypto;

create table if not exists public.couple_pairs (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.couple_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pair_id uuid not null references public.couple_pairs(id) on delete cascade,
  joined_at timestamptz not null default now()
);

alter table public.couple_pairs enable row level security;
alter table public.couple_members enable row level security;

revoke all on public.couple_pairs from anon, authenticated;
revoke all on public.couple_members from anon, authenticated;

-- Evita que dos invitadas acepten a la vez y el espacio termine con más de dos.
create or replace function public.limit_couple_to_two_members()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_members integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.pair_id::text, 0));
  select count(*) into current_members
  from public.couple_members
  where pair_id = new.pair_id;
  if current_members >= 2 then
    raise exception 'This couple space already has two members.' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists couple_members_max_two on public.couple_members;
create trigger couple_members_max_two
before insert on public.couple_members
for each row execute function public.limit_couple_to_two_members();
