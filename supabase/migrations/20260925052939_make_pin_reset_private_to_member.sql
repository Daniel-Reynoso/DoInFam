create table private.member_pin_reset_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  family_id uuid not null,
  member_id uuid not null,
  authorized_by_user_id uuid not null references auth.users (id) on delete cascade,
  authorized_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  foreign key (family_id, member_id)
    references public.family_members (family_id, id) on delete cascade,
  check (expires_at > authorized_at),
  check (consumed_at is null or consumed_at >= authorized_at)
);

create unique index member_pin_reset_requests_one_active_idx
  on private.member_pin_reset_requests (family_id, member_id)
  where consumed_at is null;

create index member_pin_reset_requests_authorizer_idx
  on private.member_pin_reset_requests (authorized_by_user_id, expires_at desc);

alter table private.member_pin_reset_requests enable row level security;
revoke all on table private.member_pin_reset_requests from public, anon, authenticated;

drop function if exists public.reset_member_pin(uuid, text);

create or replace function public.authorize_member_pin_reset(p_member_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_family_id uuid;
  v_recent_auth jsonb;
  v_auth_method text;
  v_auth_timestamp bigint;
  v_request private.member_pin_reset_requests%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then
    raise exception using errcode = 'P0001', message = 'FAMILY_ADMIN_REQUIRED';
  end if;

  select access.family_id
    into v_family_id
  from public.family_auth_accounts as access
  where access.user_id = v_user_id
    and access.is_family_admin;

  if v_family_id is null then
    raise exception using errcode = 'P0001', message = 'FAMILY_ADMIN_REQUIRED';
  end if;

  select entry
    into v_recent_auth
  from jsonb_array_elements(coalesce(auth.jwt()->'amr', '[]'::jsonb)) as entry
  order by (entry->>'timestamp')::bigint desc
  limit 1;

  v_auth_method := v_recent_auth->>'method';
  v_auth_timestamp := nullif(v_recent_auth->>'timestamp', '')::bigint;

  if v_auth_method not in ('password', 'otp')
     or v_auth_timestamp is null
     or v_auth_timestamp < extract(epoch from now() - interval '10 minutes')::bigint then
    raise exception using errcode = 'P0001', message = 'RECENT_ADMIN_AUTH_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.family_members as member
    where member.id = p_member_id
      and member.family_id = v_family_id
      and member.is_active
  ) then
    raise exception using errcode = 'P0001', message = 'MEMBER_NOT_FOUND';
  end if;

  update private.member_pin_reset_requests
  set consumed_at = now()
  where family_id = v_family_id
    and member_id = p_member_id
    and consumed_at is null;

  insert into private.member_pin_reset_requests (
    family_id,
    member_id,
    authorized_by_user_id,
    expires_at
  ) values (
    v_family_id,
    p_member_id,
    v_user_id,
    now() + interval '30 minutes'
  ) returning * into v_request;

  return jsonb_build_object(
    'ok', true,
    'member_id', p_member_id,
    'expires_at', v_request.expires_at
  );
end;
$$;

create or replace function public.get_member_pin_reset_status(p_member_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_family_id uuid;
  v_request private.member_pin_reset_requests%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  select access.family_id
    into v_family_id
  from public.family_auth_accounts as access
  where access.user_id = v_user_id;

  if v_family_id is null then
    raise exception using errcode = 'P0001', message = 'FAMILY_NOT_CONFIGURED';
  end if;

  if not exists (
    select 1
    from public.family_members as member
    where member.id = p_member_id
      and member.family_id = v_family_id
      and member.is_active
  ) then
    raise exception using errcode = 'P0001', message = 'MEMBER_NOT_FOUND';
  end if;

  select * into v_request
  from private.member_pin_reset_requests as request
  where request.family_id = v_family_id
    and request.member_id = p_member_id
    and request.authorized_by_user_id = v_user_id
    and request.consumed_at is null
    and request.expires_at > now()
  order by request.authorized_at desc
  limit 1;

  return jsonb_build_object(
    'ok', true,
    'can_create_pin', v_request.id is not null,
    'expires_at', v_request.expires_at
  );
end;
$$;

create or replace function public.complete_member_pin_reset(
  p_member_id uuid,
  p_new_pin text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_family_id uuid;
  v_request private.member_pin_reset_requests%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if p_new_pin is null or p_new_pin !~ '^[0-9]{4}$' then
    raise exception using errcode = 'P0001', message = 'PIN_MUST_HAVE_4_DIGITS';
  end if;

  select access.family_id
    into v_family_id
  from public.family_auth_accounts as access
  where access.user_id = v_user_id
    and access.is_family_admin;

  if v_family_id is null then
    raise exception using errcode = 'P0001', message = 'FAMILY_ADMIN_REQUIRED';
  end if;

  select * into v_request
  from private.member_pin_reset_requests as request
  where request.family_id = v_family_id
    and request.member_id = p_member_id
    and request.authorized_by_user_id = v_user_id
    and request.consumed_at is null
    and request.expires_at > now()
  order by request.authorized_at desc
  limit 1
  for update;

  if v_request.id is null then
    raise exception using errcode = 'P0001', message = 'PIN_RESET_AUTHORIZATION_REQUIRED';
  end if;

  update private.member_pin_credentials
  set pin_hash = extensions.crypt(p_new_pin, extensions.gen_salt('bf', 10)),
      updated_at = now()
  where member_id = p_member_id
    and family_id = v_family_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'PIN_NOT_CONFIGURED';
  end if;

  delete from private.member_pin_attempts
  where member_id = p_member_id
    and family_id = v_family_id;

  delete from private.active_member_sessions
  where member_id = p_member_id
    and family_id = v_family_id;

  update private.member_pin_reset_requests
  set consumed_at = now()
  where id = v_request.id;

  return jsonb_build_object('ok', true, 'member_id', p_member_id);
end;
$$;

revoke execute on function public.authorize_member_pin_reset(uuid) from public, anon;
revoke execute on function public.get_member_pin_reset_status(uuid) from public, anon;
revoke execute on function public.complete_member_pin_reset(uuid, text) from public, anon;
grant execute on function public.authorize_member_pin_reset(uuid) to authenticated;
grant execute on function public.get_member_pin_reset_status(uuid) to authenticated;
grant execute on function public.complete_member_pin_reset(uuid, text) to authenticated;

comment on table private.member_pin_reset_requests is
  'Short-lived, single-use authorizations that let a member privately choose a replacement PIN on the administrator device.';
comment on function public.authorize_member_pin_reset(uuid) is
  'Lets the recently authenticated family administrator authorize a private PIN replacement for 30 minutes.';
comment on function public.complete_member_pin_reset(uuid, text) is
  'Consumes a PIN reset authorization on the same administrator account without exposing the new PIN to the administrator UI.';
