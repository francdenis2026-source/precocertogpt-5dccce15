-- Atualização de preços do Comercial Vanderley a partir da nota de 05/10/2026.
-- Idempotente: cria produtos ausentes e atualiza somente o preço mais recente da loja.

insert into public.products (name, brand, category, size, unit, slug)
select v.name, v.brand, v.category, v.size, v.unit, v.slug
from (values
  ('Sorvete Boneco de Neve Romeu e Julieta 1L', 'Boneco de Neve', 'congelados', '1L', 'un', 'sorvete-boneco-de-neve-romeu-e-julieta-1l'),
  ('Sorvete Boneco de Neve Lambada 1L', 'Boneco de Neve', 'congelados', '1L', 'un', 'sorvete-boneco-de-neve-lambada-1l'),
  ('Caneta Hidrográfica Artists Markers 12 Cores', 'Artists Markers', 'papelaria', '12un', 'un', 'caneta-hidrografica-artists-markers-12-cores'),
  ('Caderno de Colorir Bobbie Goods', 'Bobbie Goods', 'papelaria', 'un', 'un', 'caderno-de-colorir-bobbie-goods'),
  ('Inseticida Kellthine Mata Baratas 400ml', 'Kellthine', 'limpeza', '400ml', 'un', 'inseticida-kellthine-mata-baratas-400ml')
) as v(name, brand, category, size, unit, slug)
where not exists (select 1 from public.products p where p.slug = v.slug);

with desired(slug, value) as (
  values
    ('trident-hortela', 3::numeric),
    ('incenso-super-wierook-20-unidades', 10),
    ('incenso-especial-30-pecas', 8),
    ('sorvete-boneco-de-neve-romeu-e-julieta-1l', 19),
    ('sorvete-boneco-de-neve-lambada-1l', 19),
    ('caneta-hidrografica-artists-markers-12-cores', 18),
    ('caderno-de-colorir-bobbie-goods', 20),
    ('inseticida-kellthine-mata-baratas-400ml', 15)
),
resolved as (
  select p.id as product_id, d.value, e.id as establishment_id
  from desired d
  join public.products p on p.slug = d.slug
  cross join lateral (
    select id from public.establishments
    where name = 'COMERCIAL VANDERLEY'
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
