-- Atualização de preços do Comercial Parceirão a partir de fotos de prateleira e nota de 03/10/2026.
-- Idempotente: cria produtos ausentes e atualiza somente o preço mais recente da loja.

insert into public.products (name, brand, category, size, unit, slug)
select v.name, v.brand, v.category, v.size, v.unit, v.slug
from (values
  ('Biscoito Salt Plus Integral Brandini 360g', 'Brandini', 'biscoitos', '360g', 'un', 'biscoito-salt-plus-integral-brandini-360g'),
  ('Biscoito Água e Sal Brandini 350g', 'Brandini', 'biscoitos', '350g', 'un', 'biscoito-agua-e-sal-brandini-350g'),
  ('Fórmula Infantil Nestlé NAN Comfor 1 400g', 'Nestlé', 'laticinios', '400g', 'un', 'formula-infantil-nestle-nan-comfor-1-400g'),
  ('Composto Lácteo Nestlé Neslac Comfor 800g', 'Nestlé', 'laticinios', '800g', 'un', 'composto-lacteo-nestle-neslac-comfor-800g'),
  ('Leite em Pó Italac Integral Instantâneo 400g', 'Italac', 'laticinios', '400g', 'un', 'leite-em-po-italac-integral-instantaneo-400g'),
  ('Nissin Lámen Galinha Caipira Picante 80g', 'Nissin', 'mercearia', '80g', 'un', 'nissin-lamen-galinha-caipira-picante-80g'),
  ('Tempero Sazón Nordeste 60g', 'Sazón', 'condimentos', '60g', 'un', 'tempero-sazon-nordeste-60g'),
  ('Tempero Sazón Toque de Limão 60g', 'Sazón', 'condimentos', '60g', 'un', 'tempero-sazon-toque-de-limao-60g'),
  ('Tempero Sazón Feijão 60g', 'Sazón', 'condimentos', '60g', 'un', 'tempero-sazon-feijao-60g'),
  ('Vinagre de Álcool Colorido Castelo 750ml', 'Castelo', 'condimentos', '750ml', 'un', 'vinagre-de-alcool-colorido-castelo-750ml'),
  ('Neston 3 Cereais Nestlé Lata 360g', 'Nestlé', 'mercearia', '360g', 'un', 'neston-3-cereais-nestle-lata-360g'),
  ('Farinha Láctea Nestlé Lata 360g', 'Nestlé', 'mercearia', '360g', 'un', 'farinha-lactea-nestle-lata-360g'),
  ('Farinha Láctea Nutrimental 180g', 'Nutrimental', 'mercearia', '180g', 'un', 'farinha-lactea-nutrimental-180g'),
  ('Achocolatado Nescau 30% Cacau 180g', 'Nestlé', 'bebidas_em_po', '180g', 'un', 'achocolatado-nescau-30-cacau-180g'),
  ('Caixa de Bombom Garoto Sortidos 220g', 'Garoto', 'mercearia', '220g', 'un', 'caixa-de-bombom-garoto-sortidos-220g'),
  ('Caixa de Bombom Lacta Favoritos 131,4g', 'Lacta', 'mercearia', '131,4g', 'un', 'caixa-de-bombom-lacta-favoritos-131-4g'),
  ('Doce de Leite Cremoso Aurea 350g', 'Aurea', 'mercearia', '350g', 'un', 'doce-de-leite-cremoso-aurea-350g'),
  ('Goiabada Xavante Lata', 'Xavante', 'mercearia', 'un', 'un', 'goiabada-xavante-lata'),
  ('Cereal Integral Nestlé Corn Flakes 190g', 'Nestlé', 'mercearia', '190g', 'un', 'cereal-integral-nestle-corn-flakes-190g'),
  ('Mingau de Aveia e Arroz Nutrilon 180g', 'Nutrilon', 'mercearia', '180g', 'un', 'mingau-de-aveia-e-arroz-nutrilon-180g'),
  ('Café em Pó Contri 250g', 'Contri', 'mercearia', '250g', 'un', 'cafe-em-po-contri-250g'),
  ('Café Sarah Extra Forte 250g', 'Sarah', 'mercearia', '250g', 'un', 'cafe-sarah-extra-forte-250g'),
  ('Café Santa Clara Clássico 250g', 'Santa Clara', 'mercearia', '250g', 'un', 'cafe-santa-clara-classico-250g'),
  ('Cápsula Café com Leite 3 Corações', '3 Corações', 'mercearia', 'un', 'un', 'capsula-cafe-com-leite-3-coracoes'),
  ('Biscoito Cream Cracker Belma 330g', 'Belma', 'biscoitos', '330g', 'un', 'biscoito-cream-cracker-belma-330g'),
  ('Biscoito Maizena Belma 300g', 'Belma', 'biscoitos', '300g', 'un', 'biscoito-maizena-belma-300g'),
  ('Biscoito Vitarella Maria Leite', 'Vitarella', 'biscoitos', 'un', 'un', 'biscoito-vitarella-maria-leite'),
  ('Biscoito Vitarella Delicitá Cristal', 'Vitarella', 'biscoitos', 'un', 'un', 'biscoito-vitarella-delicita-cristal'),
  ('Biscoito Marilan Maizena Farinha Láctea 300g', 'Marilan', 'biscoitos', '300g', 'un', 'biscoito-marilan-maizena-farinha-lactea-300g'),
  ('Biscoito Marilan Maizena Leite 300g', 'Marilan', 'biscoitos', '300g', 'un', 'biscoito-marilan-maizena-leite-300g'),
  ('Biscoito Marilan Maizena Chocolate 300g', 'Marilan', 'biscoitos', '300g', 'un', 'biscoito-marilan-maizena-chocolate-300g'),
  ('Biscoito Marilan Maizena 300g', 'Marilan', 'biscoitos', '300g', 'un', 'biscoito-marilan-maizena-300g')
) as v(name, brand, category, size, unit, slug)
where not exists (select 1 from public.products p where p.slug = v.slug);

with desired(slug, value) as (
  values
    ('fiambre-pampeano-320g', 10::numeric),
    ('carne-bovina-pampeano-chunky-320g', 12),
    ('carne-bovina-em-conserva-bertin-320g', 12),
    ('cafe-rio-acre-250g', 13),
    ('oleo-de-soja-soya-900ml', 10),
    ('cafe-santa-clara-soluvel-100g', 20),
    ('achocolatado-nescau-nestle-lata-200g', 9),
    ('nissin-lamen-carne-picante-80g', 3),
    ('leite-em-po-italac-integral-400g', 16),
    ('cafe-em-po-vovo-pureza-250g', 15.5),
    ('achocolatado-nescau-nestle-350g', 16),
    ('macarrao-todeschini-spaghetti-500g', 4),
    ('cafe-soluvel-santa-clara-classico-vidro-50g', 13),
    ('achocolatado-nescau-60-cacau-180g', 20),
    ('vinagre-toscano-alcool-colorido-750ml', 4),
    ('vinagre-toscano-ervas-finas-750ml', 9),
    ('leite-em-po-itambe-integral-400g', 16),
    ('bolacha-marilan-cream-cracker-manteiga-300g', 4.99),
    ('suco-brassuk-familia-300g', 7.95),
    ('leite-em-po-ninho-integral-380g', 27),
    ('leite-em-po-ninho-integral-instantaneo-380g', 28),
    ('leite-em-po-integral-piracanjuba-400g', 17),
    ('fiambre-anglo-lata-320g', 11),
    ('miojo-nissin-lamen-calabresa-picante-80g', 3),
    ('macarrao-dona-benta-espaguete-500g', 5),
    ('vinagre-de-alcool-castelo-750ml', 4),
    ('neston-3-cereais-210g', 10),
    ('nutella-350g', 33),
    ('doce-de-leite-aurea-250g', 7),
    ('cereal-nestle-snow-flakes-120g', 7.5),
    ('cereal-nestle-nescau-120g', 7.5),
    ('cafe-santa-clara-extraforte-250g', 23),
    ('cafe-3-coracoes-extraforte-vacuo-250g', 23.5),
    ('biscoito-cream-cracker-todeschini-manteiga-360g', 5.5),
    ('biscoito-marilan-manteiga-300g', 8),
    ('refrigerante-fanta-laranja-2l', 9.99),
    ('feijoada-bordon-430g', 13),
    ('biscoito-salt-plus-integral-brandini-360g', 8),
    ('biscoito-agua-e-sal-brandini-350g', 7),
    ('formula-infantil-nestle-nan-comfor-1-400g', 46),
    ('composto-lacteo-nestle-neslac-comfor-800g', 65),
    ('leite-em-po-italac-integral-instantaneo-400g', 16),
    ('nissin-lamen-galinha-caipira-picante-80g', 3),
    ('tempero-sazon-nordeste-60g', 6),
    ('tempero-sazon-toque-de-limao-60g', 6),
    ('tempero-sazon-feijao-60g', 6),
    ('vinagre-de-alcool-colorido-castelo-750ml', 4),
    ('neston-3-cereais-nestle-lata-360g', 24),
    ('farinha-lactea-nestle-lata-360g', 24),
    ('farinha-lactea-nutrimental-180g', 7.5),
    ('achocolatado-nescau-30-cacau-180g', 20),
    ('caixa-de-bombom-garoto-sortidos-220g', 14),
    ('caixa-de-bombom-lacta-favoritos-131-4g', 13),
    ('doce-de-leite-cremoso-aurea-350g', 8),
    ('goiabada-xavante-lata', 15),
    ('cereal-integral-nestle-corn-flakes-190g', 11.5),
    ('mingau-de-aveia-e-arroz-nutrilon-180g', 4.99),
    ('cafe-em-po-contri-250g', 15),
    ('cafe-sarah-extra-forte-250g', 14),
    ('cafe-santa-clara-classico-250g', 23),
    ('capsula-cafe-com-leite-3-coracoes', 23),
    ('biscoito-cream-cracker-belma-330g', 4.99),
    ('biscoito-maizena-belma-300g', 5),
    ('biscoito-vitarella-maria-leite', 5.99),
    ('biscoito-vitarella-delicita-cristal', 5.99),
    ('biscoito-marilan-maizena-farinha-lactea-300g', 7),
    ('biscoito-marilan-maizena-leite-300g', 7),
    ('biscoito-marilan-maizena-chocolate-300g', 7),
    ('biscoito-marilan-maizena-300g', 7)
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
