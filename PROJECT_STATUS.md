# Status físico do projeto

## Já criado

- Estrutura Next.js / App Router
- TypeScript e Tailwind CSS
- Base de Supabase SSR (`client.ts`, `server.ts`, `proxy.ts`)
- Loja mobile-first
- Catálogo demonstrativo
- Carrinho funcional com persistência em `localStorage`
- Checkout demonstrativo
- Rastreamento de pedido
- Login interno demonstrativo
- Dashboard administrativo
- Central de pedidos por status
- Cadastro/consulta visual de produtos
- Controle visual de estoque
- Gestão visual de entregas
- Tela simplificada do entregador
- Migração SQL inicial
- RLS inicial
- Helpers de reserva/liberação/consumo de estoque
- Seed opcional de catálogo

## Ainda pendente de conexão real

- Criar projeto Supabase exclusivo na organização escolhida pelo usuário
- Executar/verificar migrações no projeto
- Gerar tipos TypeScript do banco
- Substituir mocks por consultas reais
- Auth real e atribuição segura de `app_metadata.role`
- Checkout atômico no backend
- PIX real
- PDF/QR Code real
- Notificações e WhatsApp
- Deploy na Vercel

## V5 — Estoque administrativo
- Login interno direcionando ao controle de estoque.
- Painel de estoque com físico, reservado, disponível e vendido.
- Entrada, perda, avaria, ajuste e inventário com histórico.
- Movimentações manuais restritas ao perfil admin.
- Venda continua sendo baixada automaticamente pelo fluxo do pedido.
