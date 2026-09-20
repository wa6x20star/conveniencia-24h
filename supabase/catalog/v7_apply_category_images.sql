-- Associa as imagens próprias por categoria aos produtos V7.
-- Requer os arquivos correspondentes em public/catalog/ no deploy da aplicação.
with mapping(category_slug, image_url) as (
  values
    ('mercearia', '/catalog/mercearia.png'),
    ('cuscuz-e-farinhas', '/catalog/cuscuz-e-farinhas.png'),
    ('cafe-da-manha', '/catalog/cafe-da-manha.png'),
    ('enlatados', '/catalog/enlatados.png'),
    ('temperos-e-molhos', '/catalog/temperos-e-molhos.png'),
    ('bebidas', '/catalog/bebidas.png'),
    ('bomboniere', '/catalog/bomboniere.png'),
    ('higiene', '/catalog/higiene.png'),
    ('limpeza', '/catalog/limpeza.png'),
    ('utilidades', '/catalog/utilidades.png')
)
update public.products p
set image_url = m.image_url,
    updated_at = now()
from public.categories c
join mapping m on m.category_slug = c.slug
where p.category_id = c.id
  and p.sku like '%-V7-%';
