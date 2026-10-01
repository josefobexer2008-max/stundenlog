-- Maturaprojekt Doppelhaushälfte – Datenbank für Supabase
-- Einmal im Supabase-Dashboard unter "SQL Editor" komplett einfügen und "Run" drücken.
-- Die Startdaten (Gruppen, Phasen, Unterphasen) legt die App beim ersten Öffnen selbst an.

create table if not exists groups (
  id text primary key,
  name text not null,
  members jsonb not null default '[]'::jsonb,
  sort integer not null default 0
);

create table if not exists phases (
  id text primary key,
  name text not null,
  start_date date,
  end_date date,
  description text not null default '',
  sort integer not null default 0
);

create table if not exists subphases (
  id text primary key,
  phase_id text not null,
  name text not null,
  description text not null default '',
  sort integer not null default 0
);

create table if not exists progress (
  id text primary key,            -- "<subphase_id>:<group_id>"
  subphase_id text not null,
  group_id text not null,
  percent integer not null default 0 check (percent between 0 and 100)
);

create table if not exists entries (
  id text primary key,
  date date not null,
  start_time text,                -- "HH:MM" oder leer
  end_time text,
  minutes integer not null check (minutes > 0),
  person text not null,
  group_id text not null,
  subphase_id text,               -- leer = "Allgemein"
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists timers (
  id text primary key,            -- Name der Person
  started_at bigint not null,     -- Millisekunden seit 1970
  subphase_id text,
  note text not null default ''
);

-- Zugriff ohne Login: Jede Person mit dem Link darf lesen und schreiben.
do $$
declare t text;
begin
  foreach t in array array['groups','phases','subphases','progress','entries','timers'] loop
    execute format('grant select, insert, update, delete on table %I to anon, authenticated', t);
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "offen" on %I', t);
    execute format('create policy "offen" on %I for all to anon, authenticated using (true) with check (true)', t);
    -- Live-Aktualisierung auf allen Geräten
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;
