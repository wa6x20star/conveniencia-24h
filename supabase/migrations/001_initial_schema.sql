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
