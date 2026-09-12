-- TokioInbox v27.1 — reparo de conta do cliente + reload do PostgREST
-- Pode ser executada no Supabase SQL Editor depois das migrations anteriores.
-- É idempotente e também recupera a instalação caso a migration 0013 não tenha
-- criado as tabelas por algum motivo.

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  label text not null default 'Casa',
  cep text,
  street text not null,
  number text not null,
  neighborhood text not null,
  city text,
  state text,
  unit text,
  complement text,
  reference text,
  lat double precision,
  lng double precision,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

alter table orders add column if not exists customer_id uuid references customers(id) on delete set null;
create index if not exists orders_customer_id_idx on orders(customer_id);
create index if not exists customer_addresses_customer_id_idx on customer_addresses(customer_id);

-- Normalização de telefone sem destruir formatação aceita pela API.
update customers
set phone = regexp_replace(phone, '\D', '', 'g')
where phone is not null;

-- Só cria a unicidade se não houver duplicidade. Em caso de duplicidade,
-- a conta não é apagada silenciosamente: o índice simplesmente não é criado.
do $$
begin
  if not exists (select 1 from customers group by phone having count(*) > 1) then
    create unique index if not exists customers_phone_normalized_uidx on customers(phone);
  end if;
end $$;

-- Força o PostgREST a recarregar o cache das tabelas/colunas recém-criadas.
notify pgrst, 'reload schema';
