-- Conveniência 24h · V6.7 — Painel do Entregador
-- Índice de apoio ao histórico e aos indicadores do entregador.
-- Não altera dados existentes.

create index if not exists idx_deliveries_driver_delivered_history
  on public.deliveries(driver_id, delivered_at desc)
  where status = 'delivered';
