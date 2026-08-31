-- V6.8.4: cancelamento e estorno em transações, acesso somente pelo servidor.
begin;

-- Uma atribuição cancelada permanece no histórico e não impede a próxima.
alter table public.deliveries drop constraint if exists deliveries_order_id_key;
create unique index if not exists uq_deliveries_order_active on public.deliveries(order_id) where status <> 'cancelled';

alter table public.orders
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references auth.users(id) on delete set null,
  add column if not exists cancellation_source text,
  add column if not exists stock_recovered_at timestamptz,
  add column if not exists refund_status text not null default 'not_required'
    check (refund_status in ('not_required','pending','completed')),
  add column if not exists refund_amount numeric(12,2) not null default 0 check (refund_amount >= 0),
  add column if not exists refunded_at timestamptz,
  add column if not exists refunded_by uuid references auth.users(id) on delete set null,
  add column if not exists refund_reference text;

create index if not exists idx_orders_refund_pending on public.orders(store_id, cancelled_at)
  where refund_status = 'pending';
create index if not exists idx_orders_cancelled_at on public.orders(store_id, cancelled_at desc)
  where status = 'cancelled';

-- Apenas classifica pendências históricas; NÃO devolve estoque de cancelamentos antigos.
update public.orders o set refund_status = 'pending', refund_amount = o.total
where o.status = 'cancelled' and o.refund_status = 'not_required'
  and (o.payment_status = 'paid' or exists(select 1 from public.payments p where p.order_id=o.id and p.status='paid'));

create or replace function public.cancel_order_v684(
  p_order_id uuid, p_reason text, p_user_id uuid default null,
  p_stock_returned boolean default false, p_source text default 'staff'
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_order public.orders%rowtype;
  v_item record;
  v_driver_id uuid;
  v_paid boolean;
  v_reason text := btrim(coalesce(p_reason,''));
begin
  if char_length(v_reason) < 3 or char_length(v_reason) > 300 then raise exception 'cancellation_reason_required'; end if;
  if p_source is null or p_source not in ('staff','reservation_expired') then raise exception 'invalid_cancellation_source'; end if;
  if p_source = 'staff' and p_user_id is null then raise exception 'cancellation_actor_required'; end if;
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;
  if v_order.status = 'cancelled' then
    return jsonb_build_object('id',p_order_id,'status','cancelled','already_cancelled',true,'refund_status',v_order.refund_status);
  end if;
  if v_order.status = 'delivered' or v_order.delivered_at is not null then raise exception 'cannot_cancel_delivered'; end if;
  if v_order.status not in ('received','picking','ready','out_for_delivery') then raise exception 'invalid_transition'; end if;
  if p_source = 'reservation_expired' and (v_order.status <> 'received' or v_order.reservation_expires_at is null or v_order.reservation_expires_at > now()) then
    raise exception 'reservation_not_expired';
  end if;

  -- Ordem de bloqueio compartilhada com atribuição, confirmação, comprovantes e repasses.
  perform 1 from public.deliveries where order_id=p_order_id order by id for update;
  perform 1 from public.delivery_confirmations where order_id=p_order_id for update;
  perform 1 from public.payments where order_id=p_order_id order by id for update;
  if exists(select 1 from public.deliveries where order_id=p_order_id and (status='delivered' or delivered_at is not null))
    or exists(select 1 from public.delivery_confirmations where order_id=p_order_id and (confirmed_at is not null or status in ('code_confirmed','proof_approved')))
    then raise exception 'cannot_cancel_delivered'; end if;
  if exists(select 1 from public.driver_payout_items pi join public.deliveries d on d.id=pi.delivery_id where d.order_id=p_order_id)
    then raise exception 'cannot_cancel_paid_delivery'; end if;
  if (v_order.status='out_for_delivery' or exists(select 1 from public.deliveries where order_id=p_order_id and status='started'))
    and p_stock_returned is not true then raise exception 'stock_return_confirmation_required'; end if;

  v_paid := v_order.payment_status='paid'
    or exists(select 1 from public.payments where order_id=p_order_id and status='paid')
    or exists(select 1 from public.delivery_confirmations where order_id=p_order_id and payment_confirmed);
  if exists(select 1 from public.order_items where order_id=p_order_id and store_product_id is null)
    then raise exception 'stock_product_missing'; end if;

  for v_item in select store_product_id, sum(quantity)::integer as quantity from public.order_items
    where order_id=p_order_id group by store_product_id order by store_product_id
  loop
    if v_order.status in ('received','picking') then
      update public.inventory set reserved=reserved-v_item.quantity, updated_at=now()
        where store_product_id=v_item.store_product_id and reserved>=v_item.quantity;
      if not found then raise exception 'stock_release_failed'; end if;
    else
      update public.inventory set on_hand=on_hand+v_item.quantity, updated_at=now()
        where store_product_id=v_item.store_product_id;
      if not found then raise exception 'stock_recovery_failed'; end if;
      insert into public.inventory_movements(store_product_id,movement_type,quantity,order_id,user_id,reason)
        values(v_item.store_product_id,'cancellation',v_item.quantity,p_order_id,p_user_id,'Devolução por cancelamento: '||v_reason);
    end if;
  end loop;

  -- Conserva o vínculo histórico, mas encerra a atribuição e zera a remuneração prevista.
  update public.deliveries set status='cancelled',driver_payout=0,updated_at=now()
    where order_id=p_order_id and status in ('assigned','started');
  for v_driver_id in select distinct driver_id from public.deliveries where order_id=p_order_id order by driver_id loop
    update public.drivers set status='available',updated_at=now()
      where id=v_driver_id and status='delivering'
      and not exists(select 1 from public.deliveries where driver_id=v_driver_id and status in ('assigned','started'));
  end loop;
  update public.delivery_confirmations set status='proof_rejected',locked_until=null,
    reviewed_at=now(),reviewed_by=p_user_id,review_note='Pedido cancelado; comprovação encerrada',updated_at=now()
    where order_id=p_order_id and status not in ('code_confirmed','proof_approved');

  update public.orders set status='cancelled',cancellation_reason=v_reason,cancelled_at=now(),cancelled_by=p_user_id,
    cancellation_source=p_source,stock_recovered_at=now(),reservation_expires_at=null,
    payment_status=case when v_paid then 'paid'::public.payment_status else 'cancelled'::public.payment_status end,
    refund_status=case when v_paid then 'pending' else 'not_required' end,
    refund_amount=case when v_paid then total else 0 end,updated_at=now()
    where id=p_order_id;
  update public.payments set status='cancelled' where order_id=p_order_id and status<>'paid';
  insert into public.order_status_history(order_id,status,user_id,note) values(p_order_id,'cancelled',p_user_id,v_reason);
  insert into public.audit_logs(user_id,action,entity_type,entity_id,metadata)
    values(p_user_id,'order_cancelled','order',p_order_id::text,jsonb_build_object(
      'previous_status',v_order.status,'reason',v_reason,'source',p_source,'cancelled_at',now(),
      'stock_action',case when v_order.status in ('received','picking') then 'release_reservation' else 'restore_on_hand' end,
      'stock_return_confirmed',p_stock_returned,'refund_status',case when v_paid then 'pending' else 'not_required' end,
      'refund_amount',case when v_paid then v_order.total else 0 end));
  return jsonb_build_object('id',p_order_id,'status','cancelled','refund_status',case when v_paid then 'pending' else 'not_required' end);
end;
$$;
revoke all on function public.cancel_order_v684(uuid,text,uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.cancel_order_v684(uuid,text,uuid,boolean,text) to service_role;

create or replace function public.complete_order_refund_v684(p_order_id uuid,p_reference text,p_user_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_order public.orders%rowtype;
begin
  if p_user_id is null then raise exception 'refund_actor_required'; end if;
  if char_length(btrim(coalesce(p_reference,''))) not between 3 and 300 then raise exception 'refund_reference_required'; end if;
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;
  if v_order.status<>'cancelled' then raise exception 'refund_requires_cancelled_order'; end if;
  if v_order.refund_status='completed' then return jsonb_build_object('id',p_order_id,'refund_status','completed','already_completed',true); end if;
  if v_order.refund_status<>'pending' then raise exception 'refund_not_pending'; end if;
  update public.orders set refund_status='completed',refunded_at=now(),refunded_by=p_user_id,
    refund_reference=btrim(p_reference),updated_at=now() where id=p_order_id;
  insert into public.audit_logs(user_id,action,entity_type,entity_id,metadata)
    values(p_user_id,'order_refund_completed','order',p_order_id::text,
      jsonb_build_object('amount',v_order.refund_amount,'reference',btrim(p_reference),'refunded_at',now(),'method','manual_external'));
  insert into public.order_status_history(order_id,status,user_id,note)
    values(p_order_id,'cancelled',p_user_id,'Estorno realizado fora do sistema e registrado pela administração');
  return jsonb_build_object('id',p_order_id,'refund_status','completed');
end;
$$;
revoke all on function public.complete_order_refund_v684(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.complete_order_refund_v684(uuid,text,uuid) to service_role;

-- A expiração usa a mesma transação e a mesma trilha de auditoria do cancelamento manual.
create or replace function public.expire_stale_orders_v64()
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_order record; v_expired integer:=0;
begin
  for v_order in select id from public.orders where status='received'
    and reservation_expires_at<=now() order by id for update skip locked
  loop
    perform public.cancel_order_v684(v_order.id,'Reserva expirada automaticamente',null,false,'reservation_expired');
    v_expired:=v_expired+1;
  end loop;
  delete from public.api_rate_limits where updated_at<now()-interval '2 days'
    and (blocked_until is null or blocked_until<now()-interval '1 day');
  return jsonb_build_object('expired',v_expired);
end;
$$;

-- O upload termina por RPC: o pedido não pode ser cancelado entre a verificação e a gravação.
create or replace function public.submit_delivery_proof_v684(
  p_delivery_id uuid,p_path text,p_reason text,p_note text,p_payment_received boolean,p_user_id uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_order public.orders%rowtype; v_delivery public.deliveries%rowtype; v_confirmation public.delivery_confirmations%rowtype;
begin
  select o.* into v_order from public.orders o where o.id=(select order_id from public.deliveries where id=p_delivery_id) for update;
  if not found or v_order.status<>'out_for_delivery' then raise exception 'delivery_not_started'; end if;
  select * into v_delivery from public.deliveries where id=p_delivery_id for update;
  if v_delivery.status<>'started' then raise exception 'delivery_not_started'; end if;
  if not exists(select 1 from public.drivers where id=v_delivery.driver_id and user_id=p_user_id and active)
    then raise exception 'driver_not_registered'; end if;
  select * into v_confirmation from public.delivery_confirmations where order_id=v_order.id for update;
  if not found then raise exception 'confirmation_not_configured'; end if;
  if v_confirmation.status in ('code_confirmed','proof_approved') then raise exception 'delivery_is_final'; end if;
  if p_reason is null or p_reason not in ('customer_authorized_dropoff','received_by_third_party','code_unavailable') then raise exception 'invalid_proof'; end if;
  if nullif(btrim(p_path),'') is null then raise exception 'invalid_proof'; end if;
  if p_reason='customer_authorized_dropoff' and v_order.payment_status<>'paid' and v_order.payment_method in ('cash','card_on_delivery') then raise exception 'dropoff_requires_prepaid'; end if;
  if v_order.payment_status<>'paid' and p_payment_received is not true then raise exception 'payment_confirmation_required'; end if;
  update public.delivery_confirmations set delivery_id=p_delivery_id,status='proof_pending',
    payment_confirmed=payment_confirmed or coalesce(p_payment_received,false),proof_path=p_path,proof_reason=p_reason,proof_note=left(p_note,300),
    proof_submitted_at=now(),proof_submitted_by=p_user_id,reviewed_at=null,reviewed_by=null,review_note=null,updated_at=now()
    where id=v_confirmation.id;
  insert into public.audit_logs(user_id,action,entity_type,entity_id,metadata)
    values(p_user_id,'delivery_proof_submitted','delivery',p_delivery_id::text,
      jsonb_build_object('order_id',v_order.id,'reason',p_reason,'payment_received',p_payment_received));
  return jsonb_build_object('ok',true,'status','proof_pending','previous_path',v_confirmation.proof_path);
end;
$$;
revoke all on function public.submit_delivery_proof_v684(uuid,text,text,text,boolean,uuid) from public,anon,authenticated;
grant execute on function public.submit_delivery_proof_v684(uuid,text,text,text,boolean,uuid) to service_role;


-- Compatibilidade com chamadas anteriores, sem permitir retorno a received.
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
  if p_status = 'cancelled' then return public.cancel_order_v684(p_order_id,p_note,p_user_id,false,'staff'); end if;
  select status into v_current from public.orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;
  if v_current = p_status then return jsonb_build_object('id', p_order_id, 'status', p_status); end if;
  if v_current in ('delivered','cancelled') then raise exception 'order_is_final'; end if;

  if p_status is null or p_status = 'received' then raise exception 'invalid_transition'; end if;
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
  perform 1 from public.orders where id=(select order_id from public.deliveries where id=p_delivery_id) for update;
  if exists(select 1 from public.orders where id=(select order_id from public.deliveries where id=p_delivery_id) and status='cancelled') then
    raise exception 'order_is_final';
  end if;
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
    update public.deliveries set status='cancelled', driver_payout=0, updated_at=now() where id=p_delivery_id;
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

create or replace function public.confirm_delivery_code_v681(
  p_delivery_id uuid,
  p_code_hash text,
  p_payment_received boolean default false,
  p_user_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_delivery public.deliveries%rowtype;
  v_confirmation public.delivery_confirmations%rowtype;
  v_payment_method public.payment_method;
  v_payment_status public.payment_status;
  v_attempts integer;
  v_result jsonb;
begin
  perform 1 from public.orders where id=(select order_id from public.deliveries where id=p_delivery_id) for update;
  if exists(select 1 from public.orders where id=(select order_id from public.deliveries where id=p_delivery_id) and status='cancelled') then
    raise exception 'order_is_final';
  end if;
  select * into v_delivery
  from public.deliveries
  where id = p_delivery_id
  for update;

  if not found then return jsonb_build_object('ok',false,'error','delivery_not_found'); end if;
  if v_delivery.status <> 'started' then return jsonb_build_object('ok',false,'error','delivery_not_started'); end if;

  select payment_method, payment_status into v_payment_method, v_payment_status from public.orders where id = v_delivery.order_id;

  select * into v_confirmation
  from public.delivery_confirmations
  where order_id = v_delivery.order_id
  for update;

  if not found then return jsonb_build_object('ok',false,'error','confirmation_not_configured'); end if;
  if v_confirmation.status in ('code_confirmed','proof_approved') then
    return jsonb_build_object('ok',true,'already_confirmed',true);
  end if;

  if v_confirmation.locked_until is not null and v_confirmation.locked_until > now() then
    return jsonb_build_object('ok',false,'error','confirmation_locked','locked_until',v_confirmation.locked_until);
  end if;

  if v_payment_status <> 'paid' and coalesce(p_payment_received,false) is not true then
    return jsonb_build_object('ok',false,'error','payment_confirmation_required');
  end if;

  if trim(coalesce(p_code_hash,'')) <> v_confirmation.code_hash then
    v_attempts := v_confirmation.attempts + 1;
    if v_attempts >= 5 then
      update public.delivery_confirmations
      set attempts = 0,
          locked_until = now() + interval '15 minutes',
          updated_at = now()
      where id = v_confirmation.id;

      insert into public.audit_logs(user_id, action, entity_type, entity_id, metadata)
      values (p_user_id, 'delivery_confirmation_locked', 'delivery', p_delivery_id::text,
        jsonb_build_object('order_id',v_delivery.order_id));

      return jsonb_build_object('ok',false,'error','confirmation_locked','locked_until',now() + interval '15 minutes');
    end if;

    update public.delivery_confirmations
    set attempts = v_attempts,
        locked_until = null,
        updated_at = now()
    where id = v_confirmation.id;

    return jsonb_build_object('ok',false,'error','invalid_confirmation_code','attempts_left',5-v_attempts);
  end if;

  v_result := public.set_delivery_status_v65(p_delivery_id, 'delivered', p_user_id);

  update public.delivery_confirmations
  set delivery_id = p_delivery_id,
      status = 'code_confirmed',
      attempts = 0,
      locked_until = null,
      confirmation_method = 'code',
      payment_confirmed = case when v_payment_status <> 'paid' then true else payment_confirmed end,
      confirmed_at = now(),
      confirmed_by = p_user_id,
      reviewed_at = null,
      reviewed_by = null,
      review_note = null,
      updated_at = now()
  where id = v_confirmation.id;

  insert into public.audit_logs(user_id, action, entity_type, entity_id, metadata)
  values (p_user_id, 'delivery_confirmed_by_code', 'delivery', p_delivery_id::text,
    jsonb_build_object('order_id',v_delivery.order_id,'payment_received',coalesce(p_payment_received,false)));

  return jsonb_build_object('ok',true,'delivery',v_result,'method','code');
end;
$$;

create or replace function public.approve_delivery_proof_v681(
  p_delivery_id uuid,
  p_review_note text default null,
  p_user_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_delivery public.deliveries%rowtype;
  v_confirmation public.delivery_confirmations%rowtype;
  v_payment_method public.payment_method;
  v_payment_status public.payment_status;
  v_result jsonb;
begin
  perform 1 from public.orders where id=(select order_id from public.deliveries where id=p_delivery_id) for update;
  if exists(select 1 from public.orders where id=(select order_id from public.deliveries where id=p_delivery_id) and status='cancelled') then
    raise exception 'order_is_final';
  end if;
  select * into v_delivery from public.deliveries where id=p_delivery_id for update;
  if not found then raise exception 'delivery_not_found'; end if;
  if v_delivery.status <> 'started' then raise exception 'delivery_not_started'; end if;

  select payment_method, payment_status into v_payment_method, v_payment_status from public.orders where id=v_delivery.order_id;
  select * into v_confirmation from public.delivery_confirmations where order_id=v_delivery.order_id for update;
  if not found or v_confirmation.status <> 'proof_pending' or v_confirmation.proof_path is null then
    raise exception 'proof_not_pending';
  end if;
  if v_payment_status <> 'paid' and v_confirmation.payment_confirmed is not true then
    raise exception 'payment_confirmation_required';
  end if;

  v_result := public.set_delivery_status_v65(p_delivery_id, 'delivered', p_user_id);

  update public.delivery_confirmations
  set delivery_id = p_delivery_id,
      status = 'proof_approved',
      confirmation_method = 'photo_admin',
      confirmed_at = now(),
      confirmed_by = p_user_id,
      reviewed_at = now(),
      reviewed_by = p_user_id,
      review_note = nullif(left(coalesce(p_review_note,''),300),''),
      updated_at = now()
  where id=v_confirmation.id;

  insert into public.audit_logs(user_id, action, entity_type, entity_id, metadata)
  values (p_user_id, 'delivery_proof_approved', 'delivery', p_delivery_id::text,
    jsonb_build_object('order_id',v_delivery.order_id,'reason',v_confirmation.proof_reason));

  return jsonb_build_object('ok',true,'delivery',v_result,'method','photo_admin');
end;
$$;

create or replace function public.reject_delivery_proof_v681(
  p_delivery_id uuid,
  p_review_note text,
  p_user_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_delivery public.deliveries%rowtype;
  v_confirmation public.delivery_confirmations%rowtype;
begin
  perform 1 from public.orders where id=(select order_id from public.deliveries where id=p_delivery_id) for update;
  if exists(select 1 from public.orders where id=(select order_id from public.deliveries where id=p_delivery_id) and status='cancelled') then
    raise exception 'order_is_final';
  end if;
  if char_length(trim(coalesce(p_review_note,''))) < 3 then raise exception 'review_note_required'; end if;

  select * into v_delivery from public.deliveries where id=p_delivery_id for update;
  if not found then raise exception 'delivery_not_found'; end if;
  if v_delivery.status <> 'started' then raise exception 'delivery_not_started'; end if;

  select * into v_confirmation from public.delivery_confirmations where order_id=v_delivery.order_id for update;
  if not found or v_confirmation.status <> 'proof_pending' then raise exception 'proof_not_pending'; end if;

  update public.delivery_confirmations
  set status = 'proof_rejected',
      reviewed_at = now(),
      reviewed_by = p_user_id,
      review_note = left(trim(p_review_note),300),
      updated_at = now()
  where id=v_confirmation.id;

  insert into public.audit_logs(user_id, action, entity_type, entity_id, metadata)
  values (p_user_id, 'delivery_proof_rejected', 'delivery', p_delivery_id::text,
    jsonb_build_object('order_id',v_delivery.order_id,'review_note',left(trim(p_review_note),300)));

  return jsonb_build_object('ok',true,'status','proof_rejected');
end;
$$;

create or replace function public.create_driver_payout_v68(
  p_store_id uuid,
  p_driver_id uuid,
  p_delivery_ids uuid[],
  p_payment_method text,
  p_paid_at timestamptz,
  p_notes text default null,
  p_proof_path text default null,
  p_user_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_driver public.drivers%rowtype;
  v_delivery public.deliveries%rowtype;
  v_control_started_at timestamptz;
  v_batch_id uuid;
  v_batch_number bigint;
  v_total numeric(12,2) := 0;
  v_delivery_id uuid;
  v_count integer := 0;
  v_unique_count integer := 0;
begin
  if p_delivery_ids is null or cardinality(p_delivery_ids) = 0 or cardinality(p_delivery_ids) > 200 then
    raise exception 'payout_deliveries_invalid';
  end if;

  if p_payment_method not in ('pix','cash','transfer') then
    raise exception 'payout_method_invalid';
  end if;

  if p_paid_at is null or p_paid_at > now() + interval '1 day' then
    raise exception 'payout_date_invalid';
  end if;

  select count(*), count(distinct value)
  into v_count, v_unique_count
  from unnest(p_delivery_ids) as u(value);
  if v_count <> v_unique_count then
    raise exception 'payout_duplicate_delivery';
  end if;

  perform 1 from public.orders where id in (select order_id from public.deliveries where id=any(p_delivery_ids)) order by id for update;
  if exists(select 1 from public.orders o join public.deliveries d on d.order_id=o.id where d.id=any(p_delivery_ids) and o.status<>'delivered') then
    raise exception 'payout_order_not_completed';
  end if;
  select * into v_driver
  from public.drivers
  where id = p_driver_id
  for update;
  if not found or v_driver.store_id <> p_store_id then
    raise exception 'payout_driver_invalid';
  end if;

  select control_started_at into v_control_started_at
  from public.driver_payout_settings
  where store_id = p_store_id;
  if v_control_started_at is null then
    raise exception 'payout_control_not_configured';
  end if;

  -- As linhas de entrega ficam bloqueadas até o commit para impedir pagamento duplicado concorrente.
  foreach v_delivery_id in array p_delivery_ids loop
    select * into v_delivery
    from public.deliveries
    where id = v_delivery_id
    for update;

    if not found then raise exception 'payout_delivery_not_found'; end if;
    if v_delivery.driver_id <> p_driver_id then raise exception 'payout_delivery_wrong_driver'; end if;
    if v_delivery.status <> 'delivered' or v_delivery.delivered_at is null then raise exception 'payout_delivery_not_completed'; end if;
    if v_delivery.delivered_at < v_control_started_at then raise exception 'payout_delivery_before_control'; end if;
    if coalesce(v_delivery.driver_payout, 0) <= 0 then raise exception 'payout_delivery_zero'; end if;
    if exists(select 1 from public.driver_payout_items where delivery_id = v_delivery_id) then
      raise exception 'payout_delivery_already_paid';
    end if;

    v_total := v_total + coalesce(v_delivery.driver_payout, 0);
  end loop;

  insert into public.driver_payout_batches (
    store_id, driver_id, total_amount, payment_method, paid_at, notes, proof_path, created_by
  ) values (
    p_store_id,
    p_driver_id,
    round(v_total, 2),
    p_payment_method,
    p_paid_at,
    nullif(left(coalesce(p_notes, ''), 500), ''),
    nullif(left(coalesce(p_proof_path, ''), 500), ''),
    p_user_id
  )
  returning id, batch_number into v_batch_id, v_batch_number;

  insert into public.driver_payout_items (batch_id, store_id, driver_id, delivery_id, amount)
  select v_batch_id, p_store_id, p_driver_id, d.id, round(d.driver_payout, 2)
  from public.deliveries d
  where d.id = any(p_delivery_ids);

  insert into public.audit_logs(user_id, action, entity_type, entity_id, metadata)
  values (
    p_user_id,
    'driver_payout_paid',
    'driver_payout_batch',
    v_batch_id::text,
    jsonb_build_object(
      'batch_number', v_batch_number,
      'driver_id', p_driver_id,
      'deliveries', cardinality(p_delivery_ids),
      'total_amount', round(v_total, 2),
      'payment_method', p_payment_method
    )
  );

  return jsonb_build_object(
    'id', v_batch_id,
    'batch_number', v_batch_number,
    'driver_id', p_driver_id,
    'deliveries', cardinality(p_delivery_ids),
    'total_amount', round(v_total, 2),
    'payment_method', p_payment_method,
    'paid_at', p_paid_at
  );
end;
$$;

commit;
