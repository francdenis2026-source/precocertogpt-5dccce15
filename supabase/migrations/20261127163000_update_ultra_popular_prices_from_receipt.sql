-- Atualização de preços da Drogaria Ultra Popular a partir da nota de 27/11/2026.
-- Idempotente: cria produtos ausentes e atualiza só o preço mais recente da loja,
-- guardando o valor anterior em previous_value quando o preço muda.

insert into public.products (name, brand, category, size, unit, slug)
select v.name, v.brand, v.category, v.size, v.unit, v.slug
from (values
  ('Florent 200mg 6 Cápsulas', 'Florent', 'farmacia', '6caps', 'un', 'florent-200mg-6-capsulas'),
  ('Soro Hidrali 45 Tutti Frutti 500ml', 'Hidrali', 'farmacia', '500ml', 'un', 'soro-hidrali-45-tutti-frutti-500ml')
) as v(name, brand, category, size, unit, slug)
where not exists (select 1 from public.products p where p.slug = v.slug);

with desired(slug, value) as (
  values
    ('florent-200mg-6-capsulas', 38.18::numeric),
    ('soro-hidrali-45-tutti-frutti-500ml', 13.99),
    ('leite-em-po-ninho-integral-380g', 18.49)
),
resolved as (
  select distinct on (d.slug) p.id as product_id, d.value, 'f773cd4e-4561-48e7-a438-3ff26790d22a'::uuid as establishment_id
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
