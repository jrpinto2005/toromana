-- ═══════════════════════════════════════════════════════════════════
-- Mapa de la ruta
--
-- Dos cosas distintas: dónde queda cada cliente, que se marca una vez y no
-- cambia, y dónde va quien reparte ahora mismo, que cambia cada minuto.
--
-- Las direcciones NO se geocodifican. Las de este negocio son "Parex",
-- "Edificio", "Debajo de la casa": un geocodificador las inventaría, y un pin
-- inventado en un mapa de reparto es peor que ningún pin. Se marcan a mano una
-- vez por cliente y quedan para siempre.
-- ═══════════════════════════════════════════════════════════════════

alter table customers
  add column lat double precision,
  add column lng double precision;

-- Posición de quien reparte, mientras reparte.
create table delivery_positions (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  run_id     uuid references delivery_runs(id) on delete set null,
  lat        double precision not null,
  lng        double precision not null,
  accuracy_m double precision,
  recorded_at timestamptz not null default now()
);

create index delivery_positions_recent_idx
  on delivery_positions (profile_id, recorded_at desc);

alter table delivery_positions enable row level security;

-- Todo el equipo ve dónde va la ruta; solo quien reparte reporta su posición.
create policy delivery_positions_read on delivery_positions
  for select to authenticated using (true);

create policy delivery_positions_write on delivery_positions
  for insert to authenticated
  with check (
    profile_id = auth.uid()
    and auth_role() in ('reparto','admin')
  );

alter publication supabase_realtime add table delivery_positions;
grant select on delivery_positions to authenticated;
