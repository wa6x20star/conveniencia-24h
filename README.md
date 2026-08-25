# Conveniência 24h

Base física inicial da plataforma de conveniência 100% online com entrega 24h.

## Stack

- Next.js 16 / App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Supabase / PostgreSQL

## Rodar localmente

1. Copie `.env.example` para `.env.local` e preencha os dados do projeto Supabase.
2. Rode `npm install`.
3. Rode `npm run dev`.
4. Acesse `http://localhost:3000`.

## Estado atual

A interface-base já contém loja, carrinho, checkout, dashboard administrativo, pedidos, produtos, estoque, entregas, tela do entregador e login. Os dados exibidos ainda são mockados até a conexão com o novo projeto Supabase ser concluída.

O arquivo `supabase/migrations/001_initial_schema.sql` contém o primeiro esquema do banco.


## V3

Checkout com envio do pedido por WhatsApp e catálogo ampliado com fotos reais de referência. Veja `ATUALIZACAO_V3.md`.

## V6.5 — Logística e Entregas

A V6.5 integra pedidos reais com entregadores, adiciona conta `driver`, cálculo de frete por distância e frete grátis configurável. Leia `V6_5_LOGISTICA_SETUP.md` e execute `supabase/V6_5_LOGISTICS.sql` depois da V6.4.

## V6.6 — Acompanhamento de Pedidos

A V6.6 adiciona recuperação segura por número do pedido + telefone e mantém o link individual de acompanhamento enviado ao cliente.

## V6.7 — Painel do Entregador

A V6.7 profissionaliza `/entregador` com ganhos registrados por período, histórico, km percorridos, média por entrega, atualização automática e atalhos para WhatsApp, Google Maps e Waze. O painel administrativo também passa a mostrar o desempenho mensal de cada entregador. Leia `V6_7_PAINEL_ENTREGADOR_SETUP.md`.
