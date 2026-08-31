# Conveniência 24h — V6.8.4

Cancelamentos, Estornos e Recuperação de Estoque. Base: ZIP V6.8.3 fornecido pelo responsável pelo projeto. Versão do package: `0.6.8-4`, seguindo a convenção anterior (`0.6.8-3`).

## Instalação sobre a V6.8.3

1. Faça backup do banco e guarde o ZIP/commit da versão atual. Teste primeiro em uma cópia de homologação.
2. Reserve uma janela curta sem alterações de pedidos, entregas ou repasses. Não é necessário compartilhar chaves com ninguém.
3. No SQL Editor do Supabase correto, execute **somente** `supabase/V6_8_4_CANCELAMENTOS.sql`. Ele pressupõe que V4, V5, V6.4, V6.5, V6.6, V6.7, V6.8 e V6.8.1 já foram instaladas. V6.8.2 e V6.8.3 não acrescentaram SQL.
4. O mesmo SQL está em `supabase/migrations/20260831164403_v684_cancelamentos.sql` para projetos que já mantêm o histórico de migrations por CLI. Use **uma** das formas de instalação. Não rode `db reset`, não reaplique `V4_INSTALL.sql` e não execute cegamente `db push` sobre um banco cujo histórico não esteja conciliado.
5. Substitua os arquivos da aplicação pelo conteúdo deste pacote, incluindo `package.json`, `package-lock.json` e a nova rota de estorno. Preserve as variáveis de ambiente existentes na Vercel. Nenhuma chave nova é necessária.
6. Execute `npm ci` e `npm run build`. Faça commit/push como de costume e aguarde o deploy ficar pronto. Não inclua `.env`, `node_modules`, `.next` ou credenciais no commit.
7. Recarregue os painéis da operação e do entregador para evitar telas antigas. Execute os testes abaixo e só então retome a operação.

O script SQL usa uma transação e aceita reaplicação. Uma falha de estoque cancela toda a transação da operação; não deixa metade do pedido cancelada. A implantação em produção não foi executada durante a preparação deste pacote.

## Regras da atualização

| Situação | Resultado ao cancelar |
| --- | --- |
| Recebido ou separando | Libera a reserva, sem aumentar o estoque físico |
| Pronto | Repõe o estoque físico já baixado na separação |
| Em entrega | Exige confirmação explícita de que todos os produtos retornaram à loja em condições de venda; depois repõe o estoque |
| Entregue, código confirmado ou foto aprovada | Cancelamento bloqueado |
| Já cancelado | Retorna o resultado existente; não movimenta estoque novamente |
| Pagamento recebido | Pedido cancelado e estorno pendente; não transfere dinheiro |
| Sem recebimento registrado | Cancela os pagamentos ainda não pagos; nenhum estorno exigido pelo sistema |

O motivo deve ter de 3 a 300 caracteres e será mostrado ao cliente. Não escreva dados internos, bancários ou sensíveis nesse campo. O cancelamento é definitivo: pedidos cancelados não podem ser reabertos.

Se os itens ainda estão com o entregador, foram perdidos, consumidos ou avariados, **não confirme o retorno ao estoque**. Esta versão não implementa devolução parcial ou quarentena. Recupere/confira os itens e trate perdas pelo fluxo de estoque apropriado; nunca recoloque como disponível um produto que não pode ser vendido.

Retirar apenas a atribuição do entregador continua mantendo o pedido pronto. A atribuição cancelada fica no histórico, com valor de repasse zerado, e uma nova atribuição pode ser criada. Isso corrige a restrição antiga de uma única linha de entrega por pedido; agora só pode haver uma entrega não cancelada por pedido.

## Pagamentos e estornos

- O recebimento é conferido no pedido, nos registros de pagamento e no recebimento declarado pelo entregador em comprovante fotográfico.
- Um pagamento marcado como pago não é apagado nem convertido automaticamente em estorno concluído. A situação da devolução fica em `orders.refund_status`, separada de `payment_status`.
- O valor pendente é o total integral do pedido, incluindo frete. Não há suporte a estorno parcial, múltiplos recebimentos conciliados ou processamento por gateway nesta versão.
- Em **Admin → Pedidos → Cancelados e estornos**, somente um administrador pode usar **Registrar estorno realizado**. É obrigatório informar a referência e confirmar que a devolução já aconteceu fora do sistema.
- A ação registra data, responsável, valor e referência. Não chama PIX, banco, cartão ou adquirente e não garante o prazo de crédito ao cliente.
- Usuários de operação veem a pendência, mas não podem concluir estornos. O servidor também verifica essa permissão.
- Se o cliente informar um pagamento que não está registrado, concilie-o antes de tratar o caso como encerrado. Não há integração de pagamentos nem reconciliação automática de recebimentos tardios neste pacote.
- Cancelamentos anteriores à V6.8.4 com recebimento registrado são classificados como pendentes para revisão. **O estoque antigo não é movimentado novamente** e responsáveis/datas desconhecidos não são inventados. Confirme se alguma devolução antiga já foi feita antes de realizar outro pagamento.

## Auditoria e notificações

Os campos `cancelled_at`, `cancelled_by`, `cancellation_source`, `stock_recovered_at`, `refund_status`, `refund_amount`, `refunded_at`, `refunded_by` e `refund_reference` ficam no pedido. Os responsáveis são identificados pelo UUID da conta, inclusive na tela administrativa. Os detalhes também ficam em `audit_logs`; a linha do tempo permanece em `order_status_history`. A liberação de reservas é registrada na auditoria; a reposição física gera movimento de tipo `cancellation`.

A expiração automática de reservas usa o mesmo cancelamento seguro, com responsável **Sistema**, e gera pendência se existir recebimento registrado. Comprovantes pendentes são encerrados no cancelamento, sem apagar as evidências. Entregas canceladas não entram em repasses. O entregador fica disponível somente quando não possui outra entrega ativa.

A central operacional mostra cancelamentos das últimas 24 horas e mantém estornos pendentes, inclusive antigos, na categoria Financeiro com prioridade crítica. Após o registro do estorno, o alerta financeiro desaparece na atualização seguinte (até 20 segundos); o aviso de cancelamento recente pode permanecer até completar 24 horas. A lista de pedidos busca pendências separadamente dos últimos 100 pedidos. Limites gerais do Data API do Supabase continuam aplicáveis em operações de grande volume.

O cliente vê pedido cancelado, motivo e situação do estorno. Dados do responsável, referência interna do estorno e comprovantes não são expostos pela API pública de acompanhamento.

## Testes de aceitação em homologação

Use produtos e pedidos de teste. Comece, por exemplo, com 10 unidades e nenhuma reserva, solicitando 2 unidades por pedido.

1. **Recebido:** após pedir, saldo físico 10/reserva 2. Cancele com motivo: saldo 10/reserva 0. Confirme motivo, data e conta responsável.
2. **Separando:** repita, avance para separação e cancele. Deve liberar apenas a reserva desse pedido, preservando reservas de outros pedidos.
3. **Pronto:** saldo esperado 8/reserva 0. Cancele: saldo 10/reserva 0, com um único movimento de devolução.
4. **Motivo:** tente vazio, espaços e menos de 3 caracteres. A tela e o servidor devem recusar.
5. **Repetição:** repita a requisição de cancelamento e clique duas vezes. Não pode ocorrer segunda devolução nem segunda auditoria de cancelamento.
6. **Entregador atribuído:** cancele pedido pronto. A entrega deve ficar cancelada, sem repasse; o entregador deve voltar a disponível. Se estiver offline, não deve ser colocado online automaticamente.
7. **Somente retirar entregador:** retire a atribuição de um pedido pronto e atribua novamente. O pedido deve continuar pronto, sem reposição de estoque.
8. **Em rota:** sem marcar retorno dos produtos, o cancelamento deve ser impedido. Depois de conferir o retorno físico, confirme e cancele. Código/foto não podem concluir essa entrega depois disso.
9. **Entrega concluída:** confirme normalmente por código e, em outro pedido, por foto aprovada. O cancelamento deve ser bloqueado em ambos. O repasse normal deve continuar funcionando uma única vez.
10. **Pago:** use um pedido de teste com recebimento registrado. Cancele: pagamento permanece identificado como recebido, estorno fica pendente pelo total e nenhum dinheiro é transferido automaticamente.
11. **Sem pagamento:** cancele pedido pendente. Estorno não deve ficar pendente. O cliente recebe orientação para contatar a loja se pagou fora do registro.
12. **Estorno manual:** como operação, confirme que não há ação para concluir e que a rota recusa acesso. Como administrador, informe referência fictícia e confirme devolução em um teste. Deve registrar uma única conclusão. Nunca faça uma transferência real para testar a tela.
13. **Comprovante pendente:** registre recebimento pelo entregador e envie foto de teste, depois cancele com retorno confirmado. Deve gerar estorno pendente e encerrar o alerta de aprovação da foto.
14. **Expiração:** deixe expirar uma reserva recebida. Verifique liberação única, auditoria de sistema e estorno pendente se houver pagamento.
15. **Inconsistência:** em cópia descartável, provoque reserva insuficiente. O cancelamento deve falhar sem alterar pedido, entrega, pagamentos ou auditoria. Não faça isso no banco real.
16. **Concorrência real (duas sessões):** tente cancelar ao mesmo tempo em que outra sessão confirma código/aprova foto/inicia entrega/atribui entregador. Apenas uma transição compatível pode concluir. Após a resposta, recarregue as duas telas e confira estoque e repasse. Se a entrega vencer, cancelamento deve ser recusado; se cancelamento vencer, conclusão deve ser recusada.
17. **Regressão:** crie pedido, confira frete e endereço, acompanhe, separe, atribua, entregue e registre repasse. Confira sino, filtros e notificações, inclusive em celular.

## Verificação feita neste pacote

- Build de produção do Next.js e checagem TypeScript: aprovados, sem credenciais de produção.
- Banco PostgreSQL isolado via PGlite: instalação das migrations anteriores + V6.8.4 e reaplicação da nova migration aprovadas.
- 16 cenários transacionais automatizados aprovados: estoque/reserva, idempotência, motivo, entrega, pagamento, estorno, expiração, rollback por inconsistência, reatribuição e permissões de execução das novas funções.
- Navegador: formulário de cancelamento, exigência de retorno dos itens em rota, registro de estorno e acompanhamento com aviso de estorno pendente conferidos com dados fictícios por um servidor local de testes. Nenhum erro de console foi observado nesse percurso. Esse teste da interface não substitui integração com o Supabase real.
- ESLint dos novos arquivos de cancelamento/estorno e da rota de status: aprovado. A análise dos demais arquivos alterados ainda aponta usos de `any` e efeitos de React presentes na base. Não foi declarada aprovação global de lint.
- Os testes usam tabelas mínimas de Auth/Storage simuladas, não uma instância Supabase completa. Não comprovam concorrência entre conexões, RLS com sessões reais, upload real de arquivos nem integração com provedor de pagamento.
- Código de frete, checkout, catálogo, painel do entregador e interface de repasses preservado. As funções usadas pelos fluxos de entrega foram ajustadas para bloquear primeiro o pedido e verificar cancelamento.

Para repetir os testes isolados: `npm ci --prefix tests` e `npm test --prefix tests`. Os dados são descartáveis e não há conexão com o banco da loja.

## Recuperação em caso de problema

Pause novas mutações e investigue a falha antes de tentar novamente. Não execute scripts antigos de instalação sobre o banco atualizado: eles podem substituir as proteções novas. Não apague auditorias, pagamentos ou movimentos para desfazer uma operação. Em caso de rollback de versão, restaure aplicação e banco de forma coordenada a partir do backup, considerando pedidos e pagamentos ocorridos após o backup. Restaurar só o código antigo não restaura os dados e pode desativar o fluxo de estornos.
