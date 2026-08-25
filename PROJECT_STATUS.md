# V6.4 — Security Hardening

A V6.4 mantém a interface da V6.3 e adiciona proteção contra spam de pedidos, idempotência, expiração de reservas, validação forte, tracking com menos dados pessoais, uploads validados e headers de segurança.

Antes de publicar, execute `supabase/V6_4_SECURITY_HARDENING.sql` e siga `V6_4_SECURITY_SETUP.md`.

---

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

## V6.5 — Logística e Entregas
- Aba Entregas conectada a pedidos reais em status `ready`.
- Cadastro de entregadores com conta Supabase e role `driver`.
- Painel exclusivo `/entregador` e login `/entregador/login`.
- Atribuição, início e conclusão da entrega sincronizados com o pedido.
- Frete por distância com origem configurável e faixas editáveis.
- Frete grátis configurável (padrão R$ 50,00).
- Separação entre valor cobrado do cliente e repasse do entregador.
- Correção de isolamento de roles: `driver` não é aceito em rotas/admin.

## V6.6 — Acompanhamento de Pedidos
- Link individual de acompanhamento na confirmação do pedido.
- Busca segura por número do pedido + telefone.
- Recuperação do último pedido no mesmo aparelho.

## V6.7 — Painel do Entregador
- Resumo de ganhos registrados: hoje, semana e mês.
- Histórico das entregas concluídas.
- Indicadores de quantidade, km e média por entrega.
- Atualização automática a cada 30 segundos.
- Pagamento destacado para evitar cobrança duplicada.
- Atalhos de contato, Google Maps e Waze.
- Resumo mensal de desempenho dos entregadores no painel administrativo.
