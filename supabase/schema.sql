-- Maturaprojekt Doppelhaushälfte – Datenbank für Projektplan und Arbeitsprotokoll
-- In Supabase: SQL Editor → New query → alles einfügen → Run

-- Gruppen und Projektplan (je ein JSON-Dokument: id = 'groups' bzw. 'plan')
create table if not exists public.config (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

-- Fortschritt je Gruppe und Unterphase (0–100 %)
create table if not exists public.progress (
  group_id    text not null,
  subphase_id text not null,
  pct         integer not null check (pct between 0 and 100),
  updated_by  text,
  updated_at  timestamptz not null default now(),
  primary key (group_id, subphase_id)
);

-- Arbeitsprotokoll
create table if not exists public.entries (
  id          text primary key,
  date        text not null check (date ~ '^\d{4}-\d{2}-\d{2}$'),
  start_time  text,
  end_time    text,
  minutes     integer not null check (minutes > 0 and minutes <= 1440),
  person      text not null,
  group_id    text not null,
  subphase_id text,
  note        text not null default '',
  created_at  timestamptz not null default now()
);
create index if not exists entries_group_date on public.entries (group_id, date desc);

-- Zugriff: Die Seite verwendet den öffentlichen Schlüssel (Publishable/anon key).
-- Er steht nur im Einladungslink, nicht im öffentlichen Code. Wer den Link hat, darf lesen und schreiben.
alter table public.config   enable row level security;
alter table public.progress enable row level security;
alter table public.entries  enable row level security;

drop policy if exists "Team darf alles" on public.config;
drop policy if exists "Team darf alles" on public.progress;
drop policy if exists "Team darf alles" on public.entries;
create policy "Team darf alles" on public.config   for all to anon, authenticated using (true) with check (true);
create policy "Team darf alles" on public.progress for all to anon, authenticated using (true) with check (true);
create policy "Team darf alles" on public.entries  for all to anon, authenticated using (true) with check (true);

grant select, insert, update, delete on public.config, public.progress, public.entries to anon, authenticated;
