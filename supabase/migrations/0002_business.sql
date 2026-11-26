-- Tiger Task — offres, affiliation, paiements, OKR.
-- À coller EN ENTIER dans Supabase > SQL Editor, puis Run. Relançable sans risque.
-- Toutes ces tables ne sont écrites que par le Worker (clé service_role) ;
-- les utilisateurs ne lisent que ce qui les concerne.

-- ------------------------------------------------------------
-- Profils : offre, parrainage, rôle admin
-- ------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_premium_plan_check;
alter table public.profiles add constraint profiles_premium_plan_check
  check (premium_plan in ('monthly', 'yearly', 'lifetime'));
alter table public.profiles add column if not exists is_admin boolean not null default false;
alter table public.profiles add column if not exists referred_by text;
alter table public.profiles add column if not exists referred_at timestamptz;
alter table public.profiles add column if not exists downsell_used boolean not null default false;
alter table public.profiles add column if not exists stripe_subscription_id text;

-- ------------------------------------------------------------
-- Affiliés
-- ------------------------------------------------------------
create table if not exists public.affiliates (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code text not null unique check (code ~ '^[a-z0-9-]{3,24}$'),
  payout_details text,
  status text not null default 'active' check (status in ('active', 'paused', 'banned')),
  created_at timestamptz not null default now()
);
alter table public.affiliates enable row level security;
drop policy if exists "affilié : lit sa fiche" on public.affiliates;
create policy "affilié : lit sa fiche" on public.affiliates for select using (auth.uid() = user_id);

-- Clics sur les liens /r/<code> (aucune donnée personnelle : ni IP ni user-agent)
create table if not exists public.referral_clicks (
  id bigserial primary key,
  code text not null,
  landing text,
  country text,
  created_at timestamptz not null default now()
);
create index if not exists referral_clicks_code on public.referral_clicks (code, created_at);
alter table public.referral_clicks enable row level security;

-- Commissions : 7 € par annuel (1re année), 15 € par offre à vie ; payables 30 jours après le paiement
create table if not exists public.commissions (
  id bigserial primary key,
  affiliate_code text not null,
  referred_user uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('yearly', 'lifetime')),
  amount_cents integer not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'void')),
  available_at timestamptz not null,
  stripe_ref text unique,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (referred_user, kind)
);
create index if not exists commissions_code on public.commissions (affiliate_code, status);
alter table public.commissions enable row level security;
drop policy if exists "affilié : lit ses commissions" on public.commissions;
create policy "affilié : lit ses commissions" on public.commissions for select
  using (affiliate_code in (select code from public.affiliates where user_id = auth.uid()));

-- ------------------------------------------------------------
-- Paiements encaissés (pour le chiffre d'affaires et le MRR)
-- ------------------------------------------------------------
create table if not exists public.payments (
  id bigserial primary key,
  user_id uuid references auth.users (id) on delete set null,
  plan text not null check (plan in ('monthly', 'yearly', 'lifetime')),
  amount_cents integer not null,
  currency text not null default 'eur',
  stripe_ref text unique,
  created_at timestamptz not null default now()
);
create index if not exists payments_created on public.payments (created_at);
alter table public.payments enable row level security;

-- Événements produit pour le back-office (inscription, onboarding, paywall…)
create table if not exists public.events (
  id bigserial primary key,
  user_id uuid references auth.users (id) on delete cascade,
  name text not null,
  props jsonb,
  created_at timestamptz not null default now()
);
create index if not exists events_name_created on public.events (name, created_at);
alter table public.events enable row level security;
drop policy if exists "événements : écrit les siens" on public.events;
create policy "événements : écrit les siens" on public.events for insert with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- OKR
-- ------------------------------------------------------------
create table if not exists public.okrs (
  id bigserial primary key,
  period text not null,
  objective text not null,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.key_results (
  id bigserial primary key,
  okr_id bigint not null references public.okrs (id) on delete cascade,
  title text not null,
  metric text,
  target numeric not null,
  manual_value numeric,
  unit text,
  sort integer not null default 0
);
alter table public.okrs enable row level security;
alter table public.key_results enable row level security;

-- Des premiers OKR, à modifier dans le back-office
insert into public.okrs (id, period, objective, sort)
values
  (1, 'T1 2027', 'Faire tenir la feuille : les nouveaux adoptent le rituel quotidien', 0),
  (2, 'T1 2027', 'Premiers revenus : prouver qu''on paie pour garder son année', 1),
  (3, 'T1 2027', 'Bouche-à-oreille : les utilisateurs font venir les suivants', 2)
on conflict (id) do nothing;
select setval(pg_get_serial_sequence('public.okrs', 'id'), greatest(3, (select max(id) from public.okrs)));

insert into public.key_results (id, okr_id, title, metric, target, unit, sort)
values
  (1, 1, 'Nouveaux qui colorent au moins 5 jours sur leur 1re semaine', 'activation_rate', 40, '%', 0),
  (2, 1, 'Utilisateurs actifs par semaine', 'wau', 500, '', 1),
  (3, 2, 'Abonnés payants', 'paying_users', 150, '', 0),
  (4, 2, 'Revenu mensuel récurrent (MRR)', 'mrr', 400, '€', 1),
  (5, 3, 'Affiliés ayant fait au moins une vente', 'active_affiliates', 30, '', 0),
  (6, 3, 'Part des ventes via affiliation', 'affiliate_share', 25, '%', 1)
on conflict (id) do nothing;
select setval(pg_get_serial_sequence('public.key_results', 'id'), greatest(6, (select max(id) from public.key_results)));

-- ------------------------------------------------------------
-- Pour devenir admin : remplace l'email puis exécute cette ligne seule
-- update public.profiles set is_admin = true where id = (select id from auth.users where email = 'ton@email.fr');
-- ------------------------------------------------------------
