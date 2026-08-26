# V6.8.1 — Confirmação de Entrega

Esta versão adiciona uma camada de prova para conclusão da entrega sem alterar o fluxo de repasses da V6.8.

## Fluxo principal — código do cliente

1. O pedido é criado e recebe um código de confirmação de 6 dígitos.
2. O código aparece no acompanhamento do pedido no aparelho que criou a compra.
3. O código NÃO é enviado na mensagem do WhatsApp destinada à loja.
4. O entregador inicia a entrega normalmente.
5. Depois de entregar o pedido, pede o código ao cliente e digita no Portal do Entregador.
6. O servidor valida o código. Após 5 erros, o código fica bloqueado por 15 minutos.
7. Se o pagamento for Dinheiro ou Cartão na entrega, o entregador também precisa declarar que recebeu o pagamento.
8. Com código válido, a entrega é concluída e o fluxo financeiro/repasses continua normalmente.

## Exceção — comprovante fotográfico

Quando o cliente não puder fornecer o código, o entregador pode enviar uma foto como prova alternativa.

- A foto não conclui a entrega automaticamente.
- O entregador informa o motivo e uma observação opcional.
- A entrega continua EM ROTA até a operação revisar.
- A aba Entregas exibe o comprovante em “Comprovantes de entrega pendentes”.
- A operação aprova ou recusa.
- Somente a aprovação conclui a entrega.

Privacidade: orientar a equipe a fotografar preferencialmente o pacote no ponto de entrega e evitar rostos, interior da residência, placas, documentos e informações pessoais desnecessárias.

## Instalação

1. No Supabase do projeto Conveniência-24h, abra o SQL Editor.
2. Se a V6.8 ainda não foi instalada, execute primeiro `supabase/V6_8_DRIVER_PAYOUTS.sql`.
3. Execute `supabase/V6_8_1_DELIVERY_CONFIRMATION.sql`.
4. Depois substitua os arquivos da versão anterior pelos arquivos da V6.8.1.
5. Faça Commit + Push no GitHub.
6. Aguarde o deploy da Vercel ficar Ready.

A migration cria:

- tabela privada `delivery_confirmations`;
- bucket privado `delivery-proofs` (JPG/PNG/WebP, até 8 MB);
- `create_order_v681`;
- `confirm_delivery_code_v681`;
- `approve_delivery_proof_v681`;
- `reject_delivery_proof_v681`.

## Teste recomendado

### Código
1. Crie um pedido novo depois da migration.
2. Confira o código de 6 dígitos no card de acompanhamento.
3. Faça Recebido → Separando → Pronto → atribua entregador → Iniciar entrega.
4. Digite um código errado e confirme que a entrega não é concluída.
5. Digite o código correto.
6. Confirme que pedido, cliente, entregador, histórico e repasse refletem a conclusão.

### Foto
1. Crie outro pedido e inicie a entrega.
2. No entregador, escolha “Não tenho o código • Enviar foto”.
3. Envie uma imagem de teste sem pessoas ou dados pessoais.
4. Confirme que o pedido continua Em rota.
5. No Admin → Entregas, abra o comprovante pendente.
6. Teste Recusar e depois envie outro.
7. Teste Aprovar entrega.
8. Confirme que o pedido passa para Entregue somente após aprovação.

## Observação sobre pedidos antigos

A confirmação é criada para pedidos novos feitos após a V6.8.1. Para evitar inconsistências, finalize qualquer entrega que já esteja Em rota antes de instalar esta versão.
