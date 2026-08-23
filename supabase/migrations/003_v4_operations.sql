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
