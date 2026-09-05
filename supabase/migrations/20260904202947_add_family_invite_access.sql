-- DoInFam family invite access
-- Allows multiple Supabase Auth accounts to belong to one family via invite code,
-- while member identity still comes from the private PIN-protected member session.

create function private.generate_family_invite_code()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  loop
    v_code := upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 8));
    exit when not exists (
      select 1 from public.families as f where f.invite_code = v_code
    );
  end loop;

  return v_code;
end;
$$;

alter table public.families
  add column if not exists invite_code text;

update public.families
set invite_code = private.generate_family_invite_code()
where invite_code is null;

alter table public.families
  alter column invite_code set not null,
  alter column invite_code set default private.generate_family_invite_code();

alter table public.families
  drop constraint if exists families_invite_code_key;

alter table public.families
  add constraint families_invite_code_key unique (invite_code);

alter table public.families
  drop constraint if exists families_invite_code_check;

alter table public.families
  add constraint families_invite_code_check
  check (invite_code ~ '^[A-F0-9]{8}$');

create table if not exists public.family_auth_accounts (
  family_id uuid not null references public.families (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (family_id, user_id),
  unique (user_id)
);

insert into public.family_auth_accounts (family_id, user_id)
select f.id, f.id
from public.families as f
on conflict do nothing;

alter table public.family_auth_accounts enable row level security;

drop policy if exists family_auth_accounts_select_own on public.family_auth_accounts;
create policy family_auth_accounts_select_own
on public.family_auth_accounts for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists families_select_own on public.families;
drop policy if exists family_members_select_own_family on public.family_members;
drop policy if exists tasks_select_own_family on public.tasks;
drop policy if exists family_weeks_select_own_family on public.family_weeks;
drop policy if exists member_weekly_goals_select_own_family on public.member_weekly_goals;
drop policy if exists task_completions_select_own_family on public.task_completions;

create policy families_select_member_family
on public.families for select to authenticated
using (
  exists (
    select 1
    from public.family_auth_accounts as access
    where access.family_id = families.id
      and access.user_id = (select auth.uid())
  )
);

create policy family_members_select_member_family
on public.family_members for select to authenticated
using (
  exists (
    select 1
    from public.family_auth_accounts as access
    where access.family_id = family_members.family_id
      and access.user_id = (select auth.uid())
  )
);

create policy tasks_select_member_family
on public.tasks for select to authenticated
using (
  exists (
    select 1
    from public.family_auth_accounts as access
    where access.family_id = tasks.family_id
      and access.user_id = (select auth.uid())
  )
);

create policy family_weeks_select_member_family
on public.family_weeks for select to authenticated
using (
  exists (
    select 1
    from public.family_auth_accounts as access
    where access.family_id = family_weeks.family_id
      and access.user_id = (select auth.uid())
  )
);

create policy member_weekly_goals_select_member_family
on public.member_weekly_goals for select to authenticated
using (
  exists (
    select 1
    from public.family_auth_accounts as access
    where access.family_id = member_weekly_goals.family_id
      and access.user_id = (select auth.uid())
  )
);

create policy task_completions_select_member_family
on public.task_completions for select to authenticated
using (
  exists (
    select 1
    from public.family_auth_accounts as access
    where access.family_id = task_completions.family_id
      and access.user_id = (select auth.uid())
  )
);

revoke all on table public.family_auth_accounts from anon, authenticated;
grant select on table public.family_auth_accounts to authenticated;

create or replace function private.require_active_member()
returns table (member_id uuid, family_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_session_id uuid := private.require_auth_session_id();
  v_user_id uuid := auth.uid();
  v_family_id uuid;
  v_member_id uuid;
  v_idle_expires_at timestamptz;
  v_absolute_expires_at timestamptz;
begin
  select s.member_id, s.family_id, s.idle_expires_at, s.absolute_expires_at
    into v_member_id, v_family_id, v_idle_expires_at, v_absolute_expires_at
  from private.active_member_sessions as s
  join public.family_members as m
    on m.id = s.member_id
   and m.family_id = s.family_id
   and m.is_active
  where s.auth_session_id = v_session_id
    and exists (
      select 1
      from public.family_auth_accounts as access
      where access.family_id = s.family_id
        and access.user_id = v_user_id
    )
  for update of s;

  if v_member_id is null
     or v_idle_expires_at <= now()
     or v_absolute_expires_at <= now() then
    delete from private.active_member_sessions
    where auth_session_id = v_session_id;
    raise exception using errcode = 'P0001', message = 'MEMBER_SESSION_REQUIRED';
  end if;

  update private.active_member_sessions
  set last_activity_at = now(),
      idle_expires_at = least(now() + interval '45 minutes', absolute_expires_at)
  where auth_session_id = v_session_id;

  perform private.ensure_current_week(v_family_id);

  return query select v_member_id, v_family_id;
end;
$$;

create or replace function public.create_family(
  p_family_name text,
  p_first_member_name text,
  p_pin text,
  p_weekly_goal integer default 100,
  p_avatar_key text default 'teal'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_family_id uuid := auth.uid();
  v_auth_session_id uuid := private.require_auth_session_id();
  v_member_id uuid;
  v_week_start date := private.current_week_start_lima();
  v_invite_code text;
begin
  if v_family_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if p_pin is null or p_pin !~ '^[0-9]{4}$' then
    raise exception using errcode = 'P0001', message = 'PIN_MUST_HAVE_4_DIGITS';
  end if;
  if p_weekly_goal not between 1 and 1000000 then
    raise exception using errcode = 'P0001', message = 'INVALID_WEEKLY_GOAL';
  end if;
  if exists (select 1 from public.family_auth_accounts where user_id = v_family_id) then
    raise exception using errcode = 'P0001', message = 'USER_ALREADY_HAS_FAMILY';
  end if;
  if exists (select 1 from public.families where id = v_family_id) then
    raise exception using errcode = 'P0001', message = 'FAMILY_ALREADY_EXISTS';
  end if;

  insert into public.families (id, name)
  values (v_family_id, btrim(p_family_name))
  returning invite_code into v_invite_code;

  insert into public.family_auth_accounts (family_id, user_id)
  values (v_family_id, v_family_id);

  insert into public.family_members (family_id, name, avatar_key)
  values (v_family_id, btrim(p_first_member_name), p_avatar_key)
  returning id into v_member_id;

  insert into private.member_pin_credentials (member_id, family_id, pin_hash)
  values (
    v_member_id,
    v_family_id,
    extensions.crypt(p_pin, extensions.gen_salt('bf', 10))
  );

  insert into public.family_weeks (family_id, week_start)
  values (v_family_id, v_week_start);

  insert into public.member_weekly_goals (family_id, member_id, week_start, target_points)
  values (v_family_id, v_member_id, v_week_start, p_weekly_goal);

  insert into private.active_member_sessions (
    auth_session_id, family_id, member_id, created_at, last_activity_at,
    idle_expires_at, absolute_expires_at
  ) values (
    v_auth_session_id, v_family_id, v_member_id, now(), now(),
    now() + interval '45 minutes', now() + interval '12 hours'
  );

  return jsonb_build_object(
    'ok', true,
    'family_id', v_family_id,
    'member_id', v_member_id,
    'week_start', v_week_start,
    'invite_code', v_invite_code
  );
end;
$$;

create or replace function public.join_family_by_code(p_invite_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_auth_session_id uuid := private.require_auth_session_id();
  v_code text := upper(regexp_replace(coalesce(p_invite_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_family_id uuid;
  v_family_name text;
  v_existing_family_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  select access.family_id
    into v_existing_family_id
  from public.family_auth_accounts as access
  where access.user_id = v_user_id;

  select f.id, f.name
    into v_family_id, v_family_name
  from public.families as f
  where f.invite_code = v_code;

  if v_family_id is null then
    raise exception using errcode = 'P0001', message = 'INVALID_FAMILY_CODE';
  end if;

  if v_existing_family_id is not null and v_existing_family_id <> v_family_id then
    raise exception using errcode = 'P0001', message = 'USER_ALREADY_HAS_FAMILY';
  end if;

  insert into public.family_auth_accounts (family_id, user_id)
  values (v_family_id, v_user_id)
  on conflict (user_id) do nothing;

  delete from private.active_member_sessions
  where auth_session_id = v_auth_session_id;

  return jsonb_build_object(
    'ok', true,
    'family_id', v_family_id,
    'family_name', v_family_name
  );
end;
$$;

create or replace function public.create_member_profile(
  p_name text,
  p_pin text,
  p_weekly_goal integer default 100,
  p_avatar_key text default 'teal'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_auth_session_id uuid := private.require_auth_session_id();
  v_family_id uuid;
  v_member_id uuid;
  v_week_start date := private.current_week_start_lima();
begin
  select access.family_id
    into v_family_id
  from public.family_auth_accounts as access
  where access.user_id = v_user_id;

  if v_family_id is null then
    raise exception using errcode = 'P0001', message = 'FAMILY_NOT_CONFIGURED';
  end if;
  if p_pin is null or p_pin !~ '^[0-9]{4}$' then
    raise exception using errcode = 'P0001', message = 'PIN_MUST_HAVE_4_DIGITS';
  end if;
  if p_weekly_goal not between 1 and 1000000 then
    raise exception using errcode = 'P0001', message = 'INVALID_WEEKLY_GOAL';
  end if;

  insert into public.family_members (family_id, name, avatar_key)
  values (v_family_id, btrim(p_name), p_avatar_key)
  returning id into v_member_id;

  insert into private.member_pin_credentials (member_id, family_id, pin_hash)
  values (
    v_member_id,
    v_family_id,
    extensions.crypt(p_pin, extensions.gen_salt('bf', 10))
  );

  insert into public.family_weeks (family_id, week_start)
  values (v_family_id, v_week_start)
  on conflict (family_id, week_start) do nothing;

  insert into public.member_weekly_goals (family_id, member_id, week_start, target_points)
  values (v_family_id, v_member_id, v_week_start, p_weekly_goal);

  insert into private.active_member_sessions (
    auth_session_id, family_id, member_id, created_at, last_activity_at,
    idle_expires_at, absolute_expires_at
  ) values (
    v_auth_session_id, v_family_id, v_member_id, now(), now(),
    now() + interval '45 minutes', now() + interval '12 hours'
  )
  on conflict (auth_session_id) do update
  set family_id = excluded.family_id,
      member_id = excluded.member_id,
      created_at = now(),
      last_activity_at = now(),
      idle_expires_at = now() + interval '45 minutes',
      absolute_expires_at = now() + interval '12 hours';

  return jsonb_build_object(
    'ok', true,
    'family_id', v_family_id,
    'member_id', v_member_id,
    'week_start', v_week_start
  );
end;
$$;

create or replace function public.select_member(p_member_id uuid, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_family_id uuid;
  v_auth_session_id uuid := private.require_auth_session_id();
  v_pin_hash text;
  v_locked_until timestamptz;
  v_failed_attempts smallint;
  v_attempts_remaining integer;
begin
  if p_pin is null or p_pin !~ '^[0-9]{4}$' then
    return jsonb_build_object('ok', false, 'code', 'INVALID_PIN', 'attempts_remaining', 5);
  end if;

  select m.family_id, c.pin_hash
    into v_family_id, v_pin_hash
  from private.member_pin_credentials as c
  join public.family_members as m
    on m.id = c.member_id
   and m.family_id = c.family_id
   and m.is_active
  where c.member_id = p_member_id
    and exists (
      select 1
      from public.family_auth_accounts as access
      where access.family_id = c.family_id
        and access.user_id = v_user_id
    );

  if v_pin_hash is null then
    raise exception using errcode = 'P0001', message = 'MEMBER_NOT_FOUND';
  end if;

  select a.locked_until
    into v_locked_until
  from private.member_pin_attempts as a
  where a.auth_session_id = v_auth_session_id
    and a.member_id = p_member_id
  for update;

  if v_locked_until is not null and v_locked_until > now() then
    return jsonb_build_object(
      'ok', false,
      'code', 'PIN_LOCKED',
      'retry_after_seconds', greatest(1, ceil(extract(epoch from (v_locked_until - now())))::integer)
    );
  end if;

  if extensions.crypt(p_pin, v_pin_hash) <> v_pin_hash then
    insert into private.member_pin_attempts (
      auth_session_id, family_id, member_id, failed_attempts,
      window_started_at, locked_until, updated_at
    ) values (
      v_auth_session_id, v_family_id, p_member_id, 1, now(), null, now()
    )
    on conflict (auth_session_id, member_id) do update
    set failed_attempts = case
          when private.member_pin_attempts.locked_until is not null
           and private.member_pin_attempts.locked_until <= now() then 1
          else least(private.member_pin_attempts.failed_attempts + 1, 5)
        end,
        window_started_at = case
          when private.member_pin_attempts.locked_until is not null
           and private.member_pin_attempts.locked_until <= now() then now()
          else private.member_pin_attempts.window_started_at
        end,
        locked_until = null,
        updated_at = now()
    returning failed_attempts into v_failed_attempts;

    if v_failed_attempts >= 5 then
      update private.member_pin_attempts
      set locked_until = now() + interval '2 minutes', updated_at = now()
      where auth_session_id = v_auth_session_id
        and member_id = p_member_id;
      return jsonb_build_object('ok', false, 'code', 'PIN_LOCKED', 'retry_after_seconds', 120);
    end if;

    v_attempts_remaining := 5 - v_failed_attempts;
    return jsonb_build_object(
      'ok', false,
      'code', 'INVALID_PIN',
      'attempts_remaining', v_attempts_remaining
    );
  end if;

  delete from private.member_pin_attempts
  where auth_session_id = v_auth_session_id
    and member_id = p_member_id;

  insert into private.active_member_sessions (
    auth_session_id, family_id, member_id, created_at, last_activity_at,
    idle_expires_at, absolute_expires_at
  ) values (
    v_auth_session_id, v_family_id, p_member_id, now(), now(),
    now() + interval '45 minutes', now() + interval '12 hours'
  )
  on conflict (auth_session_id) do update
  set family_id = excluded.family_id,
      member_id = excluded.member_id,
      created_at = now(),
      last_activity_at = now(),
      idle_expires_at = now() + interval '45 minutes',
      absolute_expires_at = now() + interval '12 hours';

  return jsonb_build_object('ok', true, 'member_id', p_member_id);
end;
$$;

create or replace function public.get_active_member()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_auth_session_id uuid := private.require_auth_session_id();
  v_member_id uuid;
  v_member_name text;
  v_avatar_key text;
  v_absolute_expires_at timestamptz;
begin
  select m.id, m.name, m.avatar_key, s.absolute_expires_at
    into v_member_id, v_member_name, v_avatar_key, v_absolute_expires_at
  from private.active_member_sessions as s
  join public.family_members as m
    on m.id = s.member_id
   and m.family_id = s.family_id
   and m.is_active
  where s.auth_session_id = v_auth_session_id
    and s.idle_expires_at > now()
    and s.absolute_expires_at > now()
    and exists (
      select 1
      from public.family_auth_accounts as access
      where access.family_id = s.family_id
        and access.user_id = v_user_id
    );

  if v_member_id is null then
    delete from private.active_member_sessions
    where auth_session_id = v_auth_session_id;
    return jsonb_build_object('ok', true, 'active', false);
  end if;

  update private.active_member_sessions
  set last_activity_at = now(),
      idle_expires_at = least(now() + interval '45 minutes', absolute_expires_at)
  where auth_session_id = v_auth_session_id;

  return jsonb_build_object(
    'ok', true,
    'active', true,
    'member', jsonb_build_object(
      'id', v_member_id,
      'name', v_member_name,
      'avatar_key', v_avatar_key
    ),
    'absolute_expires_at', v_absolute_expires_at
  );
end;
$$;

create or replace function public.clear_active_member()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_auth_session_id uuid := private.require_auth_session_id();
begin
  delete from private.active_member_sessions as s
  where s.auth_session_id = v_auth_session_id
    and exists (
      select 1
      from public.family_auth_accounts as access
      where access.family_id = s.family_id
        and access.user_id = v_user_id
    );

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function private.generate_family_invite_code() from public, anon, authenticated;
revoke execute on function public.join_family_by_code(text) from public, anon;
revoke execute on function public.create_member_profile(text, text, integer, text) from public, anon;

grant execute on function public.join_family_by_code(text) to authenticated;
grant execute on function public.create_member_profile(text, text, integer, text) to authenticated;

comment on table public.family_auth_accounts is
  'Maps Supabase Auth accounts to one DoInFam family. MVP allows one family per account.';
comment on column public.families.invite_code is
  'Short family code used by authenticated accounts to join a family without exposing family rows publicly.';
