# Catálogo V7 — conveniência 24h

Este lote é uma seleção própria de itens para conveniência em Pernambuco. Os nomes, marcas, pesos e categorias foram conferidos contra páginas públicas do Atacadão como referência factual; não inclui fotos, descrições comerciais ou textos promocionais daquela loja.

`v7_conveniencia_24h.csv` é a fonte de verdade do lote. Ele contém SKU estável, categoria, subcategoria de gestão, preço provisório de referência, estoque mínimo e status. As subcategorias ficam no arquivo de importação/documentação porque o esquema atual não possui uma coluna própria para elas.

## Gerar e executar

1. Revise os preços provisórios no CSV antes de ativar o lote para venda.
2. Com Node.js, execute `node scripts/generate-v7-catalog-sql.mjs --batch=1` e depois `node scripts/generate-v7-catalog-sql.mjs --batch=2` na raiz do projeto. Cada comando gera 100 itens em `supabase/catalog/generated/v7_import.sql`.
3. Execute o arquivo gerado em uma transação no SQL Editor do Supabase após cada lote.
4. Rode o bloco de validação ao final do SQL.

O SQL só insere categorias, produtos, vínculos da Loja Piedade e inventário que ainda não existem. Ele nunca usa `DO UPDATE`: SKUs ou vínculos existentes são preservados integralmente. O estoque inicial de cada item novo é zero e todos os itens ficam ativos, conforme solicitado.

## Preços

Os valores são referências provisórias de varejo para preencher o campo obrigatório `store_products.price`; não são preços do Atacadão nem recomendação de preço final. Eles devem ser revisados pela administração antes de repor/colocar os itens à venda. As referências públicas observadas em 20/09/2026 incluem Café Pilão Tradicional 500g, Arroz Tio João 1kg e Feijão Carioca Broto Legal 1kg. Nenhuma imagem foi importada.
