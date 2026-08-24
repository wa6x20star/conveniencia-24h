-- Conveniência 24h — V5 Controle de Estoque
-- Execute DEPOIS do V4_INSTALL.sql no SQL Editor do mesmo projeto Supabase.
-- Pode ser executado novamente: a função é substituída de forma segura.

create or replace function public.adjust_inventory_v5(
  p_store_product_id uuid,
  p_action text,
  p_quantity integer default null,
  p_target_on_hand integer default null,
  p_reason text default null,
  p_user_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_on_hand integer;
  v_reserved integer;
  v_new_on_hand integer;
  v_delta integer;
  v_type public.inventory_movement_type;
begin
  if p_action not in ('entry','loss','damage','adjustment','inventory') then
    raise exception 'invalid_action';
  end if;

  select on_hand, reserved
    into v_on_hand, v_reserved
  from public.inventory
  where store_product_id = p_store_product_id
  for update;

  if not found then raise exception 'inventory_not_found'; end if;

  if p_action = 'entry' then
    if p_quantity is null or p_quantity <= 0 then raise exception 'quantity_must_be_positive'; end if;
    v_delta := p_quantity;
    v_new_on_hand := v_on_hand + p_quantity;
    v_type := 'entry';

  elsif p_action in ('loss','damage') then
    if p_quantity is null or p_quantity <= 0 then raise exception 'quantity_must_be_positive'; end if;
    if (v_on_hand - v_reserved) < p_quantity then raise exception 'insufficient_available_stock'; end if;
    v_delta := -p_quantity;
    v_new_on_hand := v_on_hand - p_quantity;
    v_type := p_action::public.inventory_movement_type;

  else
    if p_target_on_hand is null or p_target_on_hand < 0 then raise exception 'target_stock_invalid'; end if;
    if p_target_on_hand < v_reserved then raise exception 'stock_below_reserved'; end if;
    v_new_on_hand := p_target_on_hand;
    v_delta := p_target_on_hand - v_on_hand;
    v_type := case when p_action = 'inventory' then 'inventory'::public.inventory_movement_type else 'adjustment'::public.inventory_movement_type end;
  end if;

  if v_delta = 0 then
    return jsonb_build_object(
      'store_product_id', p_store_product_id,
      'on_hand', v_on_hand,
      'reserved', v_reserved,
      'available', v_on_hand - v_reserved,
      'changed', false
    );
  end if;

  update public.inventory
     set on_hand = v_new_on_hand,
         updated_at = now()
   where store_product_id = p_store_product_id;

  insert into public.inventory_movements (
    store_product_id, movement_type, quantity, user_id, reason
  ) values (
    p_store_product_id,
    v_type,
    v_delta,
    p_user_id,
    nullif(trim(coalesce(p_reason,'')), '')
  );

  insert into public.audit_logs (user_id, action, entity_type, entity_id, metadata)
  values (
    p_user_id,
    'inventory_' || p_action,
    'store_product',
    p_store_product_id::text,
    jsonb_build_object(
      'before', v_on_hand,
      'after', v_new_on_hand,
      'reserved', v_reserved,
      'delta', v_delta,
      'reason', p_reason
    )
  );

  return jsonb_build_object(
    'store_product_id', p_store_product_id,
    'on_hand', v_new_on_hand,
    'reserved', v_reserved,
    'available', v_new_on_hand - v_reserved,
    'delta', v_delta,
    'changed', true
  );
end;
$$;

revoke execute on function public.adjust_inventory_v5(uuid,text,integer,integer,text,uuid) from public, anon, authenticated;
grant execute on function public.adjust_inventory_v5(uuid,text,integer,integer,text,uuid) to service_role;
