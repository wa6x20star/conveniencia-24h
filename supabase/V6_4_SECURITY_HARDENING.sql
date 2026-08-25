-- Conveniência 24h — V6.4 Security Hardening
-- Execute DEPOIS de V4_INSTALL.sql e V5_STOCK_CONTROL.sql.
-- Esta migration é idempotente e foi desenhada para ser executada antes do deploy da V6.4.

begin;

-- =========================================================
-- 1) Pedidos idempotentes + validade da reserva
-- =========================================================
alter table public.orders
  add column if not exists client_order_key uuid,
  add column if not exists reservation_expires_at timestamptz;

create unique index if not exists uq_orders_client_order_key
  on public.orders(client_order_key)
  where client_order_key is not null;

create index if not exists idx_orders_reservation_expiry
  on public.orders(status, reservation_expires_at)
  where status = 'received' and reservation_expires_at is not null;

-- Pedidos antigos que ainda estejam em "received" ganham uma janela curta para não ficarem reservados para sempre.
update public.orders
set reservation_expires_at = now() + interval '5 minutes'
where status = 'received' and reservation_expires_at is null;

-- =========================================================
-- 2) Rate limit persistente no banco (não depende da memória da Vercel)
-- =========================================================
create table if not exists public.api_rate_limits (
  scope text not null,
  fingerprint_hash text not null,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  blocked_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (scope, fingerprint_hash)
);

alter table public.api_rate_limits enable row level security;
revoke all on table public.api_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.api_rate_limits to service_role;

create or replace function public.check_rate_limit_v64(
  p_scope text,
  p_fingerprint_hash text,
  p_limit integer,
  p_window_seconds integer,
  p_block_seconds integer
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_window_started_at timestamptz;
  v_count integer;
  v_blocked_until timestamptz;
  v_new_count integer;
  v_retry integer;
begin
  if nullif(trim(p_scope), '') is null or length(p_scope) > 60 then raise exception 'invalid_rate_scope'; end if;
  if p_fingerprint_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid_rate_fingerprint'; end if;
  if p_limit < 1 or p_limit > 1000 then raise exception 'invalid_rate_limit'; end if;
  if p_window_seconds < 10 or p_window_seconds > 86400 then raise exception 'invalid_rate_window'; end if;
  if p_block_seconds < 10 or p_block_seconds > 86400 then raise exception 'invalid_rate_block'; end if;

  insert into public.api_rate_limits(scope, fingerprint_hash, window_started_at, request_count, updated_at)
  values (p_scope, p_fingerprint_hash, v_now, 0, v_now)
  on conflict (scope, fingerprint_hash) do nothing;

  select window_started_at, request_count, blocked_until
    into v_window_started_at, v_count, v_blocked_until
  from public.api_rate_limits
  where scope = p_scope and fingerprint_hash = p_fingerprint_hash
  for update;

  if v_blocked_until is not null and v_blocked_until > v_now then
    v_retry := greatest(1, ceil(extract(epoch from (v_blocked_until - v_now)))::integer);
    return jsonb_build_object('allowed', false, 'remaining', 0, 'retry_after_seconds', v_retry);
  end if;

  if v_window_started_at <= v_now - make_interval(secs => p_window_seconds) then
    update public.api_rate_limits
       set window_started_at = v_now,
           request_count = 1,
           blocked_until = null,
           updated_at = v_now
     where scope = p_scope and fingerprint_hash = p_fingerprint_hash;
    return jsonb_build_object('allowed', true, 'remaining', greatest(p_limit - 1, 0), 'retry_after_seconds', 0);
  end if;

  if v_count >= p_limit then
    v_blocked_until := v_now + make_interval(secs => p_block_seconds);
    update public.api_rate_limits
       set blocked_until = v_blocked_until,
           updated_at = v_now
     where scope = p_scope and fingerprint_hash = p_fingerprint_hash;
    return jsonb_build_object('allowed', false, 'remaining', 0, 'retry_after_seconds', p_block_seconds);
  end if;

  v_new_count := v_count + 1;
  update public.api_rate_limits
     set request_count = v_new_count,
         blocked_until = null,
         updated_at = v_now
   where scope = p_scope and fingerprint_hash = p_fingerprint_hash;

  return jsonb_build_object('allowed', true, 'remaining', greatest(p_limit - v_new_count, 0), 'retry_after_seconds', 0);
end;
$$;

revoke execute on function public.check_rate_limit_v64(text,text,integer,integer,integer) from public, anon, authenticated;
grant execute on function public.check_rate_limit_v64(text,text,integer,integer,integer) to service_role;

-- =========================================================
-- 3) Criação idempotente do pedido usando a transação V4 já testada
-- =========================================================
create or replace function public.create_order_v64(p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_key uuid;
  v_existing public.orders%rowtype;
  v_result jsonb;
  v_items jsonb;
  v_expiry timestamptz;
begin
  begin
    v_key := nullif(p_payload->>'client_order_key', '')::uuid;
  exception when others then
    raise exception 'invalid_client_order_key';
  end;

  if v_key is null then raise exception 'invalid_client_order_key'; end if;

  -- Serializa tentativas repetidas do mesmo checkout.
  perform pg_advisory_xact_lock(hashtextextended(v_key::text, 0));

  select * into v_existing
  from public.orders
  where client_order_key = v_key;

  if found then
    select coalesce(jsonb_agg(jsonb_build_object(
      'product_id', p.public_id,
      'product_uuid', oi.product_id,
      'store_product_id', oi.store_product_id,
      'sku', oi.sku,
      'product_name', oi.product_name,
      'quantity', oi.quantity,
      'unit_price', oi.unit_price,
      'total_price', oi.total_price
    ) order by oi.created_at), '[]'::jsonb)
      into v_items
    from public.order_items oi
    left join public.products p on p.id = oi.product_id
    where oi.order_id = v_existing.id;

    return jsonb_build_object(
      'id', v_existing.id,
      'order_number', v_existing.order_number,
      'tracking_token', v_existing.tracking_token,
      'status', v_existing.status,
      'subtotal', v_existing.subtotal,
      'delivery_fee', v_existing.delivery_fee,
      'total', v_existing.total,
      'reservation_expires_at', v_existing.reservation_expires_at,
      'items', v_items
    );
  end if;

  v_result := public.create_order_v4(p_payload);
  v_expiry := now() + interval '15 minutes';

  update public.orders
     set client_order_key = v_key,
         reservation_expires_at = v_expiry,
         updated_at = now()
   where id = (v_result->>'id')::uuid;

  return v_result || jsonb_build_object('reservation_expires_at', v_expiry);
end;
$$;

revoke execute on function public.create_order_v64(jsonb) from public, anon, authenticated;
grant execute on function public.create_order_v64(jsonb) to service_role;

-- =========================================================
-- 4) Liberação automática de reservas abandonadas
-- =========================================================
create or replace function public.expire_stale_orders_v64()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order record;
  v_item record;
  v_expired integer := 0;
begin
  for v_order in
    select id
    from public.orders
    where status = 'received'
      and reservation_expires_at is not null
      and reservation_expires_at <= now()
    order by reservation_expires_at
    for update skip locked
  loop
    for v_item in
      select store_product_id, quantity
      from public.order_items
      where order_id = v_order.id and store_product_id is not null
      order by store_product_id
    loop
      update public.inventory
         set reserved = greatest(0, reserved - v_item.quantity),
             updated_at = now()
       where store_product_id = v_item.store_product_id;
    end loop;

    update public.orders
       set status = 'cancelled',
           payment_status = case when payment_status = 'paid' then payment_status else 'cancelled'::public.payment_status end,
           cancellation_reason = 'Reserva expirada automaticamente',
           reservation_expires_at = null,
           updated_at = now()
     where id = v_order.id;

    update public.payments
       set status = case when status = 'paid' then status else 'cancelled'::public.payment_status end
     where order_id = v_order.id;

    insert into public.order_status_history(order_id, status, note)
    values (v_order.id, 'cancelled', 'Reserva expirada automaticamente após 15 minutos sem início da separação');

    insert into public.audit_logs(action, entity_type, entity_id, metadata)
    values ('order_reservation_expired', 'order', v_order.id::text, jsonb_build_object('reason', 'timeout'));

    v_expired := v_expired + 1;
  end loop;

  -- Evita crescimento infinito da tabela de rate limit.
  delete from public.api_rate_limits
  where updated_at < now() - interval '2 days'
    and (blocked_until is null or blocked_until < now() - interval '1 day');

  return jsonb_build_object('expired', v_expired);
end;
$$;

revoke execute on function public.expire_stale_orders_v64() from public, anon, authenticated;
grant execute on function public.expire_stale_orders_v64() to service_role;

-- =========================================================
-- 5) Wrapper de status: mantém a lógica V4 e encerra a janela de reserva
-- =========================================================
create or replace function public.set_order_status_v64(
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
  v_result jsonb;
begin
  v_result := public.set_order_status_v4(p_order_id, p_status, left(p_note, 300), p_user_id);

  if p_status <> 'received' then
    update public.orders set reservation_expires_at = null where id = p_order_id;
  end if;

  insert into public.audit_logs(user_id, action, entity_type, entity_id, metadata)
  values (p_user_id, 'order_status_changed', 'order', p_order_id::text, jsonb_build_object('status', p_status, 'note', left(p_note, 300)));

  return v_result;
end;
$$;

revoke execute on function public.set_order_status_v64(uuid, public.order_status, text, uuid) from public, anon, authenticated;
grant execute on function public.set_order_status_v64(uuid, public.order_status, text, uuid) to service_role;

-- =========================================================
-- 6) API-only para mutações administrativas
-- A interface continua lendo/escrevendo via rotas protegidas do Next.js.
-- =========================================================
drop policy if exists staff_orders_update on public.orders;
drop policy if exists staff_order_items_update on public.order_items;
drop policy if exists staff_history_insert on public.order_status_history;
drop policy if exists staff_products_manage on public.products;
drop policy if exists staff_store_products_manage on public.store_products;
drop policy if exists admin_inventory_update on public.inventory;
drop policy if exists admin_movements_insert on public.inventory_movements;
drop policy if exists deliveries_driver_update on public.deliveries;

-- O cliente público não precisa conhecer "on_hand" e "reserved" diretamente.
drop policy if exists inventory_public_read on public.inventory;

-- =========================================================
-- 7) Storage: somente formatos de imagem que validamos no backend
-- =========================================================
update storage.buckets
set public = true,
    file_size_limit = 5000000,
    allowed_mime_types = array['image/jpeg','image/png','image/webp']
where id = 'product-images';

commit;
