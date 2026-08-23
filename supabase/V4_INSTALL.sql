
-- ===== supabase/migrations/001_initial_schema.sql =====
-- Conveniência 24h — esquema inicial
-- Projetado para Supabase/PostgreSQL.

create type public.store_status as enum ('open', 'paused', 'closed');
create type public.app_role as enum ('admin', 'operation', 'driver');
create type public.order_status as enum ('received', 'picking', 'ready', 'out_for_delivery', 'delivered', 'cancelled');
create type public.payment_method as enum ('pix', 'cash', 'card_on_delivery');
create type public.payment_status as enum ('pending', 'paid', 'on_delivery', 'cancelled', 'failed');
create type public.driver_status as enum ('available', 'delivering', 'offline');
create type public.inventory_movement_type as enum ('entry', 'sale', 'cancellation', 'adjustment', 'loss', 'damage', 'inventory');
create type public.delivery_status as enum ('assigned', 'started', 'delivered', 'cancelled');

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status public.store_status not null default 'open',
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  image_url text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  description text,
  category_id uuid references public.categories(id) on delete set null,
  image_url text,
  unit text not null default 'un',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.store_products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  price numeric(12,2) not null check (price >= 0),
  cost numeric(12,2) check (cost is null or cost >= 0),
  minimum_stock integer not null default 0 check (minimum_stock >= 0),
  active boolean not null default true,
  sector text,
  aisle text,
  shelf text,
  position text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, product_id)
);

create table public.inventory (
  store_product_id uuid primary key references public.store_products(id) on delete cascade,
  on_hand integer not null default 0 check (on_hand >= 0),
  reserved integer not null default 0 check (reserved >= 0),
  updated_at timestamptz not null default now(),
  constraint inventory_reserved_not_above_on_hand check (reserved <= on_hand)
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  full_name text not null,
  phone text not null,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  label text,
  postal_code text not null,
  street text not null,
  number text not null,
  complement text,
  neighborhood text not null,
  city text not null,
  state text not null,
  reference text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  neighborhood text,
  postal_code_prefix text,
  delivery_fee numeric(12,2) not null default 0 check (delivery_fee >= 0),
  minimum_order numeric(12,2) not null default 0 check (minimum_order >= 0),
  free_delivery_from numeric(12,2) check (free_delivery_from is null or free_delivery_from >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity unique,
  tracking_token uuid not null default gen_random_uuid() unique,
  store_id uuid not null references public.stores(id),
  customer_id uuid references public.customers(id) on delete set null,
  status public.order_status not null default 'received',
  payment_method public.payment_method not null,
  payment_status public.payment_status not null default 'pending',
  subtotal numeric(12,2) not null check (subtotal >= 0),
  delivery_fee numeric(12,2) not null default 0 check (delivery_fee >= 0),
  discount numeric(12,2) not null default 0 check (discount >= 0),
  total numeric(12,2) not null check (total >= 0),
  notes text,
  cancellation_reason text,
  -- Snapshot do destinatário/endereço no momento da compra.
  customer_name text not null,
  customer_phone text not null,
  postal_code text not null,
  street text not null,
  number text not null,
  complement text,
  neighborhood text not null,
  city text not null,
  state text not null,
  address_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  delivered_at timestamptz
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  store_product_id uuid references public.store_products(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  sku text not null,
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  total_price numeric(12,2) not null check (total_price >= 0),
  picked_quantity integer not null default 0 check (picked_quantity >= 0),
  picked_by uuid references auth.users(id) on delete set null,
  picked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint order_item_picked_not_above_quantity check (picked_quantity <= quantity)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  method public.payment_method not null,
  status public.payment_status not null default 'pending',
  amount numeric(12,2) not null check (amount >= 0),
  transaction_reference text,
  change_for numeric(12,2) check (change_for is null or change_for >= 0),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table public.order_status_history (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  status public.order_status not null,
  user_id uuid references auth.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create table public.drivers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  status public.driver_status not null default 'offline',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  driver_id uuid not null references public.drivers(id),
  status public.delivery_status not null default 'assigned',
  assigned_at timestamptz not null default now(),
  started_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inventory_movements (
  id bigint generated always as identity primary key,
  store_product_id uuid not null references public.store_products(id),
  movement_type public.inventory_movement_type not null,
  quantity integer not null check (quantity <> 0),
  order_id uuid references public.orders(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Índices dos caminhos de consulta mais frequentes.
create index idx_products_category on public.products(category_id) where active = true;
create index idx_store_products_store_active on public.store_products(store_id, active);
create index idx_orders_store_status_created on public.orders(store_id, status, created_at desc);
create index idx_orders_customer_created on public.orders(customer_id, created_at desc);
create index idx_order_items_order on public.order_items(order_id);
create index idx_order_history_order_created on public.order_status_history(order_id, created_at);
create index idx_inventory_movements_product_created on public.inventory_movements(store_product_id, created_at desc);
create index idx_deliveries_driver_status on public.deliveries(driver_id, status);
create index idx_delivery_zones_store_active on public.delivery_zones(store_id, active);

-- RLS: tudo em public nasce protegido.
alter table public.stores enable row level security;
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.store_products enable row level security;
alter table public.inventory enable row level security;
alter table public.customers enable row level security;
alter table public.customer_addresses enable row level security;
alter table public.delivery_zones enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.order_status_history enable row level security;
alter table public.drivers enable row level security;
alter table public.deliveries enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.audit_logs enable row level security;

-- Catálogo público: somente leitura do que está ativo.
create policy stores_public_read on public.stores
  for select to anon, authenticated
  using (status <> 'closed');

create policy categories_public_read on public.categories
  for select to anon, authenticated
  using (active = true);

create policy products_public_read on public.products
  for select to anon, authenticated
  using (active = true);

create policy store_products_public_read on public.store_products
  for select to anon, authenticated
  using (active = true);

create policy inventory_public_read on public.inventory
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.store_products sp
      where sp.id = inventory.store_product_id and sp.active = true
    )
  );

create policy delivery_zones_public_read on public.delivery_zones
  for select to anon, authenticated
  using (active = true);

-- Perfil: usuário pode ler/editar apenas o próprio registro.
create policy profiles_own_read on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy profiles_own_update on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Cliente autenticado só acessa seu próprio cadastro/endereço.
create policy customers_own_read on public.customers
  for select to authenticated
  using ((select auth.uid()) = auth_user_id);

create policy customers_own_update on public.customers
  for update to authenticated
  using ((select auth.uid()) = auth_user_id)
  with check ((select auth.uid()) = auth_user_id);

create policy addresses_own_read on public.customer_addresses
  for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = customer_addresses.customer_id
        and c.auth_user_id = (select auth.uid())
    )
  );

-- Pedidos autenticados do próprio cliente (checkout convidado será criado no servidor).
create policy orders_customer_read on public.orders
  for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = orders.customer_id
        and c.auth_user_id = (select auth.uid())
    )
  );

create policy order_items_customer_read on public.order_items
  for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      join public.customers c on c.id = o.customer_id
      where o.id = order_items.order_id
        and c.auth_user_id = (select auth.uid())
    )
  );

create policy payments_customer_read on public.payments
  for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      join public.customers c on c.id = o.customer_id
      where o.id = payments.order_id
        and c.auth_user_id = (select auth.uid())
    )
  );

create policy order_history_customer_read on public.order_status_history
  for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      join public.customers c on c.id = o.customer_id
      where o.id = order_status_history.order_id
        and c.auth_user_id = (select auth.uid())
    )
  );

-- Políticas internas baseadas SOMENTE em app_metadata (não user_metadata).
-- O backend administrativo atribuirá role no app_metadata.
create policy staff_orders_read on public.orders
  for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'operation'));

create policy staff_orders_update on public.orders
  for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'operation'))
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'operation'));

create policy staff_order_items_read on public.order_items
  for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'operation'));

create policy staff_order_items_update on public.order_items
  for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'operation'))
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'operation'));

create policy staff_payments_read on public.payments
  for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'operation'));

create policy staff_history_read on public.order_status_history
  for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'operation'));

create policy staff_history_insert on public.order_status_history
  for insert to authenticated
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'operation'));

create policy staff_products_manage on public.products
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy staff_store_products_manage on public.store_products
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy staff_inventory_read on public.inventory
  for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'operation'));

create policy admin_inventory_update on public.inventory
  for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy staff_movements_read on public.inventory_movements
  for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'operation'));

create policy admin_movements_insert on public.inventory_movements
  for insert to authenticated
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Entregador só visualiza a própria entidade e entregas atribuídas.
create policy drivers_own_read on public.drivers
  for select to authenticated
  using (user_id = (select auth.uid()) or (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'operation'));

create policy deliveries_driver_read on public.deliveries
  for select to authenticated
  using (
    exists (
      select 1 from public.drivers d
      where d.id = deliveries.driver_id and d.user_id = (select auth.uid())
    )
    or (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'operation')
  );

create policy deliveries_driver_update on public.deliveries
  for update to authenticated
  using (
    exists (
      select 1 from public.drivers d
      where d.id = deliveries.driver_id and d.user_id = (select auth.uid())
    )
    or (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'operation')
  )
  with check (
    exists (
      select 1 from public.drivers d
      where d.id = deliveries.driver_id and d.user_id = (select auth.uid())
    )
    or (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'operation')
  );

-- Seeds mínimos de demonstração.
insert into public.stores (name, slug, status, phone)
values ('Loja Piedade', 'piedade', 'open', null);

insert into public.categories (name, slug, sort_order) values
  ('Bebidas', 'bebidas', 10),
  ('Bomboniere', 'bomboniere', 20),
  ('Salgadinhos', 'salgadinhos', 30),
  ('Gelo', 'gelo', 40),
  ('Higiene', 'higiene', 50),
  ('Utilidades', 'utilidades', 60);


-- ===== supabase/migrations/002_inventory_helpers.sql =====
-- Helpers transacionais simples para reserva/liberação de estoque.
-- Funções SECURITY INVOKER: respeitam os privilégios do chamador.

create or replace function public.reserve_stock(p_store_product_id uuid, p_quantity integer)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_quantity <= 0 then
    raise exception 'quantity_must_be_positive';
  end if;

  update public.inventory
     set reserved = reserved + p_quantity,
         updated_at = now()
   where store_product_id = p_store_product_id
     and (on_hand - reserved) >= p_quantity;

  if not found then
    raise exception 'insufficient_stock';
  end if;
end;
$$;

create or replace function public.release_reserved_stock(p_store_product_id uuid, p_quantity integer)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_quantity <= 0 then
    raise exception 'quantity_must_be_positive';
  end if;

  update public.inventory
     set reserved = reserved - p_quantity,
         updated_at = now()
   where store_product_id = p_store_product_id
     and reserved >= p_quantity;

  if not found then
    raise exception 'invalid_reserved_quantity';
  end if;
end;
$$;

create or replace function public.consume_reserved_stock(p_store_product_id uuid, p_quantity integer)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_quantity <= 0 then
    raise exception 'quantity_must_be_positive';
  end if;

  update public.inventory
     set on_hand = on_hand - p_quantity,
         reserved = reserved - p_quantity,
         updated_at = now()
   where store_product_id = p_store_product_id
     and reserved >= p_quantity
     and on_hand >= p_quantity;

  if not found then
    raise exception 'invalid_stock_consumption';
  end if;
end;
$$;

-- Nada de RPC pública por padrão. Somente backend privilegiado poderá conceder uso depois.
revoke execute on function public.reserve_stock(uuid, integer) from public, anon, authenticated;
revoke execute on function public.release_reserved_stock(uuid, integer) from public, anon, authenticated;
revoke execute on function public.consume_reserved_stock(uuid, integer) from public, anon, authenticated;


-- ===== supabase/migrations/003_v4_operations.sql =====
-- V4: catálogo persistente, fotos, pedidos transacionais e status operacionais.

alter table public.products add column if not exists public_id bigint generated always as identity;
create unique index if not exists products_public_id_key on public.products(public_id);

alter table public.store_products add column if not exists compare_at_price numeric(12,2) check (compare_at_price is null or compare_at_price >= 0);
alter table public.store_products add column if not exists badge text not null default '';

insert into public.categories (name, slug, sort_order)
values ('Limpeza', 'limpeza', 55)
on conflict (slug) do update set name = excluded.name, active = true;

-- Bucket público para imagens de produtos; escrita será feita pelo backend autenticado.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5000000, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = true, file_size_limit = 5000000;

-- Função transacional para criar pedido. Só o service_role poderá executá-la.
create or replace function public.create_order_v4(p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_store_id uuid;
  v_store_slug text := coalesce(nullif(p_payload->>'store_slug',''), 'piedade');
  v_delivery_fee numeric(12,2) := greatest(0, coalesce((p_payload->>'delivery_fee')::numeric, 0));
  v_customer_id uuid;
  v_order_id uuid;
  v_order_number bigint;
  v_tracking_token uuid;
  v_subtotal numeric(12,2) := 0;
  v_total numeric(12,2);
  v_payment_method public.payment_method;
  v_payment_status public.payment_status;
  v_item jsonb;
  v_qty integer;
  v_product_public_id bigint;
  v_product_id uuid;
  v_store_product_id uuid;
  v_sku text;
  v_product_name text;
  v_price numeric(12,2);
  v_on_hand integer;
  v_reserved integer;
  v_resolved jsonb := '[]'::jsonb;
  v_change_for numeric(12,2);
begin
  if jsonb_typeof(p_payload->'items') is distinct from 'array' or jsonb_array_length(p_payload->'items') = 0 then
    raise exception 'items_required';
  end if;

  if nullif(trim(p_payload->'customer'->>'name'), '') is null
     or nullif(trim(p_payload->'customer'->>'phone'), '') is null
     or nullif(trim(p_payload->'address'->>'postal_code'), '') is null
     or nullif(trim(p_payload->'address'->>'street'), '') is null
     or nullif(trim(p_payload->'address'->>'number'), '') is null
     or nullif(trim(p_payload->'address'->>'neighborhood'), '') is null
     or nullif(trim(p_payload->'address'->>'city'), '') is null
     or nullif(trim(p_payload->'address'->>'state'), '') is null then
    raise exception 'customer_or_address_incomplete';
  end if;

  select id into v_store_id
  from public.stores
  where slug = v_store_slug and status <> 'closed';

  if v_store_id is null then raise exception 'store_unavailable'; end if;

  begin
    v_payment_method := (p_payload->>'payment_method')::public.payment_method;
  exception when others then
    raise exception 'invalid_payment_method';
  end;

  v_payment_status := case when v_payment_method = 'pix' then 'pending'::public.payment_status else 'on_delivery'::public.payment_status end;
  if nullif(p_payload->>'change_for','') is not null then
    v_change_for := (p_payload->>'change_for')::numeric;
  end if;

  -- Bloqueia cada saldo antes de reservar para evitar duas compras do mesmo saldo.
  for v_item in
    select value
    from jsonb_array_elements(p_payload->'items')
    order by (value->>'product_id')::bigint
  loop
    v_product_public_id := (v_item->>'product_id')::bigint;
    v_qty := (v_item->>'quantity')::integer;
    if v_qty <= 0 then raise exception 'invalid_quantity'; end if;

    select p.id, sp.id, p.sku, p.name, sp.price, i.on_hand, i.reserved
      into v_product_id, v_store_product_id, v_sku, v_product_name, v_price, v_on_hand, v_reserved
    from public.products p
    join public.store_products sp on sp.product_id = p.id and sp.store_id = v_store_id
    join public.inventory i on i.store_product_id = sp.id
    where p.public_id = v_product_public_id
      and p.active = true
      and sp.active = true
    for update of i;

    if not found then raise exception 'product_unavailable:%', v_product_public_id; end if;
    if (v_on_hand - v_reserved) < v_qty then raise exception 'insufficient_stock:%', v_product_name; end if;

    update public.inventory
       set reserved = reserved + v_qty, updated_at = now()
     where store_product_id = v_store_product_id;

    v_subtotal := v_subtotal + (v_price * v_qty);
    v_resolved := v_resolved || jsonb_build_array(jsonb_build_object(
      'product_id', v_product_public_id,
      'product_uuid', v_product_id,
      'store_product_id', v_store_product_id,
      'sku', v_sku,
      'product_name', v_product_name,
      'quantity', v_qty,
      'unit_price', v_price,
      'total_price', v_price * v_qty
    ));
  end loop;

  v_total := v_subtotal + v_delivery_fee;

  insert into public.customers (full_name, phone)
  values (trim(p_payload->'customer'->>'name'), trim(p_payload->'customer'->>'phone'))
  returning id into v_customer_id;

  insert into public.orders (
    store_id, customer_id, status, payment_method, payment_status,
    subtotal, delivery_fee, discount, total, notes,
    customer_name, customer_phone, postal_code, street, number, complement,
    neighborhood, city, state, address_reference
  ) values (
    v_store_id, v_customer_id, 'received', v_payment_method, v_payment_status,
    v_subtotal, v_delivery_fee, 0, v_total, nullif(trim(p_payload->>'notes'), ''),
    trim(p_payload->'customer'->>'name'), trim(p_payload->'customer'->>'phone'),
    trim(p_payload->'address'->>'postal_code'), trim(p_payload->'address'->>'street'),
    trim(p_payload->'address'->>'number'), nullif(trim(p_payload->'address'->>'complement'), ''),
    trim(p_payload->'address'->>'neighborhood'), trim(p_payload->'address'->>'city'),
    upper(left(trim(p_payload->'address'->>'state'), 2)), nullif(trim(p_payload->'address'->>'reference'), '')
  ) returning id, order_number, tracking_token into v_order_id, v_order_number, v_tracking_token;

  for v_item in select value from jsonb_array_elements(v_resolved)
  loop
    insert into public.order_items (
      order_id, store_product_id, product_id, sku, product_name, quantity, unit_price, total_price
    ) values (
      v_order_id,
      (v_item->>'store_product_id')::uuid,
      (v_item->>'product_uuid')::uuid,
      v_item->>'sku', v_item->>'product_name',
      (v_item->>'quantity')::integer,
      (v_item->>'unit_price')::numeric,
      (v_item->>'total_price')::numeric
    );
  end loop;

  insert into public.payments (order_id, method, status, amount, change_for)
  values (v_order_id, v_payment_method, v_payment_status, v_total, v_change_for);

  insert into public.order_status_history (order_id, status, note)
  values (v_order_id, 'received', 'Pedido criado pelo checkout');

  return jsonb_build_object(
    'id', v_order_id,
    'order_number', v_order_number,
    'tracking_token', v_tracking_token,
    'status', 'received',
    'subtotal', v_subtotal,
    'delivery_fee', v_delivery_fee,
    'total', v_total,
    'items', v_resolved
  );
end;
$$;

revoke execute on function public.create_order_v4(jsonb) from public, anon, authenticated;
grant execute on function public.create_order_v4(jsonb) to service_role;

-- Alteração de status + impacto no estoque em uma única transação.
create or replace function public.set_order_status_v4(
  p_order_id uuid,
  p_status public.order_status,
  p_note text default null,
  p_user_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_current public.order_status;
  v_item record;
begin
  select status into v_current from public.orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;
  if v_current = p_status then return jsonb_build_object('id', p_order_id, 'status', p_status); end if;
  if v_current in ('delivered','cancelled') then raise exception 'order_is_final'; end if;

  if p_status = 'picking' and v_current <> 'received' then raise exception 'invalid_transition'; end if;
  if p_status = 'ready' and v_current <> 'picking' then raise exception 'invalid_transition'; end if;
  if p_status = 'out_for_delivery' and v_current <> 'ready' then raise exception 'invalid_transition'; end if;
  if p_status = 'delivered' and v_current <> 'out_for_delivery' then raise exception 'invalid_transition'; end if;
  if p_status = 'cancelled' and v_current not in ('received','picking') then raise exception 'cannot_cancel_after_ready'; end if;

  if p_status = 'ready' then
    for v_item in select store_product_id, quantity from public.order_items where order_id = p_order_id order by store_product_id
    loop
      update public.inventory
         set on_hand = on_hand - v_item.quantity,
             reserved = reserved - v_item.quantity,
             updated_at = now()
       where store_product_id = v_item.store_product_id
         and reserved >= v_item.quantity
         and on_hand >= v_item.quantity;
      if not found then raise exception 'stock_consume_failed'; end if;
      insert into public.inventory_movements (store_product_id, movement_type, quantity, order_id, user_id, reason)
      values (v_item.store_product_id, 'sale', -v_item.quantity, p_order_id, p_user_id, 'Pedido separado e pronto');
    end loop;
  elsif p_status = 'cancelled' then
    for v_item in select store_product_id, quantity from public.order_items where order_id = p_order_id order by store_product_id
    loop
      update public.inventory
         set reserved = reserved - v_item.quantity, updated_at = now()
       where store_product_id = v_item.store_product_id and reserved >= v_item.quantity;
      if not found then raise exception 'stock_release_failed'; end if;
    end loop;
  end if;

  update public.orders
     set status = p_status,
         updated_at = now(),
         delivered_at = case when p_status = 'delivered' then now() else delivered_at end,
         cancellation_reason = case when p_status = 'cancelled' then coalesce(nullif(p_note,''), 'Cancelado pela operação') else cancellation_reason end,
         payment_status = case when p_status = 'delivered' then 'paid'::public.payment_status else payment_status end
   where id = p_order_id;

  if p_status = 'delivered' then
    update public.payments set status = 'paid', paid_at = coalesce(paid_at, now()) where order_id = p_order_id;
  elsif p_status = 'cancelled' then
    update public.payments set status = 'cancelled' where order_id = p_order_id and status <> 'paid';
  end if;

  insert into public.order_status_history (order_id, status, user_id, note)
  values (p_order_id, p_status, p_user_id, p_note);

  return jsonb_build_object('id', p_order_id, 'status', p_status);
end;
$$;

revoke execute on function public.set_order_status_v4(uuid, public.order_status, text, uuid) from public, anon, authenticated;
grant execute on function public.set_order_status_v4(uuid, public.order_status, text, uuid) to service_role;

-- Cadastro/edição de produto e saldo em uma transação.
create or replace function public.upsert_product_v4(
  p_store_slug text,
  p_public_id bigint,
  p_sku text,
  p_name text,
  p_category_name text,
  p_image_url text,
  p_price numeric,
  p_compare_at_price numeric,
  p_badge text,
  p_minimum_stock integer,
  p_stock integer,
  p_active boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_store_id uuid;
  v_category_id uuid;
  v_product_id uuid;
  v_store_product_id uuid;
  v_public_id bigint;
  v_reserved integer := 0;
  v_sku text;
begin
  if nullif(trim(p_name),'') is null or p_price < 0 or p_stock < 0 or p_minimum_stock < 0 then raise exception 'invalid_product'; end if;
  select id into v_store_id from public.stores where slug = p_store_slug;
  if v_store_id is null then raise exception 'store_not_found'; end if;
  select id into v_category_id from public.categories where lower(name) = lower(p_category_name) limit 1;
  if v_category_id is null then raise exception 'category_not_found'; end if;

  if p_public_id is null then
    v_sku := coalesce(nullif(upper(trim(p_sku)),''), 'WEB-' || upper(substr(md5(gen_random_uuid()::text),1,10)));
    insert into public.products (sku,name,category_id,image_url,active)
    values (v_sku,trim(p_name),v_category_id,nullif(trim(p_image_url),''),p_active)
    returning id,public_id into v_product_id,v_public_id;

    insert into public.store_products (store_id,product_id,price,compare_at_price,badge,minimum_stock,active)
    values (v_store_id,v_product_id,p_price,p_compare_at_price,coalesce(p_badge,''),p_minimum_stock,p_active)
    returning id into v_store_product_id;

    insert into public.inventory (store_product_id,on_hand,reserved) values (v_store_product_id,p_stock,0);
  else
    select id,public_id into v_product_id,v_public_id from public.products where public_id=p_public_id;
    if v_product_id is null then raise exception 'product_not_found'; end if;

    update public.products set
      sku = case when nullif(trim(p_sku),'') is null then sku else upper(trim(p_sku)) end,
      name=trim(p_name), category_id=v_category_id, image_url=nullif(trim(p_image_url),''), active=p_active, updated_at=now()
    where id=v_product_id;

    select id into v_store_product_id from public.store_products where store_id=v_store_id and product_id=v_product_id;
    if v_store_product_id is null then raise exception 'store_product_not_found'; end if;
    select reserved into v_reserved from public.inventory where store_product_id=v_store_product_id for update;
    if p_stock < coalesce(v_reserved,0) then raise exception 'stock_below_reserved'; end if;

    update public.store_products set price=p_price,compare_at_price=p_compare_at_price,badge=coalesce(p_badge,''),minimum_stock=p_minimum_stock,active=p_active,updated_at=now()
    where id=v_store_product_id;
    update public.inventory set on_hand=p_stock,updated_at=now() where store_product_id=v_store_product_id;
  end if;

  return jsonb_build_object('public_id',v_public_id,'product_id',v_product_id,'store_product_id',v_store_product_id);
end;
$$;

revoke execute on function public.upsert_product_v4(text,bigint,text,text,text,text,numeric,numeric,text,integer,integer,boolean) from public, anon, authenticated;
grant execute on function public.upsert_product_v4(text,bigint,text,text,text,text,numeric,numeric,text,integer,integer,boolean) to service_role;


-- ===== supabase/migrations/004_v4_catalog_seed.sql =====
-- Catálogo inicial V4. Executado uma única vez como migration.
with seed(sku,name,category_slug,image_url,price,compare_at_price,badge,stock,minimum_stock) as (
  values
  ('BEB-0001','Coca-Cola Original 2L','bebidas','https://www.powellsnl.ca/media/uploads/gs1/06700000427_20.png',10.99,12.49,'Oferta',18,5),
  ('BEB-0002','Guaraná Antarctica 2L','bebidas','https://m.media-amazon.com/images/I/61aFUMfXk2L._SL1000_.jpg',9.99,null,'Mais vendido',16,5),
  ('BEB-0003','Fanta Laranja 2L','bebidas','https://cdn.awsli.com.br/800x800/1847/1847175/produto/94341333/364c5bdfdd.jpg',9.49,null,'',14,5),
  ('BEB-0004','Água Crystal sem gás 1,5L','bebidas','https://elofarma.com.br/BACKOFFICE/Uploads/Produto/Normal/7894900530032.jpg',4.49,null,'',30,8),
  ('BEB-0005','Red Bull Energy Drink 250ml','bebidas','https://down-br.img.susercontent.com/file/de3905e6d774d25363e21ac6a2ff7297',9.99,11.49,'Madrugada',20,6),
  ('GEL-0001','Gelo 5 kg','gelo',null,7.50,null,'24h',12,6),
  ('SAL-0001','Doritos Queijo Nacho 120g','salgadinhos','https://carrefourbrfood.vtexassets.com/arquivos/ids/193842562/salgadinho-queijo-nacho-doritos-120g-1.jpg?v=638876002921530000',11.49,null,'Mais vendido',15,6),
  ('SAL-0002','Ruffles Original 76g','salgadinhos','https://bretas.vtexassets.com/arquivos/ids/200103/6571ccc5558925a4e889be4e.jpg?v=638375536084870000',9.49,null,'',13,5),
  ('BOM-0001','Oreo Original 154g','bomboniere','https://www.tuquetraes.com/imagenes/productos/productos_vipges/A01029037.JPG',6.99,null,'',22,6),
  ('BOM-0002','Bis ao Leite 100,8g','bomboniere','https://images.tcdn.com.br/img/img_prod/1377318/chocolate_bis_100_8g_ao_leite_169_1_bc46a4e81dee4e6402c7608e4f4802f0.jpg',7.99,null,'Queridinho',18,5),
  ('BOM-0003','Sonho de Valsa 20g','bomboniere','https://images.tcdn.com.br/img/img_prod/1225570/sonho_de_valsa_20g_unidade_1677_2_11a8326e492eefeba861a208a5e1bb40.png',2.49,null,'',35,10),
  ('BOM-0004','Halls Extra Forte 27,5g','bomboniere','https://destro.fbitsstatic.net/img/p/bala-halls-preta-extra-forte-27-5g-71233/257769-1.jpg?h=500&qs=ignore&v=202501231555&w=500',2.99,null,'',28,8),
  ('BOM-0005','Trident Menta 30,6g','bomboniere','https://ideaspapeleria.com/images/002852/large/4178_0.jpg',5.49,null,'',25,8),
  ('BOM-0006','Paçoquita Original 18g','bomboniere','https://images.deliveryhero.io/image/global-menu-service/GV_PT/vendor/880476/product/87f22b4a-fa21-4e8a-a43f-e1568f816443.jpg',1.49,null,'',40,12),
  ('BEB-0006','Toddy Original 200g','bebidas','https://images-food.ifcshop.com.br/produto/45684_0_20211118104651.jpg',8.99,null,'',10,4),
  ('HIG-0001','Colgate Máxima Proteção 90g','higiene','https://images.tcdn.com.br/img/img_prod/1017481/creme_dental_maxima_protecao_anticaries_90g_colgate_20613_1_30120a5aa824e4057f956a4181329195.jpg',6.99,null,'Essencial',14,5),
  ('HIG-0002','Sabonete Dove Original 90g','higiene','https://io.convertiez.com.br/m/farmaponte/shop/products/images/21679/medium/sabonete-dove-original-barra-com-90g_38313.png',5.99,null,'',17,5),
  ('LIM-0001','Detergente Ypê Neutro 500ml','limpeza','https://images.tcdn.com.br/img/img_prod/1234949/detergente_neutro_ype_500ml_1177_1_1bfd127b8d8fe6b7eb77d4aadcee2b5c.jpeg',3.49,null,'Essencial',18,5),
  ('HIG-0003','Papel Higiênico Neve 4 rolos','higiene','https://images.tcdn.com.br/img/img_prod/694926/papel_higienico_folha_dupla_pacote_c_4_neve_290008_1_71c81b5ab27764f559adb879a450f5bb.jpg',11.99,null,'Última hora',11,4),
  ('UTI-0001','Pilha Duracell AA 2 unidades','utilidades','https://cdn.awsli.com.br/2500x2500/2248/2248510/produto/180107250/pilha-alcalina-duracell-palito-aa-pacote-2u-1-5vmpeuc4gh.jpg',14.99,null,'Última hora',9,4)
), up_products as (
  insert into public.products (sku,name,category_id,image_url,active)
  select s.sku,s.name,c.id,s.image_url,true from seed s join public.categories c on c.slug=s.category_slug
  on conflict (sku) do update set name=excluded.name, category_id=excluded.category_id, image_url=excluded.image_url, active=true, updated_at=now()
  returning id,sku
), up_sp as (
  insert into public.store_products (store_id,product_id,price,compare_at_price,badge,minimum_stock,active)
  select st.id,p.id,s.price,s.compare_at_price,s.badge,s.minimum_stock,true
  from seed s join up_products p on p.sku=s.sku cross join public.stores st where st.slug='piedade'
  on conflict (store_id,product_id) do update set price=excluded.price,compare_at_price=excluded.compare_at_price,badge=excluded.badge,minimum_stock=excluded.minimum_stock,active=true,updated_at=now()
  returning id,product_id
)
insert into public.inventory (store_product_id,on_hand,reserved)
select sp.id,s.stock,0
from up_sp sp join public.products p on p.id=sp.product_id join seed s on s.sku=p.sku
on conflict (store_product_id) do nothing;
