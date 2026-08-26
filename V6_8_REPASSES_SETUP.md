# Conveniência 24h — V6.8 · Controle de Repasses

A V6.8 adiciona o financeiro dos entregadores sem alterar o fluxo já testado de pedido, frete, separação e entrega.

## 1. Antes do deploy

No Supabase do projeto **Conveniência-24h**, abra o SQL Editor e execute:

`supabase/V6_8_DRIVER_PAYOUTS.sql`

A hora em que esse SQL for executado será registrada como o **início do controle de repasses**. Entregas concluídas antes dessa data/hora ficam fora do saldo a pagar. Isso evita transformar entregas antigas de teste em dívida real.

O SQL cria:

- configuração de início do controle;
- lotes de repasse `REP-000001`, `REP-000002`...;
- vínculo único entre repasse e entrega;
- bucket privado `driver-payout-proofs` para comprovantes;
- função transacional `create_driver_payout_v68`;
- índices e bloqueios de acesso direto.

## 2. Publicar o código

Substitua os arquivos da versão atual pelos da V6.8 e faça o fluxo normal:

1. Commit no GitHub Desktop.
2. Push origin.
3. Aguarde o deploy da Vercel ficar `Ready`.

## 3. Onde usar

No painel administrativo haverá a nova aba **Repasses** e também um atalho em **Entregas → R$ REPASSES**.

A página mostra:

- total a receber pela equipe;
- entregas pendentes de pagamento;
- total pago no mês;
- saldo por entregador;
- histórico de repasses;
- entregas que compõem cada repasse;
- comprovante, quando anexado.

## 4. Como pagar um entregador

1. Abra **Admin → Repasses**.
2. Escolha o entregador com saldo pendente.
3. Clique em **Realizar repasse**.
4. Marque/desmarque as entregas que serão quitadas.
5. Escolha PIX, Dinheiro ou Transferência.
6. Informe a data do pagamento.
7. Adicione observação e comprovante, se desejar.
8. Confirme.

O valor é recalculado no servidor usando o `driver_payout` registrado em cada entrega. O navegador não define o valor financeiro.

A função do banco bloqueia as entregas durante a transação e a coluna `delivery_id` é única em `driver_payout_items`; por isso a mesma entrega não pode ser paga duas vezes.

## 5. Visão do entregador

O painel `/entregador` passa a exibir:

- **A receber**;
- **Recebido no mês**;
- status **Pendente / Em dia**;
- últimos repasses;
- comprovante quando disponível;
- no histórico da entrega: `PAGO`, `A RECEBER` ou `FORA DO CONTROLE`.

Os valores de Hoje / Semana / Mês continuam representando a produção de entregas concluídas. O bloco **Financeiro** é o que informa o saldo efetivamente pendente e os repasses já recebidos.

## 6. Teste recomendado

Depois do deploy:

1. Faça uma nova entrega após a instalação da V6.8.
2. Confirme que o valor aparece em **A receber**.
3. Abra **Repasses** no admin.
4. Gere um repasse para essa entrega.
5. Confirme que o saldo diminui no admin.
6. Entre como entregador e confira **Recebido no mês**.
7. Abra o histórico e confirme que a entrega mudou de `A RECEBER` para `PAGO`.
8. Tente repetir o pagamento da mesma entrega; ela não deve mais aparecer como pendente.

## Observação

A V6.8 registra a baixa do repasse dentro do sistema. Ela **não realiza automaticamente uma transferência PIX ou bancária**. O pagamento é feito fora do site e depois registrado como quitado no painel.
