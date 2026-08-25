-- Conveniência 24h — V6.5 Logística e Entregas
-- Executar APÓS V6_4_SECURITY_HARDENING.sql
-- Idempotente para reaplicação segura.

begin;

-- =========================================================
-- 0) Integridade do estoque legado
-- =========================================================

-- Reparo seguro para produtos antigos que possam não ter linha de estoque.
insert into public.inventory (store_product_id,on_hand,reserved)
select sp.id,0,0
from public.store_products sp
left join public.inventory i on i.store_product_id=sp.id
where i.store_product_id is null
on conflict (store_product_id) do nothing;

-- =========================================================
-- 1) Configuração de origem e regras de frete por distância
-- =========================================================
create table if not exists public.delivery_settings (
  store_id uuid primary key references public.stores(id) on delete cascade,
  origin_postal_code text,
  origin_street text,
  origin_number text,
  origin_neighborhood text,
  origin_city text,
  origin_state text,
  origin_latitude numeric(10,7),
  origin_longitude numeric(10,7),
  free_delivery_enabled boolean not null default true,
  free_delivery_from numeric(12,2) not null default 50 check (free_delivery_from >= 0),
  max_distance_km numeric(8,2) not null default 10 check (max_distance_km > 0),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.delivery_distance_rules (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  min_km numeric(8,2) not null default 0 check (min_km >= 0),
  max_km numeric(8,2) not null check (max_km > min_km),
  customer_fee numeric(12,2) not null check (customer_fee >= 0),
  driver_payout numeric(12,2) not null default 0 check (driver_payout >= 0),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id, min_km, max_km)
);

alter table public.delivery_settings enable row level security;
alter table public.delivery_distance_rules enable row level security;
revoke all on table public.delivery_settings from public, anon, authenticated;
grant select, insert, update, delete on table public.delivery_settings to service_role;
revoke all on table public.delivery_distance_rules from public, anon, authenticated;
grant select on table public.delivery_distance_rules to anon, authenticated;
grant select, insert, update, delete on table public.delivery_distance_rules to service_role;

-- Leitura pública apenas das regras comerciais; origem exata da loja fica server-side.
drop policy if exists delivery_distance_rules_public_read on public.delivery_distance_rules;
create policy delivery_distance_rules_public_read on public.delivery_distance_rules
  for select to anon, authenticated
  using (active = true);

-- =========================================================
-- 2) Dados calculados no pedido / entrega
-- =========================================================
alter table public.orders add column if not exists delivery_distance_km numeric(8,2);
alter table public.orders add column if not exists delivery_quote_source text;
alter table public.orders add column if not exists driver_payout numeric(12,2) not null default 0;

alter table public.deliveries add column if not exists distance_km numeric(8,2);
alter table public.deliveries add column if not exists customer_fee numeric(12,2) not null default 0;
alter table public.deliveries add column if not exists driver_payout numeric(12,2) not null default 0;
alter table public.deliveries add column if not exists assigned_by uuid references auth.users(id) on delete set null;

create index if not exists idx_orders_ready_delivery on public.orders(store_id, status, created_at desc);
create index if not exists idx_deliveries_active_driver on public.deliveries(driver_id, status, assigned_at desc);

-- =========================================================
-- 3) Seed de configuração e faixas padrão
-- =========================================================
insert into public.delivery_settings (store_id, free_delivery_enabled, free_delivery_from, max_distance_km)
select id, true, 50, 10
from public.stores
on conflict (store_id) do nothing;

insert into public.delivery_distance_rules (store_id,min_km,max_km,customer_fee,driver_payout,sort_order)
select s.id, x.min_km, x.max_km, x.customer_fee, x.driver_payout, x.sort_order
from public.stores s
cross join (values
  (0.00::numeric, 2.00::numeric, 5.00::numeric, 4.00::numeric, 10),
  (2.00::numeric, 4.00::numeric, 7.00::numeric, 5.00::numeric, 20),
  (4.00::numeric, 6.00::numeric, 9.00::numeric, 6.00::numeric, 30),
  (6.00::numeric, 8.00::numeric,12.00::numeric, 8.00::numeric, 40),
  (8.00::numeric,10.00::numeric,15.00::numeric,10.00::numeric, 50)
) as x(min_km,max_km,customer_fee,driver_payout,sort_order)
on conflict (store_id,min_km,max_km) do nothing;

-- =========================================================
-- 3.5) Salvar configuração de frete em uma única transação
-- =========================================================
create or replace function public.save_delivery_settings_v65(
  p_store_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_rule jsonb;
  v_count integer := 0;
begin
  if not exists(select 1 from public.stores where id=p_store_id) then raise exception 'store_not_found'; end if;
  if jsonb_typeof(p_payload->'rules') <> 'array' then raise exception 'rules_invalid'; end if;

  insert into public.delivery_settings(
    store_id,origin_postal_code,origin_street,origin_number,origin_neighborhood,origin_city,origin_state,
    origin_latitude,origin_longitude,free_delivery_enabled,free_delivery_from,max_distance_km,active,updated_at
  ) values (
    p_store_id,p_payload->>'origin_postal_code',p_payload->>'origin_street',p_payload->>'origin_number',p_payload->>'origin_neighborhood',
    p_payload->>'origin_city',p_payload->>'origin_state',(p_payload->>'origin_latitude')::numeric,(p_payload->>'origin_longitude')::numeric,
    coalesce((p_payload->>'free_delivery_enabled')::boolean,true),(p_payload->>'free_delivery_from')::numeric,
    (p_payload->>'max_distance_km')::numeric,true,now()
  )
  on conflict(store_id) do update set
    origin_postal_code=excluded.origin_postal_code,origin_street=excluded.origin_street,origin_number=excluded.origin_number,
    origin_neighborhood=excluded.origin_neighborhood,origin_city=excluded.origin_city,origin_state=excluded.origin_state,
    origin_latitude=excluded.origin_latitude,origin_longitude=excluded.origin_longitude,
    free_delivery_enabled=excluded.free_delivery_enabled,free_delivery_from=excluded.free_delivery_from,
    max_distance_km=excluded.max_distance_km,active=true,updated_at=now();

  delete from public.delivery_distance_rules where store_id=p_store_id;
  for v_rule in select value from jsonb_array_elements(p_payload->'rules')
  loop
    if (v_rule->>'min_km')::numeric < 0 or (v_rule->>'max_km')::numeric <= (v_rule->>'min_km')::numeric
       or (v_rule->>'customer_fee')::numeric < 0 or (v_rule->>'driver_payout')::numeric < 0 then
      raise exception 'rules_invalid';
    end if;
    v_count := v_count + 1;
    insert into public.delivery_distance_rules(store_id,min_km,max_km,customer_fee,driver_payout,sort_order,active)
    values(p_store_id,(v_rule->>'min_km')::numeric,(v_rule->>'max_km')::numeric,(v_rule->>'customer_fee')::numeric,
      (v_rule->>'driver_payout')::numeric,v_count*10,coalesce((v_rule->>'active')::boolean,true));
  end loop;
  if v_count=0 then raise exception 'rules_invalid'; end if;
  return jsonb_build_object('ok',true,'rules',v_count);
end;
$$;

revoke execute on function public.save_delivery_settings_v65(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.save_delivery_settings_v65(uuid,jsonb) to service_role;

-- =========================================================
-- 4) Pedido V6.5: V6.4 + snapshot da logística
-- =========================================================
create or replace function public.create_order_v65(p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_result jsonb;
  v_order_id uuid;
  v_distance numeric(8,2);
  v_driver_payout numeric(12,2);
  v_source text;
begin
  v_result := public.create_order_v64(p_payload);
  v_order_id := (v_result->>'id')::uuid;

  begin
    v_distance := nullif(p_payload->>'delivery_distance_km','')::numeric;
  exception when others then
    v_distance := null;
  end;

  begin
    v_driver_payout := greatest(coalesce(nullif(p_payload->>'driver_payout','')::numeric, 0), 0);
  exception when others then
    v_driver_payout := 0;
  end;

  v_source := nullif(left(trim(coalesce(p_payload->>'delivery_quote_source','')), 40), '');

  update public.orders
     set delivery_distance_km = v_distance,
         delivery_quote_source = v_source,
         driver_payout = v_driver_payout,
         updated_at = now()
   where id = v_order_id
     and delivery_quote_source is null;

  select delivery_distance_km, delivery_quote_source, driver_payout
    into v_distance, v_source, v_driver_payout
  from public.orders where id=v_order_id;

  return v_result || jsonb_build_object(
    'delivery_distance_km', v_distance,
    'delivery_quote_source', v_source,
    'driver_payout', v_driver_payout
  );
end;
$$;

revoke execute on function public.create_order_v65(jsonb) from public, anon, authenticated;
grant execute on function public.create_order_v65(jsonb) to service_role;

-- =========================================================
-- 5) Atribuição transacional de entregador
-- =========================================================
create or replace function public.assign_delivery_v65(
  p_order_id uuid,
  p_driver_id uuid,
  p_user_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_driver public.drivers%rowtype;
  v_delivery_id uuid;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;
  if v_order.status <> 'ready' then raise exception 'order_not_ready'; end if;

  if exists(select 1 from public.deliveries where order_id = p_order_id and status <> 'cancelled') then
    raise exception 'delivery_already_assigned';
  end if;

  select * into v_driver from public.drivers where id = p_driver_id for update;
  if not found or not v_driver.active then raise exception 'driver_not_found'; end if;
  if v_driver.store_id <> v_order.store_id then raise exception 'driver_wrong_store'; end if;
  if v_driver.status = 'offline' then raise exception 'driver_offline'; end if;

  if exists(select 1 from public.deliveries where driver_id = p_driver_id and status in ('assigned','started')) then
    raise exception 'driver_busy';
  end if;

  insert into public.deliveries (
    order_id, driver_id, status, distance_km, customer_fee, driver_payout, assigned_by
  ) values (
    p_order_id, p_driver_id, 'assigned', v_order.delivery_distance_km,
    v_order.delivery_fee, v_order.driver_payout, p_user_id
  ) returning id into v_delivery_id;

  update public.drivers set status='delivering', updated_at=now() where id=p_driver_id;

  insert into public.audit_logs(user_id, action, entity_type, entity_id, metadata)
  values (p_user_id, 'delivery_assigned', 'delivery', v_delivery_id::text,
    jsonb_build_object('order_id',p_order_id,'driver_id',p_driver_id));

  return jsonb_build_object('id',v_delivery_id,'order_id',p_order_id,'driver_id',p_driver_id,'status','assigned');
end;
$$;

revoke execute on function public.assign_delivery_v65(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.assign_delivery_v65(uuid,uuid,uuid) to service_role;

-- =========================================================
-- 6) Fluxo do entregador: iniciar / concluir
-- =========================================================
create or replace function public.set_delivery_status_v65(
  p_delivery_id uuid,
  p_status public.delivery_status,
  p_user_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_delivery public.deliveries%rowtype;
  v_result jsonb;
begin
  select * into v_delivery from public.deliveries where id = p_delivery_id for update;
  if not found then raise exception 'delivery_not_found'; end if;
  if v_delivery.status in ('delivered','cancelled') then raise exception 'delivery_is_final'; end if;

  if p_status = 'started' then
    if v_delivery.status <> 'assigned' then raise exception 'invalid_delivery_transition'; end if;
    v_result := public.set_order_status_v64(v_delivery.order_id, 'out_for_delivery', 'Saiu para entrega', p_user_id);
    update public.deliveries set status='started', started_at=now(), updated_at=now() where id=p_delivery_id;
    update public.drivers set status='delivering', updated_at=now() where id=v_delivery.driver_id;
  elsif p_status = 'delivered' then
    if v_delivery.status <> 'started' then raise exception 'invalid_delivery_transition'; end if;
    v_result := public.set_order_status_v64(v_delivery.order_id, 'delivered', 'Entrega confirmada pelo entregador', p_user_id);
    update public.deliveries set status='delivered', delivered_at=now(), updated_at=now() where id=p_delivery_id;
    update public.drivers set status='available', updated_at=now() where id=v_delivery.driver_id;
  elsif p_status = 'cancelled' then
    -- Cancelar a atribuição não cancela o pedido: ele volta a aguardar outro entregador em status READY.
    if v_delivery.status <> 'assigned' then raise exception 'cannot_unassign_started_delivery'; end if;
    update public.deliveries set status='cancelled', updated_at=now() where id=p_delivery_id;
    update public.drivers set status='available', updated_at=now() where id=v_delivery.driver_id and status <> 'offline';
    v_result := jsonb_build_object('id',v_delivery.order_id,'status','ready');
  else
    raise exception 'invalid_delivery_status';
  end if;

  insert into public.audit_logs(user_id, action, entity_type, entity_id, metadata)
  values (p_user_id, 'delivery_status_changed', 'delivery', p_delivery_id::text,
    jsonb_build_object('status',p_status,'order_id',v_delivery.order_id));

  return jsonb_build_object('id',p_delivery_id,'order_id',v_delivery.order_id,'status',p_status,'order',v_result);
end;
$$;

revoke execute on function public.set_delivery_status_v65(uuid,public.delivery_status,uuid) from public, anon, authenticated;
grant execute on function public.set_delivery_status_v65(uuid,public.delivery_status,uuid) to service_role;

-- Mutação continua API-only; entregadores leem somente sua própria entrega via API/RLS.
drop policy if exists deliveries_driver_update on public.deliveries;

commit;
