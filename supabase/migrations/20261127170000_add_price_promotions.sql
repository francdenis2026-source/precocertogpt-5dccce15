-- Promoções com validade no preço de cada loja (ex.: Black Friday).
-- Enquanto promo_until não passou, o app mostra o valor promocional com selo;
-- depois, mostra sozinho o preço normal guardado em regular_value.
alter table public.prices
  add column if not exists promo_label text,
  add column if not exists promo_until timestamptz,
  add column if not exists regular_value numeric(10,2);

alter table public.prices drop constraint if exists prices_promo_consistency;
alter table public.prices add constraint prices_promo_consistency check (
  (promo_label is null and promo_until is null)
  or (promo_label is not null and promo_until is not null and char_length(promo_label) <= 40)
);
