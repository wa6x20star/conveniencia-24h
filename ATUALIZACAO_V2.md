# Conveniência 24h — atualização V2

## O que mudou
- Nova identidade: Navy #1F2A44, Warm Beige #E8DCC8 e Soft Gold #C6A75E.
- Hero redesenhado com referência em e-commerce de mercado, sem copiar o modelo enviado.
- Busca de produtos funcional.
- Filtro de categorias funcional.
- Cards com suporte a fotos reais.
- Página de produto usando o catálogo editável.
- Admin > Produtos com cadastro e edição de:
  - foto;
  - nome;
  - categoria;
  - preço;
  - saldo;
  - selo;
  - ativo/inativo.
- Alterações do catálogo persistidas no localStorage nesta fase.

## Como testar
1. Acesse /admin/produtos.
2. Clique em EDITAR em um produto.
3. Escolha uma foto de até 1,5 MB, ajuste os dados e salve.
4. Volte para a página inicial no mesmo navegador.
5. A alteração já aparecerá na vitrine.

## Próxima fase
Conectar Supabase Database + Storage para que as alterações sejam permanentes, centralizadas e apareçam para todos os usuários/dispositivos.
