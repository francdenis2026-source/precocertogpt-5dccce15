-- Atualização de preços do Comercial Parceirão a partir de fotos de congelados, hortifruti e ovos (08/10/2026).
-- Idempotente: cria produtos ausentes e atualiza somente o preço mais recente da loja.

insert into public.products (name, brand, category, size, unit, slug)
select v.name, v.brand, v.category, v.size, v.unit, v.slug
from (values
  ('Pé de Galinha Sabbor (Kg)', 'Sabbor', 'acougue', 'kg', 'kg', 'pe-de-galinha-sabbor-kg'),
  ('Galinha Noroeste (Kg)', 'Noroeste', 'acougue', 'kg', 'kg', 'galinha-noroeste-kg'),
  ('Peito de Frango Friato (Kg)', 'Friato', 'acougue', 'kg', 'kg', 'peito-de-frango-friato-kg')
) as v(name, brand, category, size, unit, slug)
where not exists (select 1 from public.products p where p.slug = v.slug);

with desired(slug, value) as (
  values
    ('charque-riomar-ponta-de-agulha-400g', 27::numeric),
    ('coxa-de-frango-sadia', 22),
    ('coxa-e-sobrecoxa-dessosada-sadia', 35),
    ('sobrecoxa-sadia', 21),
    ('file-de-peito-friato', 30),
    ('sobrecoxa-friato', 21),
    ('frango-seara-kg', 19),
    ('frango-inteiro-com-miudos-sabbor-kg', 14),
    ('frango-nutriza-kg', 20),
    ('limao-kg', 15),
    ('polpa-de-maracuja-1kg', 32),
    ('polpa-de-abacaxi-com-hortela-1kg', 30),
    ('duzia-de-ovos-12un', 12),
    ('cartela-de-ovos-branco-30un', 24),
    ('pe-de-galinha-sabbor-kg', 7.5),
    ('galinha-noroeste-kg', 15),
    ('peito-de-frango-friato-kg', 19.5)
),
resolved as (
  select p.id as product_id, d.value, e.id as establishment_id
  from desired d
  join public.products p on p.slug = d.slug
  cross join lateral (
    select id from public.establishments
    where name = 'COMERCIAL PARCEIRÃO'
    limit 1
  ) e
),
latest as (
  select distinct on (pr.product_id) pr.id, pr.product_id
  from public.prices pr
  join resolved r
    on r.product_id = pr.product_id
   and r.establishment_id = pr.establishment_id
  order by pr.product_id, pr.captured_at desc, pr.id desc
),
updated as (
  update public.prices pr
  set
    previous_value = case when pr.value <> r.value then pr.value else pr.previous_value end,
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
