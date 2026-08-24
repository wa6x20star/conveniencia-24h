# V5 — Login + Controle de Estoque

Esta versão adiciona um controle operacional de estoque em `/admin/estoque`.

## O que a tela permite

- Ver estoque físico, reservado e disponível.
- Ver quantidade vendida (baseada nas movimentações de venda dos pedidos).
- Registrar entrada/reposição.
- Registrar perda e avaria.
- Ajustar o saldo físico com justificativa.
- Registrar contagem de inventário.
- Consultar histórico das movimentações.
- Identificar produtos abaixo do estoque mínimo.

## Login

O login interno está em `/login` e usa o Supabase Auth.
Após o login, o usuário é direcionado para `/admin/estoque`.

## Banco

1. Se ainda não fez a instalação da V4, execute `supabase/V4_INSTALL.sql`.
2. Depois execute `supabase/V5_STOCK_CONTROL.sql` no SQL Editor do Supabase.
3. Mantenha na Vercel as variáveis descritas em `V4_SETUP.md`.

## Permissões

- `admin`: consulta e movimenta o estoque.
- `operation`: consulta o estoque, mas não pode fazer ajustes manuais.

As vendas não devem ser digitadas manualmente: quando um pedido passa de **Separando** para **Pronto**, a V4 consome o estoque reservado e cria uma movimentação `sale`, que aparece automaticamente na coluna Vendido e no histórico.
