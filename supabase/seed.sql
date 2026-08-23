-- Dados de demonstração opcionais para desenvolvimento.
with p as (
  insert into public.products (sku, name, category_id, unit)
  values
    ('BEB-0001', 'Coca-Cola 2L', (select id from public.categories where slug='bebidas'), 'un'),
    ('GEL-0001', 'Gelo 5 kg', (select id from public.categories where slug='gelo'), 'pct'),
    ('BOM-0001', 'Chocolate ao leite', (select id from public.categories where slug='bomboniere'), 'un'),
    ('SAL-0001', 'Doritos 120 g', (select id from public.categories where slug='salgadinhos'), 'un'),
    ('BEB-0002', 'Água mineral 1,5L', (select id from public.categories where slug='bebidas'), 'un'),
    ('BEB-0003', 'Energético 473 ml', (select id from public.categories where slug='bebidas'), 'un')
  returning id, sku
), sp as (
  insert into public.store_products (store_id, product_id, price, cost, minimum_stock, active, sector, shelf)
  select s.id, p.id,
    case p.sku
      when 'BEB-0001' then 10.99
      when 'GEL-0001' then 7.50
      when 'BOM-0001' then 6.99
      when 'SAL-0001' then 11.49
      when 'BEB-0002' then 4.49
      when 'BEB-0003' then 9.99
    end,
    null,
    case p.sku when 'GEL-0001' then 6 when 'SAL-0001' then 8 when 'BEB-0003' then 10 else 5 end,
    true,
    case when p.sku like 'BEB%' then 'Geladeiras' when p.sku='GEL-0001' then 'Freezer' else 'Bomboniere' end,
    case p.sku when 'BEB-0001' then 'B' when 'GEL-0001' then '01' when 'BOM-0001' then '03' else null end
  from p cross join public.stores s
  where s.slug = 'piedade'
  returning id, product_id
)
insert into public.inventory (store_product_id, on_hand, reserved)
select sp.id,
  case pr.sku
    when 'BEB-0001' then 18
    when 'GEL-0001' then 9
    when 'BOM-0001' then 24
    when 'SAL-0001' then 11
    when 'BEB-0002' then 30
    when 'BEB-0003' then 14
  end,
  0
from sp
join public.products pr on pr.id = sp.product_id;
