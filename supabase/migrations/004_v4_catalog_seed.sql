-- Catálogo inicial V4. Executado uma única vez como migration.
with seed(sku,name,category_slug,image_url,price,compare_at_price,badge,stock,minimum_stock) as (
  values
  ('BEB-0001','Coca-Cola Original 2L','bebidas','https://www.powellsnl.ca/media/uploads/gs1/06700000427_20.png',10.99,12.49,'Oferta',18,5),
  ('BEB-0002','Guaraná Antarctica 2L','bebidas','https://m.media-amazon.com/images/I/61aFUMfXk2L._SL1000_.jpg',9.99,null,'Mais vendido',16,5),
  ('BEB-0003','Fanta Laranja 2L','bebidas','https://cdn.awsli.com.br/800x800/1847/1847175/produto/94341333/364c5bdfdd.jpg',9.49,null,'',14,5),
  ('BEB-0004','Água Crystal sem gás 1,5L','bebidas','https://elofarma.com.br/BACKOFFICE/Uploads/Produto/Normal/7894900530032.jpg',4.49,null,'',30,8),
  ('BEB-0005','Red Bull Energy Drink 250ml','bebidas','https://down-br.img.susercontent.com/file/de3905e6d774d25363e21ac6a2ff7297',9.99,11.49,'Madrugada',20,6),
  ('GEL-0001','Gelo 5 kg','gelo',null,7.50,null,'24h',12,6),
  ('SAL-0001','Doritos Queijo Nacho 120g','salgadinhos','https://carrefourbrfood.vtexassets.com/arquivos/ids/193842562/salgadinho-queijo-nacho-doritos-120g-1.jpg?v=638876002921530000',11.49,null,'Mais vendido',15,6),
  ('SAL-0002','Ruffles Original 76g','salgadinhos','https://bretas.vtexassets.com/arquivos/ids/200103/6571ccc5558925a4e889be4e.jpg?v=638375536084870000',9.49,null,'',13,5),
  ('BOM-0001','Oreo Original 154g','bomboniere','https://www.tuquetraes.com/imagenes/productos/productos_vipges/A01029037.JPG',6.99,null,'',22,6),
  ('BOM-0002','Bis ao Leite 100,8g','bomboniere','https://images.tcdn.com.br/img/img_prod/1377318/chocolate_bis_100_8g_ao_leite_169_1_bc46a4e81dee4e6402c7608e4f4802f0.jpg',7.99,null,'Queridinho',18,5),
  ('BOM-0003','Sonho de Valsa 20g','bomboniere','https://images.tcdn.com.br/img/img_prod/1225570/sonho_de_valsa_20g_unidade_1677_2_11a8326e492eefeba861a208a5e1bb40.png',2.49,null,'',35,10),
  ('BOM-0004','Halls Extra Forte 27,5g','bomboniere','https://destro.fbitsstatic.net/img/p/bala-halls-preta-extra-forte-27-5g-71233/257769-1.jpg?h=500&qs=ignore&v=202501231555&w=500',2.99,null,'',28,8),
  ('BOM-0005','Trident Menta 30,6g','bomboniere','https://ideaspapeleria.com/images/002852/large/4178_0.jpg',5.49,null,'',25,8),
  ('BOM-0006','Paçoquita Original 18g','bomboniere','https://images.deliveryhero.io/image/global-menu-service/GV_PT/vendor/880476/product/87f22b4a-fa21-4e8a-a43f-e1568f816443.jpg',1.49,null,'',40,12),
  ('BEB-0006','Toddy Original 200g','bebidas','https://images-food.ifcshop.com.br/produto/45684_0_20211118104651.jpg',8.99,null,'',10,4),
  ('HIG-0001','Colgate Máxima Proteção 90g','higiene','https://images.tcdn.com.br/img/img_prod/1017481/creme_dental_maxima_protecao_anticaries_90g_colgate_20613_1_30120a5aa824e4057f956a4181329195.jpg',6.99,null,'Essencial',14,5),
  ('HIG-0002','Sabonete Dove Original 90g','higiene','https://io.convertiez.com.br/m/farmaponte/shop/products/images/21679/medium/sabonete-dove-original-barra-com-90g_38313.png',5.99,null,'',17,5),
  ('LIM-0001','Detergente Ypê Neutro 500ml','limpeza','https://images.tcdn.com.br/img/img_prod/1234949/detergente_neutro_ype_500ml_1177_1_1bfd127b8d8fe6b7eb77d4aadcee2b5c.jpeg',3.49,null,'Essencial',18,5),
  ('HIG-0003','Papel Higiênico Neve 4 rolos','higiene','https://images.tcdn.com.br/img/img_prod/694926/papel_higienico_folha_dupla_pacote_c_4_neve_290008_1_71c81b5ab27764f559adb879a450f5bb.jpg',11.99,null,'Última hora',11,4),
  ('UTI-0001','Pilha Duracell AA 2 unidades','utilidades','https://cdn.awsli.com.br/2500x2500/2248/2248510/produto/180107250/pilha-alcalina-duracell-palito-aa-pacote-2u-1-5vmpeuc4gh.jpg',14.99,null,'Última hora',9,4)
), up_products as (
  insert into public.products (sku,name,category_id,image_url,active)
  select s.sku,s.name,c.id,s.image_url,true from seed s join public.categories c on c.slug=s.category_slug
  on conflict (sku) do update set name=excluded.name, category_id=excluded.category_id, image_url=excluded.image_url, active=true, updated_at=now()
  returning id,sku
), up_sp as (
  insert into public.store_products (store_id,product_id,price,compare_at_price,badge,minimum_stock,active)
  select st.id,p.id,s.price,s.compare_at_price,s.badge,s.minimum_stock,true
  from seed s join up_products p on p.sku=s.sku cross join public.stores st where st.slug='piedade'
  on conflict (store_id,product_id) do update set price=excluded.price,compare_at_price=excluded.compare_at_price,badge=excluded.badge,minimum_stock=excluded.minimum_stock,active=true,updated_at=now()
  returning id,product_id
)
insert into public.inventory (store_product_id,on_hand,reserved)
select sp.id,s.stock,0
from up_sp sp join public.products p on p.id=sp.product_id join seed s on s.sku=p.sku
on conflict (store_product_id) do nothing;
