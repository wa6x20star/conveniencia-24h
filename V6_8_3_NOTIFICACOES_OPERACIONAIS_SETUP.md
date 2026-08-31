# V6.8.3 — Central de Notificações Operacionais

## O que entrou

- Sino de notificações no cabeçalho do painel, com contador de pendências.
- Cor vermelha no contador quando existir alerta crítico.
- Central completa em `/admin/notificacoes`.
- Atualização automática a cada 20 segundos e ao voltar para a aba do navegador.
- Som opcional somente quando surgir um novo pedido recebido após o painel já estar aberto.
- Ações rápidas que levam para Pedidos, Entregas, Estoque ou Repasses.
- Filtros por Pedidos, Entregas, Estoque e Financeiro.

## Pendências monitoradas

1. Novo pedido aguardando separação.
2. Pedido em separação por tempo acima do esperado.
3. Pedido pronto sem entregador.
4. PIX pendente por tempo acima do esperado.
5. Entrega em rota há mais de 60 minutos.
6. Comprovante por foto aguardando aprovação.
7. Código de confirmação temporariamente bloqueado.
8. Produtos zerados.
9. Produtos no estoque mínimo.
10. Repasses pendentes (somente para perfil administrador).

## Como funciona

A V6.8.3 não cria uma caixa de mensagens permanente. A API calcula as notificações usando o estado atual do banco. Se um pedido recebe entregador, por exemplo, o alerta "pedido pronto sem entregador" desaparece na atualização seguinte.

Isso evita notificações duplicadas e reduz manutenção no banco.

## Banco de dados

**Não há SQL novo nesta versão.**

Ela utiliza as tabelas já instaladas nas versões V6.5, V6.8 e V6.8.1.

## Teste rápido

1. Abra o painel administrativo e confirme que o sino aparece no cabeçalho.
2. Crie um pedido e mantenha-o em `Recebido`; ele deve aparecer no sino.
3. Coloque o pedido em separação; o alerta de novo pedido deve desaparecer.
4. Deixe um pedido em `Pronto` sem atribuir entregador; deve aparecer o alerta de entrega.
5. Atribua um entregador; o alerta deve desaparecer.
6. Se houver item zerado ou abaixo do mínimo, confira a categoria Estoque.
7. No perfil admin, confira o aviso de repasses pendentes quando existirem entregas ainda não pagas.
8. Ative o ícone de som no sino e crie um novo pedido enquanto o painel estiver aberto.

## Observação sobre som

Navegadores podem bloquear áudio antes da primeira interação do usuário. Ao ativar o botão 🔊, a V6.8.3 toca um som de teste e passa a usar a preferência salva naquele navegador.
