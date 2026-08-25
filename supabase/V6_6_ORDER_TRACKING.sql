-- Conveniência 24h — V6.6
-- Índice auxiliar para busca segura do acompanhamento por número + telefone.
-- Não altera nem apaga pedidos existentes.

create index if not exists idx_orders_store_number_phone
  on public.orders (store_id, order_number, customer_phone);
