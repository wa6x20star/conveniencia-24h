import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "supabase/catalog/v7_conveniencia_24h.csv");
const output = resolve(root, "supabase/catalog/generated/v7_import.sql");
const csv = await readFile(source, "utf8");
const [header, ...lines] = csv.trim().split(/\r?\n/);
const expected = "sku|name|category|category_slug|subcategory|unit|reference_price|minimum_stock|active";
if (header !== expected) throw new Error("Cabeçalho CSV inesperado");

const rows = lines.map((line, index) => {
  const values = line.split("|");
  if (values.length !== 9 || values.some((value) => !value.trim())) throw new Error(`Linha inválida: ${index + 2}`);
  const [sku, name, category, categorySlug, subcategory, unit, price, minimumStock, active] = values;
  if (!/^[A-Z]{3}-V7-\d{3}$/.test(sku)) throw new Error(`SKU inválido: ${sku}`);
  if (!/^[a-z0-9-]+$/.test(categorySlug)) throw new Error(`Slug inválido: ${categorySlug}`);
  if (!/^\d+(\.\d{1,2})?$/.test(price) || Number(price) < 0) throw new Error(`Preço inválido: ${sku}`);
  if (!/^\d+$/.test(minimumStock)) throw new Error(`Estoque mínimo inválido: ${sku}`);
  if (!["true", "false"].includes(active)) throw new Error(`Status inválido: ${sku}`);
  return { sku, name, category, categorySlug, subcategory, unit, price, minimumStock, active };
});

if (rows.length !== 200) throw new Error(`Esperados 200 itens; encontrados ${rows.length}`);
if (new Set(rows.map((row) => row.sku)).size !== rows.length) throw new Error("SKUs duplicados");

const batchMatch = process.argv.find((arg) => /^--batch=[12]$/.test(arg));
const selectedRows = batchMatch ? rows.slice((Number(batchMatch.at(-1)) - 1) * 100, Number(batchMatch.at(-1)) * 100) : rows;

const sql = (value) => `'${String(value).replaceAll("'", "''")}'`;
const values = selectedRows.map((row) => `  (${[row.sku, row.name, row.category, row.categorySlug, row.subcategory, row.unit, row.price, row.minimumStock, row.active].map(sql).join(", ")})`).join(",\n");
const content = `-- GENERATED FILE. Fonte: supabase/catalog/v7_conveniencia_24h.csv\n-- Importação idempotente V7: somente INSERT; dados atuais não são atualizados.\nbegin;\n\nwith source(sku, name, category_name, category_slug, subcategory, unit, reference_price, minimum_stock, active) as (\n  values\n${values}\n), categories_to_insert as (\n  select distinct category_name as name, category_slug as slug\n  from source\n), inserted_categories as (\n  insert into public.categories (name, slug, active)\n  select c.name, c.slug, true\n  from categories_to_insert c\n  where not exists (select 1 from public.categories existing where existing.slug = c.slug)\n  returning id\n), new_products as (\n  insert into public.products (sku, name, description, category_id, image_url, unit, active)\n  select s.sku, s.name, 'Subcategoria: ' || s.subcategory, c.id, null, s.unit, s.active\n  from source s\n  join public.categories c on c.slug = s.category_slug\n  where not exists (select 1 from public.products existing where existing.sku = s.sku)\n  returning id, sku\n), new_store_products as (\n  insert into public.store_products (store_id, product_id, price, cost, minimum_stock, active, sector, badge)\n  select st.id, p.id, s.reference_price::numeric, null, s.minimum_stock::integer, s.active::boolean, s.category_name, 'Preço a revisar'\n  from new_products p\n  join source s on s.sku = p.sku\n  join public.stores st on st.slug = 'piedade'\n  where not exists (\n    select 1 from public.store_products existing\n    where existing.store_id = st.id and existing.product_id = p.id\n  )\n  returning id\n)\ninsert into public.inventory (store_product_id, on_hand, reserved)\nselect id, 0, 0\nfrom new_store_products\non conflict (store_product_id) do nothing;\n\n-- Validação: deve retornar 200 novos produtos e 200 novos vínculos após a primeira execução.\nselect\n  count(*) filter (where p.sku like '%-V7-%') as produtos_v7,\n  count(*) filter (where sp.active) as vinculos_v7_ativos,\n  coalesce(sum(i.on_hand), 0) as estoque_inicial_v7\nfrom public.products p\njoin public.store_products sp on sp.product_id = p.id\nleft join public.inventory i on i.store_product_id = sp.id\njoin public.stores st on st.id = sp.store_id\nwhere p.sku like '%-V7-%' and st.slug = 'piedade';\n\ncommit;\n`;
await mkdir(dirname(output), { recursive: true });
await writeFile(output, content.replace("s.unit, s.active\n", "s.unit, s.active::boolean\n"), "utf8");
console.log(`Gerado ${output} com ${selectedRows.length} produtos.`);
