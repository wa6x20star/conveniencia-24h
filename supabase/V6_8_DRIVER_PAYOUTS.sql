-- Conveniência 24h · V6.8 — Controle de Repasses e Financeiro dos Entregadores
-- Cria o controle financeiro sem transformar entregas antigas de teste em dívida.
-- A data/hora em que esta migration é executada vira o início do controle para cada loja.

begin;

create table if not exists public.driver_payout_settings (
  store_id uuid primary key references public.stores(id) on delete cascade,
  control_started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.driver_payout_settings (store_id, control_started_at)
select id, now()
from public.stores
on conflict (store_id) do nothing;

create table if not exists public.driver_payout_batches (
  id uuid primary key default gen_random_uuid(),
  batch_number bigint generated always as identity unique,
  store_id uuid not null references public.stores(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete restrict,
  status text not null default 'paid' check (status in ('paid')),
  total_amount numeric(12,2) not null check (total_amount >= 0),
  payment_method text not null check (payment_method in ('pix','cash','transfer')),
  paid_at timestamptz not null default now(),
  notes text,
  proof_path text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.driver_payout_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.driver_payout_batches(id) on delete restrict,
  store_id uuid not null references public.stores(id) on delete restrict,
  driver_id uuid not null references public.drivers(id) on delete restrict,
  delivery_id uuid not null unique references public.deliveries(id) on delete restrict,
  amount numeric(12,2) not null check (amount >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_driver_payout_batches_store_paid
  on public.driver_payout_batches(store_id, paid_at desc);
create index if not exists idx_driver_payout_batches_driver_paid
  on public.driver_payout_batches(driver_id, paid_at desc);
create index if not exists idx_driver_payout_items_batch
  on public.driver_payout_items(batch_id);
create index if not exists idx_driver_payout_items_store_driver
  on public.driver_payout_items(store_id, driver_id, created_at desc);

alter table public.driver_payout_settings enable row level security;
alter table public.driver_payout_batches enable row level security;
alter table public.driver_payout_items enable row level security;

revoke all on table public.driver_payout_settings from public, anon, authenticated;
revoke all on table public.driver_payout_batches from public, anon, authenticated;
revoke all on table public.driver_payout_items from public, anon, authenticated;
grant select, insert, update, delete on table public.driver_payout_settings to service_role;
grant select, insert, update, delete on table public.driver_payout_batches to service_role;
grant select, insert, update, delete on table public.driver_payout_items to service_role;
revoke all on sequence public.driver_payout_batches_batch_number_seq from public, anon, authenticated;
grant usage, select on sequence public.driver_payout_batches_batch_number_seq to service_role;

-- Bucket privado: comprovantes só são acessados por URLs assinadas geradas pelo servidor.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'driver-payout-proofs',
  'driver-payout-proofs',
  false,
  5000000,
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

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

revoke execute on function public.create_driver_payout_v68(uuid,uuid,uuid[],text,timestamptz,text,text,uuid) from public, anon, authenticated;
grant execute on function public.create_driver_payout_v68(uuid,uuid,uuid[],text,timestamptz,text,text,uuid) to service_role;

commit;
