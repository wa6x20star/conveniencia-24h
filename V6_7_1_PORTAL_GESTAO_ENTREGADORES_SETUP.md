# V6.7.1 — Portal e Gestão de Entregadores

Esta versão complementa a V6.7 sem alterar o fluxo principal de pedidos, estoque, frete ou acompanhamento do cliente.

## O que entrou

- Botão **Portal do Entregador** na aba administrativa de Entregas.
- Card de acesso com **Abrir portal**, **Copiar link** e **QR Code**.
- QR Code gerado localmente no navegador, apontando para `/entregador/login`.
- Resumo da equipe: Disponíveis, Em entrega, Offline e Total.
- Entregadores inativos continuam visíveis no painel para permitir reativação e preservar histórico.
- Card do entregador mostra última atualização e destaca o pedido atual quando existe entrega ativa.
- Administração pode editar nome e telefone.
- Administração pode desativar e reativar entregadores sem apagar histórico.
- Não é permitido desativar um entregador enquanto houver entrega atribuída ou em rota.
- Entregador reativado volta como **Offline** e decide quando ficar disponível.
- Login do entregador ganhou botão **Mostrar/Ocultar senha** e mensagens específicas para conta sem perfil `driver` ou conta inativa.
- Aviso para testes: use janela anônima/outro navegador para não substituir a sessão administrativa.

## Instalação

1. Substitua os arquivos do projeto atual pelos arquivos deste pacote.
2. Rode `npm install` para instalar a dependência `qrcode` usada no QR Code do portal.
3. Faça commit e push para o GitHub.
4. Aguarde o deploy da Vercel ficar `Ready`.

## Banco de dados

**Nenhuma migration SQL nova é obrigatória na V6.7.1.**

A versão usa apenas colunas e tabelas já existentes em `drivers`, `profiles` e `deliveries`.

## Teste recomendado

1. Entre como administrador e abra **Entregas**.
2. Confira os quatro indicadores da equipe.
3. Clique em **Portal do Entregador** e valide o QR Code.
4. Use **Copiar link** e abra o portal em janela anônima.
5. Edite o nome ou telefone de um entregador e confirme a atualização.
6. Desative um entregador sem entrega ativa e confirme que ele aparece como **Inativo**.
7. Tente entrar com essa conta: o login deve informar que o acesso está inativo.
8. Reative a conta e confirme que ela volta como **Offline**.
9. Faça login novamente e escolha **Ficar disponível** no painel do entregador.
10. Atribua um pedido e confirme que o número do pedido aparece destacado no card administrativo.

## Segurança

- Ações de editar, desativar e reativar exigem perfil `admin` no servidor.
- As alterações são limitadas aos entregadores da loja configurada.
- Entregas ativas impedem desativação da conta.
- Desativar não apaga usuário, histórico, ganhos ou entregas anteriores.
- O entregador continua vendo apenas informações vinculadas à própria conta.
