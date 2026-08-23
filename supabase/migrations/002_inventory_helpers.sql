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
