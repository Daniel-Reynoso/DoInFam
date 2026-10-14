alter table public.family_auth_accounts
  add column if not exists is_family_admin boolean not null default false;

update public.family_auth_accounts
set is_family_admin = true
where user_id = family_id;

create unique index if not exists family_auth_accounts_one_admin_per_family_idx
  on public.family_auth_accounts (family_id)
  where is_family_admin;

create or replace function private.assign_creator_as_family_admin()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.user_id = new.family_id then
    new.is_family_admin := true;
  end if;
  return new;
end;
$$;

drop trigger if exists family_auth_accounts_assign_creator_admin
  on public.family_auth_accounts;
create trigger family_auth_accounts_assign_creator_admin
before insert on public.family_auth_accounts
for each row execute function private.assign_creator_as_family_admin();

create or replace function public.get_pin_recovery_access()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_is_admin boolean := false;
  v_is_anonymous boolean := coalesce((auth.jwt()->>'is_anonymous')::boolean, false);
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  select access.is_family_admin
    into v_is_admin
  from public.family_auth_accounts as access
  where access.user_id = v_user_id;

  return jsonb_build_object(
    'ok', true,
    'can_reset_pins', coalesce(v_is_admin, false) and not v_is_anonymous,
    'is_family_admin', coalesce(v_is_admin, false),
    'has_email', nullif(auth.jwt()->>'email', '') is not null
  );
end;
$$;

create or replace function public.reset_member_pin(
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
  v_recent_auth jsonb;
  v_auth_method text;
  v_auth_timestamp bigint;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then
    raise exception using errcode = 'P0001', message = 'FAMILY_ADMIN_REQUIRED';
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

  return jsonb_build_object('ok', true, 'member_id', p_member_id);
end;
$$;

revoke execute on function public.get_pin_recovery_access() from public, anon;
revoke execute on function public.reset_member_pin(uuid, text) from public, anon;
grant execute on function public.get_pin_recovery_access() to authenticated;
grant execute on function public.reset_member_pin(uuid, text) to authenticated;

comment on column public.family_auth_accounts.is_family_admin is
  'Only the family creator account can reset member PINs. PIN values remain private hashes.';
comment on function public.reset_member_pin(uuid, text) is
  'Replaces a member PIN after recent family-admin authentication and invalidates that member sessions.';
