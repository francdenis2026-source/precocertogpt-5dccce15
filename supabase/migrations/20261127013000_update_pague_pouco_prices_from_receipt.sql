-- Atualização de preços da Drogaria Pague Pouco a partir da nota de 26/11/2026.
-- Idempotente: cria produtos ausentes e atualiza só o preço mais recente da loja,
-- guardando o valor anterior em previous_value quando o preço muda.

insert into public.products (name, brand, category, size, unit, slug)
select v.name, v.brand, v.category, v.size, v.unit, v.slug
from (values
  ('Tadalafila 5mg 30 Comprimidos Revestidos Eurofarma (Genérico)', 'Eurofarma', 'farmacia', '30cp', 'un', 'tadalafila-5mg-30-comprimidos-revestidos-eurofarma-generico'),
  ('Preservativo Blowtex Morango com Chocolate 3 Unidades', 'Blowtex', 'farmacia', '3un', 'un', 'preservativo-blowtex-morango-com-chocolate-3-unidades'),
  ('Preservativo Blowtex Action Max 3 Unidades', 'Blowtex', 'farmacia', '3un', 'un', 'preservativo-blowtex-action-max-3-unidades')
) as v(name, brand, category, size, unit, slug)
where not exists (select 1 from public.products p where p.slug = v.slug);

with desired(slug, value) as (
  values
    ('tadalafila-5mg-30-comprimidos-revestidos-eurofarma-generico', 39.01::numeric),
    ('preservativo-blowtex-morango-com-chocolate-3-unidades', 7.99),
    ('preservativo-blowtex-action-max-3-unidades', 9.99)
),
resolved as (
  select distinct on (d.slug) p.id as product_id, d.value, 'eb1e6277-db89-4e94-950e-d14540ce71c6'::uuid as establishment_id
  from desired d
  join public.products p on p.slug = d.slug
  order by d.slug, p.created_at
),
latest as (
  select distinct on (pr.product_id) pr.id, pr.product_id
  from public.prices pr
  join resolved r on r.product_id = pr.product_id and r.establishment_id = pr.establishment_id
  order by pr.product_id, pr.captured_at desc, pr.id desc
),
updated as (
  update public.prices pr
  set previous_value = case when pr.value <> r.value then pr.value else pr.previous_value end,
      value = r.value,
      captured_at = now()
  from resolved r
  join latest l on l.product_id = r.product_id
  where pr.id = l.id
  returning pr.product_id
)
insert into public.prices (product_id, establishment_id, value, previous_value, captured_at)
select r.product_id, r.establishment_id, r.value, null, now()
from resolved r
where not exists (select 1 from latest l where l.product_id = r.product_id);
