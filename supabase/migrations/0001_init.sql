-- Tiger Task — schéma initial
-- À coller EN ENTIER dans Supabase > SQL Editor, sans rien sélectionner, puis Run.
-- Le script peut être relancé sans risque.

-- ------------------------------------------------------------
-- Profils (statut premium, lien Stripe)
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  is_premium boolean not null default false,
  premium_plan text check (premium_plan in ('monthly', 'yearly')),
  premium_until timestamptz,
  stripe_customer_id text unique,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- L'utilisateur lit son profil ; seul le webhook Stripe (clé service_role) peut l'écrire.
drop policy if exists "profil lisible par son propriétaire" on public.profiles;
create policy "profil lisible par son propriétaire"
  on public.profiles for select
  using (auth.uid() = id);

-- Un profil est créé automatiquement à l'inscription
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$fn$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- Horodatage serveur pour la synchronisation
-- ------------------------------------------------------------
create or replace function public.touch_synced_at()
returns trigger language plpgsql as $fn$
begin
  -- la modification la plus récente gagne : un appareil en retard n'écrase pas un plus récent
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return old;
  end if;
  new.synced_at := now();
  return new;
end;
$fn$;

-- ------------------------------------------------------------
-- Rituels (tâches récurrentes)
-- ------------------------------------------------------------
create table if not exists public.rituals (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  text text not null,
  weekdays smallint[] not null,
  start_date date not null,
  active boolean not null default true,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted boolean not null default false,
  synced_at timestamptz not null default now()
);

create index if not exists rituals_user_synced on public.rituals (user_id, synced_at);

drop trigger if exists rituals_synced_at on public.rituals;
create trigger rituals_synced_at
  before insert or update on public.rituals
  for each row execute function public.touch_synced_at();

alter table public.rituals enable row level security;

drop policy if exists "rituels : propriétaire seulement" on public.rituals;
create policy "rituels : propriétaire seulement"
  on public.rituals for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- Tâches
-- ------------------------------------------------------------
create table if not exists public.tasks (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  text text not null,
  date date not null,
  pigment text not null check (pigment in ('white', 'green', 'yellow', 'red', 'blue', 'purple', 'black')),
  ritual_id uuid,
  carried_from uuid,
  carry_count integer not null default 0,
  sort double precision not null default 0,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted boolean not null default false,
  synced_at timestamptz not null default now()
);

create index if not exists tasks_user_synced on public.tasks (user_id, synced_at);
create index if not exists tasks_user_date on public.tasks (user_id, date);

drop trigger if exists tasks_synced_at on public.tasks;
create trigger tasks_synced_at
  before insert or update on public.tasks
  for each row execute function public.touch_synced_at();

alter table public.tasks enable row level security;

drop policy if exists "tâches : propriétaire seulement" on public.tasks;
create policy "tâches : propriétaire seulement"
  on public.tasks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
