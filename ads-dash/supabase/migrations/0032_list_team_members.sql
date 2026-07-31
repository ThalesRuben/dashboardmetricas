-- RPC list_team_members()
-- Retorna todos os membros do(s) tenant(s) do usuário autenticado,
-- cruzando memberships + profiles + auth.users. Usado no /settings pra
-- substituir a lista INITIAL_USERS hardcoded.
--
-- security definer é obrigatório pra ler auth.users (que exige service_role).
-- A função filtra internamente por current_user_tenants(), então só devolve
-- membros do MESMO tenant do chamador — nunca vaza usuários de outros tenants.

create or replace function public.list_team_members()
returns table (
  id            uuid,
  full_name     text,
  email         text,
  role          text,
  member_since  timestamptz,
  last_sign_in  timestamptz
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    p.id,
    coalesce(p.full_name, '')::text as full_name,
    coalesce(u.email, '')::text     as email,
    m.role,
    m.created_at                    as member_since,
    u.last_sign_in_at               as last_sign_in
  from public.memberships m
  join public.profiles p on p.id = m.user_id
  join auth.users      u on u.id = m.user_id
  where m.tenant_id in (select public.current_user_tenants())
  order by m.created_at desc, p.full_name;
$$;

grant execute on function public.list_team_members() to authenticated;
notify pgrst, 'reload schema';
