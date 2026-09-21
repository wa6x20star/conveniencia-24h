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

## Próxima proteção obrigatória

Antes de entregar logins a clientes, a próxima migração deve substituir as
políticas antigas que dependem apenas do papel global do token por políticas
que também verificam `store_memberships`. Isso protege o acesso direto à API do
banco, além da proteção já aplicada nas rotas do site.
