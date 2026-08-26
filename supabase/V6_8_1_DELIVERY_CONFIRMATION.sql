-- Conveniência 24h · V6.8.1 — Confirmação de Entrega
-- Código de recebimento como prova principal e foto como fallback sujeito à aprovação da operação.

begin;

create table if not exists public.delivery_confirmations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  order_id uuid not null unique references public.orders(id) on delete cascade,
  delivery_id uuid references public.deliveries(id) on delete set null,
  code_hash text not null check (char_length(code_hash) between 32 and 128),
  status text not null default 'pending' check (status in ('pending','code_confirmed','proof_pending','proof_approved','proof_rejected')),
  attempts integer not null default 0 check (attempts >= 0),
  locked_until timestamptz,
  confirmation_method text check (confirmation_method is null or confirmation_method in ('code','photo_admin')),
  payment_confirmed boolean not null default false,
  confirmed_at timestamptz,
  confirmed_by uuid references auth.users(id) on delete set null,
  proof_path text,
  proof_reason text,
  proof_note text,
  proof_submitted_at timestamptz,
  proof_submitted_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_delivery_confirmations_store_status
  on public.delivery_confirmations(store_id, status, updated_at desc);
create index if not exists idx_delivery_confirmations_delivery
  on public.delivery_confirmations(delivery_id) where delivery_id is not null;

alter table public.delivery_confirmations enable row level security;
revoke all on table public.delivery_confirmations from public, anon, authenticated;
grant select, insert, update, delete on table public.delivery_confirmations to service_role;

-- Bucket privado. As imagens são acessadas somente por URL assinada criada no servidor.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'delivery-proofs',
  'delivery-proofs',
  false,
  8000000,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Criação do pedido + registro do código dentro da mesma transação.
create or replace function public.create_order_v681(
  p_payload jsonb,
  p_confirmation_hash text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_result jsonb;
  v_order_id uuid;
  v_store_id uuid;
begin
  if p_confirmation_hash is null or char_length(trim(p_confirmation_hash)) < 32 then
    raise exception 'confirmation_hash_invalid';
  end if;

  v_result := public.create_order_v65(p_payload);
  v_order_id := (v_result->>'id')::uuid;

  select store_id into v_store_id from public.orders where id = v_order_id;
  if v_store_id is null then raise exception 'order_not_found'; end if;

  insert into public.delivery_confirmations(store_id, order_id, code_hash)
  values (v_store_id, v_order_id, trim(p_confirmation_hash))
  on conflict (order_id) do nothing;

  return v_result || jsonb_build_object('delivery_confirmation', true);
end;
$$;

revoke execute on function public.create_order_v681(jsonb,text) from public, anon, authenticated;
grant execute on function public.create_order_v681(jsonb,text) to service_role;

-- Confirmação por código. Tentativas erradas são persistidas e bloqueadas temporariamente.
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

revoke execute on function public.confirm_delivery_code_v681(uuid,text,boolean,uuid) from public, anon, authenticated;
grant execute on function public.confirm_delivery_code_v681(uuid,text,boolean,uuid) to service_role;

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

revoke execute on function public.approve_delivery_proof_v681(uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.approve_delivery_proof_v681(uuid,text,uuid) to service_role;

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

revoke execute on function public.reject_delivery_proof_v681(uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.reject_delivery_proof_v681(uuid,text,uuid) to service_role;

commit;
