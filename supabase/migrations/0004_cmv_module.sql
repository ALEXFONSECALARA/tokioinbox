-- ============================================================================
-- MÓDULO CMV — Ficha técnica de ingredientes (complementa server/cmvAiService.ts,
-- que já existe no projeto e continua funcionando; aqui só passamos a calcular
-- o custo de produção a partir de ingredientes reais, em vez de um número
-- digitado à mão, e escopamos tudo por restaurante).
-- ============================================================================

create table if not exists public.ingredients (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  unit text not null,                -- 'g','kg','ml','l','un'
  cost_per_unit numeric(10,4) not null default 0,
  supplier text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_ingredients_restaurant on public.ingredients(restaurant_id);

-- Ficha técnica: quanto de cada ingrediente um produto usa.
create table if not exists public.product_recipe_items (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  quantity numeric(10,4) not null,   -- na mesma unidade do ingrediente
  unique (product_id, ingredient_id)
);
create index if not exists idx_recipe_items_product on public.product_recipe_items(product_id);

alter table public.ingredients enable row level security;
alter table public.product_recipe_items enable row level security;

create policy ingredients_staff on public.ingredients
  for all using (public.has_permission('product.view', restaurant_id))
  with check (public.has_permission('product.edit', restaurant_id));

create policy recipe_items_staff on public.product_recipe_items
  for all using (exists (
    select 1 from public.products p where p.id = product_id and public.has_permission('product.view', p.restaurant_id)
  ))
  with check (exists (
    select 1 from public.products p where p.id = product_id and public.has_permission('product.edit', p.restaurant_id)
  ));

-- ----------------------------------------------------------------------------
-- View: CMV calculado automaticamente = soma(quantidade x custo do ingrediente)
-- dividido pelo preço de venda. Isso substitui o campo de custo digitado à
-- mão por um número que sempre reflete a ficha técnica atual.
-- ----------------------------------------------------------------------------
create or replace view public.product_cmv as
select
  p.id as product_id,
  p.restaurant_id,
  p.name,
  p.price,
  coalesce(sum(ri.quantity * i.cost_per_unit), 0) as production_cost,
  case when p.price > 0
    then round((coalesce(sum(ri.quantity * i.cost_per_unit), 0) / p.price) * 100, 2)
    else 0
  end as cmv_percent,
  case
    when p.price = 0 then 'sem_preco'
    when (coalesce(sum(ri.quantity * i.cost_per_unit), 0) / p.price) * 100 > 35 then 'critico'
    when (coalesce(sum(ri.quantity * i.cost_per_unit), 0) / p.price) * 100 > 30 then 'alerta'
    else 'saudavel'
  end as status
from public.products p
left join public.product_recipe_items ri on ri.product_id = p.id
left join public.ingredients i on i.id = ri.ingredient_id
group by p.id, p.restaurant_id, p.name, p.price;

-- ----------------------------------------------------------------------------
-- Análise de vendas real (não simulada): cruza pedidos de verdade dos últimos
-- 30 dias com a margem de cada prato, pra basear as sugestões de cardápio em
-- dados reais em vez de "tendência de mercado" genérica.
-- ----------------------------------------------------------------------------
create or replace function public.product_sales_performance(p_restaurant_id uuid, p_days int default 30)
returns table (
  product_id uuid,
  name text,
  price numeric,
  cmv_percent numeric,
  status text,
  units_sold bigint,
  revenue numeric
)
language sql stable security definer as $$
  select
    c.product_id,
    c.name,
    c.price,
    c.cmv_percent,
    c.status,
    coalesce(sum(oi.quantity), 0) as units_sold,
    coalesce(sum(oi.total_price), 0) as revenue
  from public.product_cmv c
  left join public.order_items oi on oi.product_id = c.product_id
  left join public.orders o on o.id = oi.order_id
    and o.created_at >= now() - (p_days || ' days')::interval
    and o.status <> 'cancelado'
  where c.restaurant_id = p_restaurant_id
  group by c.product_id, c.name, c.price, c.cmv_percent, c.status
  order by units_sold desc;
$$;

revoke execute on function public.product_sales_performance(uuid, int) from public, anon, authenticated;
