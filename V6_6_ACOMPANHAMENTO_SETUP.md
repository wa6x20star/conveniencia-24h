# V6.6 — Acompanhamento Inteligente de Pedidos

## O que muda

- O WhatsApp recebe o link individual `/pedido/<tracking_token>` junto do comprovante do pedido.
- Nova central `/pedido` para localizar pedidos usando **número do pedido + WhatsApp**.
- Botão **Ver meu último pedido** para o último token salvo no próprio aparelho.
- Links antigos `/pedido/demo` foram removidos.
- O menu mobile não expõe mais o login administrativo em "Conta"; ele volta a destacar Ofertas.
- A página de tracking mostra o primeiro nome do entregador quando a entrega estiver em rota.
- Token inválido deixa de ficar eternamente em "Carregando pedido" e oferece a busca segura.

## Instalação

1. No Supabase do projeto Conveniência-24h, rode `supabase/V6_6_ORDER_TRACKING.sql`.
2. Substitua o código atual pelos arquivos da V6.6.
3. Commit + Push para `main`.
4. Aguarde o deploy da Vercel ficar `Ready`.
5. Não é necessário alterar as Environment Variables.

## Teste recomendado

1. Coloque saldo em um produto.
2. Faça um pedido de teste usando um telefone real de teste.
3. Confirme se o WhatsApp contém o link de acompanhamento.
4. Abra o link e confira o status.
5. Abra `/pedido` e procure usando `#pedido + telefone`.
6. Teste um número ou telefone errado e confirme que a resposta é genérica.
7. No mesmo navegador, teste **Ver meu último pedido**.
