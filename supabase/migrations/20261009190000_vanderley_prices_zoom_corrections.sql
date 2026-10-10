-- Comercial Vanderley: etiquetas que ficaram de fora da carga de 09/10/2026
-- e foram resolvidas ao ampliar as fotos. Idempotente (produto por slug).

insert into public.products (name, brand, category, size, unit, slug)
select v.name, v.brand, v.category, v.size, v.unit, v.slug
from (values
  ('Biscoito Doce Maizena Estrela 350g', 'Estrela', 'biscoitos', '350g', 'un', 'biscoito-doce-maizena-estrela-350g'),
  ('Biscoito Rosquinha Sabor Coco Todeschini 300g', 'Todeschini', 'biscoitos', '300g', 'un', 'biscoito-rosquinha-sabor-coco-todeschini-300g'),
  ('Biscoito Rosquinha Sabor Leite Todeschini 300g', 'Todeschini', 'biscoitos', '300g', 'un', 'biscoito-rosquinha-sabor-leite-todeschini-300g'),
  ('Sabão em Barra Minuano Ultra', 'Minuano', 'limpeza', null, 'un', 'sabao-em-barra-minuano-ultra'),
  ('Leite de Coco Coco Show PET', 'Coco Show', 'laticinios', null, 'un', 'leite-de-coco-coco-show-pet'),
  ('Sabão em Pó Omo Puro Cuidado Caixa 800g', 'Omo', 'limpeza', '800g', 'un', 'sabao-em-po-omo-puro-cuidado-caixa-800g'),
  ('Caixa Cerveja Antarctica Subzero 15x269ml', 'Antarctica', 'bebidas', '15x269ml', 'un', 'caixa-cerveja-antarctica-subzero-15x269ml')
) as v(name, brand, category, size, unit, slug)
where not exists (select 1 from public.products p where p.slug = v.slug);

with desired(slug, value) as (
  values
    ('biscoito-doce-maizena-estrela-350g', 7.00::numeric),
    ('biscoito-rosquinha-sabor-coco-todeschini-300g', 6.00),
    ('biscoito-rosquinha-sabor-leite-todeschini-300g', 6.00),
    ('sabao-em-barra-minuano-ultra', 15.00),
    ('leite-de-coco-coco-show-pet', 9.00),
    ('sabao-em-po-omo-puro-cuidado-caixa-800g', 14.99),
    ('caixa-cerveja-antarctica-subzero-15x269ml', 50.00)
),
resolved as (
  select p.id as product_id, d.value, e.id as establishment_id
  from desired d
  join public.products p on p.slug = d.slug
  cross join lateral (select id from public.establishments where name = 'COMERCIAL VANDERLEY' limit 1) e
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
      value = r.value, captured_at = now()
  from resolved r join latest l on l.product_id = r.product_id
  where pr.id = l.id
  returning pr.product_id
)
insert into public.prices (product_id, establishment_id, value, previous_value, captured_at)
select r.product_id, r.establishment_id, r.value, null, now()
from resolved r
where not exists (select 1 from latest l where l.product_id = r.product_id);
