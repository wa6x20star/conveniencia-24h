# Piloto de múltiplas lojas

O projeto usa uma base de código e um banco de dados. Cada implantação define a
loja ativa com `NEXT_PUBLIC_STORE_SLUG`; catálogo, estoque, pedidos, entregas e
configuração de frete já são obtidos por esse identificador.

## O que já foi preparado

- `store_memberships` vincula um usuário a uma loja e a uma função (`admin`,
  `operation` ou `driver`).
- As rotas administrativas exigem esse vínculo para a loja da implantação.
- A instalação atual foi vinculada somente a `piedade`, preservando o acesso
  administrativo existente.
- A identidade pública agora é configurável por variáveis de ambiente, sem
  duplicar o layout ou o repositório.

## Criar uma nova instalação

1. Crie o registro da loja com um `slug` único, inicialmente com status
   `paused` enquanto o catálogo é revisado.
2. Vincule o administrador da loja em `store_memberships`; nunca reutilize a
   associação da Conveniência 24h.
3. Cadastre categorias, produtos, preços e estoque da nova loja. Use SKUs com
   prefixo do estabelecimento para não colidir com itens existentes.
4. Crie uma implantação separada do mesmo repositório e informe as variáveis
   abaixo. A instalação atual não deve ser alterada.
5. Teste catálogo, carrinho, pedido, painel e permissões usando uma conta da
   nova loja antes de abrir ao público.

## Exemplo de ambiente: Padaria Rebeca

```env
NEXT_PUBLIC_STORE_SLUG=padaria-rebeca
NEXT_PUBLIC_STORE_NAME=Padaria Rebeca
NEXT_PUBLIC_STORE_TAGLINE=Pães, cafés e sabores feitos para o seu dia.
NEXT_PUBLIC_STORE_SERVICE_LABEL=Confira nossos horários
NEXT_PUBLIC_STORE_LOCATION_LABEL=Jaboatão dos Guararapes
NEXT_PUBLIC_STORE_HERO_TITLE=O cheirinho do pão
NEXT_PUBLIC_STORE_HERO_HIGHLIGHT=chegou até você.
NEXT_PUBLIC_STORE_HERO_DESCRIPTION=Pães, salgados, bolos, cafés e produtos selecionados
NEXT_PUBLIC_STORE_HERO_IMAGE=/hero/hero-products-integrated.png
NEXT_PUBLIC_STORE_HERO_IMAGE_ALT=Produtos selecionados da Padaria Rebeca
NEXT_PUBLIC_STORE_QUICK_TERMS=Pão francês,Café,Salgado,Bolo,Refrigerante
NEXT_PUBLIC_STORE_PRIMARY_COLOR=#5B2C1D
NEXT_PUBLIC_STORE_ACCENT_COLOR=#D79A3B
NEXT_PUBLIC_STORE_ACCENT_DARK_COLOR=#A9681F
NEXT_PUBLIC_DEFAULT_CITY=Jaboatão dos Guararapes
NEXT_PUBLIC_DEFAULT_STATE=PE
```

Não publique essa instalação enquanto não houver telefone, catálogo, preços,
estoque e responsável confirmados pela padaria.

## Situação do piloto

- Loja criada: `padaria-rebeca`.
- Situação: `paused` — não fica disponível para compra.
- Administrador da plataforma vinculado apenas para a preparação inicial.
- Categorias prontas para o catálogo: Pães, Salgados, Bolos e Doces, Cafés e
  Bebidas Quentes e Industrializados.
- Produtos cadastrados: nenhum. A inclusão depende da relação confirmada pela
  padaria, com preço, estoque e imagem autorizada quando houver.

## Segurança de acesso entre lojas

As leituras administrativas de pedidos, itens, pagamentos, histórico, estoque,
movimentações, entregadores e entregas verificam uma associação ativa em
`store_memberships`. A regra anterior baseada somente no papel global do token
foi removida desses caminhos.

O catálogo público continua acessível apenas para lojas abertas. A criação de
um novo administrador exige primeiro criar seu usuário e, depois, uma
associação explícita à loja correta; não reutilize acesso de outra loja.
