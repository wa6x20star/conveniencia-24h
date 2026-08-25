# V6.7 — Painel do Entregador

Esta versão evolui a área `/entregador` sem alterar o fluxo central de pedidos, estoque, frete ou acompanhamento do cliente.

## Novidades

- Resumo de ganhos registrados: hoje, semana e mês.
- Quantidade de entregas e km percorridos por período.
- Histórico das 12 entregas concluídas mais recentes.
- Média de valor por entrega no mês.
- Atualização automática do painel a cada 30 segundos.
- Indicação clara de pagamento pago, pendente ou a receber na entrega.
- Acesso rápido a ligação, WhatsApp, Google Maps e Waze.
- Confirmação antes de marcar uma entrega como concluída.
- Painel administrativo mostra desempenho mensal de cada entregador.
- O entregador continua visualizando somente dados vinculados à própria conta.

## Banco de dados

Execute no SQL Editor do projeto Supabase da Conveniência 24h:

`supabase/V6_7_DRIVER_PANEL.sql`

O script cria somente um índice para acelerar o histórico. Não apaga nem modifica pedidos ou entregas existentes.

## Publicação

1. Faça backup da versão atual se desejar.
2. Substitua os arquivos do projeto pelos arquivos da V6.7.
3. Execute `V6_7_DRIVER_PANEL.sql` no Supabase.
4. Commit e Push no GitHub.
5. Aguarde o deploy da Vercel ficar `Ready`.

## Teste recomendado

1. Cadastre um entregador no painel administrativo.
2. Entre em `/entregador/login` com a conta criada.
3. Marque o entregador como disponível.
4. Crie um pedido e leve-o até `Pronto`.
5. Atribua o pedido ao entregador.
6. Confirme que o pedido aparece na área do entregador.
7. Teste Google Maps/Waze e o aviso de pagamento.
8. Inicie a entrega e depois confirme a entrega.
9. Verifique se o histórico, ganhos e km foram atualizados.
10. Confira no painel administrativo o resumo mensal do entregador.

> Os valores exibidos como ganhos são valores registrados para entregas concluídas. Eles não representam, por si só, confirmação de repasse financeiro ao entregador.
