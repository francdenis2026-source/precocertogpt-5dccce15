-- Controle de cadastros no painel do administrador.
-- Lista todas as contas (auth.users) com status de e-mail, último acesso e
-- bloqueio, e permite confirmar e-mail, bloquear/desbloquear e excluir.
-- Leitura: super_admin, admin e moderator. Ações: só super_admin e admin.
-- Ninguém pode agir sobre a própria conta nem sobre um super_admin.

create or replace function public._admin_assert(_actions boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.user_roles
    where user_id = auth.uid()
      and (role in ('super_admin', 'admin') or (not _actions and role = 'moderator'))
  ) then
    raise exception 'Sem permissão administrativa' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public._admin_assert(boolean) from public, anon;

create or replace function public._admin_assert_target(_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if _user_id = auth.uid() then
    raise exception 'Você não pode alterar a sua própria conta por aqui' using errcode = '42501';
  end if;
  if exists (select 1 from public.user_roles where user_id = _user_id and role = 'super_admin') then
    raise exception 'Contas de super administrador não podem ser alteradas por aqui' using errcode = '42501';
  end if;
  if not exists (select 1 from auth.users where id = _user_id) then
    raise exception 'Conta não encontrada' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public._admin_assert_target(uuid) from public, anon;

create or replace function public.admin_list_user_accounts()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _result jsonb;
begin
  perform public._admin_assert(false);

  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id', u.id,
    'email', u.email,
    'name', coalesce(nullif(p.display_name, ''), u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'),
    'provider', coalesce(u.raw_app_meta_data->>'provider', 'email'),
    'created_at', u.created_at,
    'email_confirmed_at', u.email_confirmed_at,
    'last_sign_in_at', u.last_sign_in_at,
    'banned_until', u.banned_until,
    'roles', coalesce((select jsonb_agg(r.role order by r.role) from public.user_roles r where r.user_id = u.id), '[]'::jsonb)
  ) order by u.created_at desc), '[]'::jsonb)
  into _result
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.deleted_at is null;

  return _result;
end;
$$;

create or replace function public.admin_confirm_user_email(_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._admin_assert(true);
  perform public._admin_assert_target(_user_id);
  update auth.users
     set email_confirmed_at = coalesce(email_confirmed_at, now()),
         updated_at = now()
   where id = _user_id;
end;
$$;

create or replace function public.admin_set_user_blocked(_user_id uuid, _blocked boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._admin_assert(true);
  perform public._admin_assert_target(_user_id);
  update auth.users
     set banned_until = case when _blocked then 'infinity'::timestamptz else null end,
         updated_at = now()
   where id = _user_id;
  if _blocked then
    -- Encerra as sessões abertas para o bloqueio valer na hora.
    delete from auth.sessions where user_id = _user_id;
    delete from auth.refresh_tokens where user_id = _user_id::text;
  end if;
end;
$$;

create or replace function public.admin_delete_user_account(_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._admin_assert(true);
  perform public._admin_assert_target(_user_id);
  delete from auth.users where id = _user_id;
end;
$$;

revoke all on function public.admin_list_user_accounts() from public, anon;
revoke all on function public.admin_confirm_user_email(uuid) from public, anon;
revoke all on function public.admin_set_user_blocked(uuid, boolean) from public, anon;
revoke all on function public.admin_delete_user_account(uuid) from public, anon;
grant execute on function public.admin_list_user_accounts() to authenticated;
grant execute on function public.admin_confirm_user_email(uuid) to authenticated;
grant execute on function public.admin_set_user_blocked(uuid, boolean) to authenticated;
grant execute on function public.admin_delete_user_account(uuid) to authenticated;
