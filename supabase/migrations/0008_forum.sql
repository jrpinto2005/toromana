-- ═══════════════════════════════════════════════════════════════════
-- Foro interno
--
-- Hoy las ideas, los pendientes y las quejas de clientes viven en chats de
-- WhatsApp donde se pierden. Una nota atada al pedido de la semana o al
-- cliente del que habla sigue estando ahí cuando vuelve a hacer falta.
--
-- Reparto no participa: es una conversación de operación y de cartera.
-- ═══════════════════════════════════════════════════════════════════

create type post_kind as enum ('idea','pendiente','queja','nota');

create table forum_posts (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null references profiles(id) on delete cascade,
  kind        post_kind not null default 'nota',
  body        text not null check (length(trim(body)) > 0),

  -- Contexto opcional, y en cualquier combinación: una nota puede ser
  -- general, sobre una semana, sobre un cliente, o sobre un cliente en una
  -- semana concreta.
  run_id      uuid references delivery_runs(id) on delete set null,
  customer_id uuid references customers(id) on delete set null,

  resolved_at timestamptz,
  resolved_by uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index forum_posts_created_idx  on forum_posts (created_at desc);
create index forum_posts_run_idx      on forum_posts (run_id);
create index forum_posts_customer_idx on forum_posts (customer_id);

create table forum_replies (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references forum_posts(id) on delete cascade,
  author_id  uuid not null references profiles(id) on delete cascade,
  body       text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now()
);

create index forum_replies_post_idx on forum_replies (post_id, created_at);

alter table forum_posts   enable row level security;
alter table forum_replies enable row level security;

-- Reparto no lee ni escribe: no es su conversación.
create policy forum_posts_read on forum_posts for select to authenticated
  using (auth_role() in ('admin','contabilidad','produccion'));

create policy forum_posts_write on forum_posts for all to authenticated
  using      (auth_role() in ('admin','contabilidad','produccion'))
  with check (auth_role() in ('admin','contabilidad','produccion'));

create policy forum_replies_read on forum_replies for select to authenticated
  using (auth_role() in ('admin','contabilidad','produccion'));

create policy forum_replies_write on forum_replies for all to authenticated
  using      (auth_role() in ('admin','contabilidad','produccion'))
  with check (auth_role() in ('admin','contabilidad','produccion'));

alter publication supabase_realtime add table forum_posts;
alter publication supabase_realtime add table forum_replies;

grant select on forum_posts, forum_replies to authenticated;
