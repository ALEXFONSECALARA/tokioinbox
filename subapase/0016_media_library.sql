-- ═══════════════════════════════════════════════════════════════════════
-- TokioInbox — Biblioteca de imagens por restaurante
--
-- O arquivo binário fica no Supabase Storage e esta tabela guarda o catálogo
--/metadata. Cada caminho começa pelo slug do restaurante, mantendo isolamento
-- lógico mesmo dentro de um bucket compartilhado.
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists media_assets (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  storage_provider text not null default 'supabase',
  bucket text,
  storage_path text,
  url text not null,
  kind text not null default 'other',
  entity_type text,
  entity_id text,
  original_name text,
  mime_type text,
  size_bytes bigint,
  alt_text text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists media_assets_restaurant_idx
  on media_assets(restaurant_id, created_at desc);
create index if not exists media_assets_restaurant_kind_idx
  on media_assets(restaurant_id, kind);
create index if not exists media_assets_entity_idx
  on media_assets(restaurant_id, entity_type, entity_id);

create trigger media_assets_set_updated_at
  before update on media_assets
  for each row execute function set_updated_at();

alter table media_assets enable row level security;

-- A tabela de catálogo não fica aberta ao público porque pode conter nomes,
-- metadata e referências internas. O backend usa service_role.
create policy media_assets_restaurant_isolated on media_assets
  for all
  using (restaurant_id = restaurant_id_claim())
  with check (restaurant_id = restaurant_id_claim());

-- Bucket público: o cliente precisa conseguir carregar as imagens do cardápio
-- sem login. Upload/delete continuam sendo feitos pelo backend com service_role.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'restaurant-media',
  'restaurant-media',
  true,
  8388608,
  array['image/jpeg','image/png','image/webp','image/gif','image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
