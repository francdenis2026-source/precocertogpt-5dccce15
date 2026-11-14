-- Atualização de preços do Mercantil Rebouças a partir da nota de 14/11/2026.
-- Idempotente: cria produtos ausentes e atualiza só o preço mais recente da loja,
-- guardando o valor anterior em previous_value quando o preço muda.

insert into public.products (name, brand, category, size, unit, slug)
select v.name, v.brand, v.category, v.size, v.unit, v.slug
from (values
  ('Bolinho Bauducco', 'Bauducco', 'biscoitos', 'un', 'un', 'bolinho-bauducco')
) as v(name, brand, category, size, unit, slug)
where not exists (select 1 from public.products p where p.slug = v.slug);

with desired(slug, value) as (
  values
    ('frango-inteiro-com-miudos-sabbor-kg', 13.75::numeric),
    ('file-de-frango-bandeja', 27),
    ('refrigerante', 6),
    ('sardinha-robinson-crusoe-com-oleo-125g', 7),
    ('cebola-de-cabeca-kg', 10.5),
    ('leite-uht-italac-1l', 8.5),
    ('creme-de-leite', 2.5),
    ('coco-ralado-sococo-100g', 9),
    ('achocolatado-nescau-nestle-350g', 12.5),
    ('miojo-nissin', 3),
    ('macarrao-espaguete-todeschini-500g', 4.25),
    ('arroz-bom-paladar-1kg', 5),
    ('leite-em-po-dobom-400g', 13.5),
    ('manteiga-cabeca-de-touro-pote-200g', 16.5),
    ('pipoca-doce', 3),
    ('bolacha-amanteigada-todeschini-360g', 6),
    ('flocao-nutrivita-milho-500g', 3),
    ('detergente-ype-500ml', 3.25),
    ('bolinho-bauducco', 3),
    ('mistura-lactea-condensada-mococa-395g', 4.25)
),
resolved as (
  select distinct on (d.slug) p.id as product_id, d.value, 'c3f3df85-42fe-41ed-97a1-3115330783e2'::uuid as establishment_id
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
