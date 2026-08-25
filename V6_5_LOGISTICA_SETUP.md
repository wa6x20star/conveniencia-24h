# V6.5 — Logística e Entregas

A V6.5 deve ser instalada **depois da V6.4**.

## 1. Banco de dados

No projeto Supabase **Conveniência-24h**, abra o SQL Editor e execute todo o arquivo:

`supabase/V6_5_LOGISTICS.sql`

A migration cria as configurações de frete por distância, faixas de preço, vínculo real entre pedidos e entregadores e funções transacionais para atribuir/iniciar/concluir entregas.

## 2. Deploy

Depois do SQL retornar sucesso:

1. Substitua os arquivos do repositório pelos da V6.5.
2. Commit e Push na branch `main`.
3. Aguarde o deployment da Vercel ficar `Ready`.

Não é necessário alterar as chaves do Supabase.

## 3. Configurar o ponto de coleta

Entre no painel administrativo e abra **Entregas → Configurar frete**.

Informe o endereço real onde os pedidos serão coletados. Ao salvar, o servidor transforma o endereço em coordenadas e passa a calcular a distância até o cliente.

Configuração padrão incluída:

| Distância | Cliente paga | Entregador recebe |
|---|---:|---:|
| 0–2 km | R$ 5,00 | R$ 4,00 |
| 2–4 km | R$ 7,00 | R$ 5,00 |
| 4–6 km | R$ 9,00 | R$ 6,00 |
| 6–8 km | R$ 12,00 | R$ 8,00 |
| 8–10 km | R$ 15,00 | R$ 10,00 |

Os valores podem ser alterados pelo painel.

**Frete grátis:** ativado por padrão a partir de **R$ 50,00**. O cliente paga R$ 0, mas o valor do entregador continua sendo calculado pela distância.

## 4. Cadastrar entregadores

Em **Entregas → + Entregador**, informe nome, e-mail, telefone e uma senha inicial.

O sistema cria uma conta Supabase com perfil `driver`. O entregador entra em:

`/entregador/login`

Ele não ganha acesso ao painel administrativo. A API entrega a ele somente os dados do pedido atualmente atribuído à sua conta.

## 5. Fluxo real

1. Cliente cria pedido.
2. Operação muda `Recebido → Separando → Pronto`.
3. O pedido aparece automaticamente na aba **Entregas**.
4. Operação atribui um entregador disponível.
5. O entregador vê o pedido em `/entregador`.
6. **Iniciar entrega** muda o pedido para `Em rota`.
7. **Confirmar entrega** muda o pedido para `Entregue` e libera o entregador.

## 6. Cálculo de distância

Por padrão, a V6.5 usa serviços públicos compatíveis com OpenStreetMap no backend para geocodificação e roteamento. Não há nova chave obrigatória para o primeiro teste.

Para operação de maior volume, recomenda-se futuramente trocar por um provedor com SLA próprio. A arquitetura já permite sobrescrever:

- `GEOCODING_API_BASE_URL`
- `ROUTING_API_BASE_URL`

Essas variáveis são opcionais e server-side.

## 7. Teste recomendado

1. Cadastre saldo em dois produtos.
2. Configure a origem da loja.
3. Cadastre um entregador de teste.
4. Faça um pedido abaixo de R$ 50 e confirme a taxa calculada.
5. Faça outro acima de R$ 50 e confirme `Entrega: GRÁTIS`.
6. Leve o pedido até `Pronto`.
7. Atribua ao entregador.
8. Entre com a conta do entregador e execute `Iniciar entrega → Confirmar entrega`.
9. Confirme no painel e no acompanhamento público que o status chegou a `Entregue`.
