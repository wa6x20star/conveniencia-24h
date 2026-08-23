# Atualização V4

## Entregue nesta versão

- Supabase como fonte real do catálogo.
- Cadastro e edição persistente de produtos.
- Upload de fotos para Supabase Storage.
- Estoque físico, reservado e disponível.
- Criação transacional de pedidos.
- Reserva de estoque ao finalizar.
- WhatsApp continua integrado ao pedido.
- Central real de pedidos.
- Status: Recebido > Separando > Pronto > Em entrega > Entregue.
- Cancelamento antes da conclusão da separação com liberação de reserva.
- Acompanhamento do cliente por token.
- Login real com Supabase Auth.
- Painel e estoque usando dados reais.

## Compatibilidade

Se as variáveis do Supabase ainda não estiverem configuradas, a loja pública continua abrindo com o catálogo demonstrativo e o checkout continua capaz de enviar o pedido via WhatsApp como fallback.
