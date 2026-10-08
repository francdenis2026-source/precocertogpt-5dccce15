-- Contador de visitas do site: uma linha por página aberta, de visitantes
-- cadastrados ou não. Assim como product_events, a tabela crua fica privada
-- (sem policy de SELECT); a leitura é só agregada e só para administradores.

create table if not exists public.page_views (
  id bigint generated always as identity primary key,
  path text not null,
  referrer text,
  session_id text not null,
  created_at timestamptz not null default now()
);

create index if not exists page_views_created_idx
  on public.page_views (created_at desc);

alter table public.page_views enable row level security;

drop policy if exists "anyone can log page views" on public.page_views;
create policy "anyone can log page views" on public.page_views
  for insert
  to anon, authenticated
  with check (char_length(path) <= 300 and char_length(session_id) <= 100);

-- Visitas por dia: visitantes únicos (por navegador) e páginas abertas.
create or replace function public.get_site_traffic(days int default 30)
returns table(day date, visitors bigint, page_views bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role in ('super_admin', 'admin', 'moderator')
  ) then
    raise exception 'Sem permissão administrativa' using errcode = '42501';
  end if;

  return query
    select (pv.created_at at time zone 'America/Rio_Branco')::date as day,
           count(distinct pv.session_id) as visitors,
           count(*) as page_views
    from public.page_views pv
    where pv.created_at >= now() - (days || ' days')::interval
    group by 1
    order by 1 desc;
end;
$$;

revoke all on function public.get_site_traffic(int) from public, anon;
grant execute on function public.get_site_traffic(int) to authenticated;
