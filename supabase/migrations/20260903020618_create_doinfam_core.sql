-- DoInFam core schema
-- One Supabase Auth user represents one family. Individual identity is resolved
-- from a private member session bound to the JWT session_id claim.

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create type public.task_recurrence as enum ('daily', 'weekly', 'monthly');

create table public.families (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  timezone text not null default 'America/Lima'
    check (timezone = 'America/Lima'),
  week_starts_on smallint not null default 1
    check (week_starts_on = 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.family_members (
  id uuid primary key default extensions.gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  avatar_key text not null default 'teal'
    check (avatar_key in ('teal', 'blue', 'green', 'orange', 'coral', 'violet')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (family_id, id)
);

create table public.tasks (
  id uuid primary key default extensions.gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  description text check (description is null or char_length(description) <= 240),
  points integer not null check (points between 1 and 10000),
  recurrence public.task_recurrence not null default 'weekly',
  quota_per_period integer not null default 1
    check (quota_per_period between 1 and 1000),
  is_active boolean not null default true,
  created_by_member_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (family_id, id),
  foreign key (family_id, created_by_member_id)
    references public.family_members (family_id, id) on delete restrict
);

create table public.family_weeks (
  family_id uuid not null references public.families (id) on delete restrict,
  week_start date not null,
  consequence text check (consequence is null or char_length(consequence) <= 240),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (family_id, week_start)
);

create table public.member_weekly_goals (
  family_id uuid not null references public.families (id) on delete restrict,
  member_id uuid not null,
  week_start date not null,
  target_points integer not null check (target_points between 1 and 1000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (member_id, week_start),
  unique (family_id, member_id, week_start),
  foreign key (family_id, member_id)
    references public.family_members (family_id, id) on delete restrict
);

create table public.task_completions (
  id uuid primary key default extensions.gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete restrict,
  task_id uuid not null,
  member_id uuid not null,
  points_awarded integer not null check (points_awarded > 0),
  week_start date not null,
  completed_at timestamptz not null default now(),
  foreign key (family_id, task_id)
    references public.tasks (family_id, id) on delete restrict,
  foreign key (family_id, member_id)
    references public.family_members (family_id, id) on delete restrict
);

create table private.member_pin_credentials (
  member_id uuid primary key,
  family_id uuid not null references public.families (id) on delete restrict,
  pin_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (family_id, member_id),
  foreign key (family_id, member_id)
    references public.family_members (family_id, id) on delete restrict
);

create table private.active_member_sessions (
  auth_session_id uuid primary key,
  family_id uuid not null references public.families (id) on delete restrict,
  member_id uuid not null,
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  idle_expires_at timestamptz not null,
  absolute_expires_at timestamptz not null,
  check (idle_expires_at <= absolute_expires_at),
  check (last_activity_at <= absolute_expires_at),
  foreign key (family_id, member_id)
    references public.family_members (family_id, id) on delete restrict
);

create table private.member_pin_attempts (
  auth_session_id uuid not null,
  family_id uuid not null references public.families (id) on delete restrict,
  member_id uuid not null,
  failed_attempts smallint not null default 0 check (failed_attempts between 0 and 5),
  window_started_at timestamptz not null default now(),
  locked_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (auth_session_id, member_id),
  foreign key (family_id, member_id)
    references public.family_members (family_id, id) on delete restrict
);

create index family_members_family_active_idx
  on public.family_members (family_id, is_active);
create index tasks_family_active_idx
  on public.tasks (family_id, is_active)
  where is_active;
create index tasks_created_by_member_idx
  on public.tasks (created_by_member_id);
create index member_weekly_goals_family_week_idx
  on public.member_weekly_goals (family_id, week_start);
create index task_completions_task_completed_idx
  on public.task_completions (task_id, completed_at);
create index task_completions_family_week_member_idx
  on public.task_completions (family_id, week_start, member_id);
create index task_completions_member_week_idx
  on public.task_completions (member_id, week_start);
create index active_member_sessions_family_member_idx
  on private.active_member_sessions (family_id, member_id);
create index member_pin_attempts_family_member_idx
  on private.member_pin_attempts (family_id, member_id);

create function private.current_week_start_lima(p_at timestamptz default now())
returns date
language sql
stable
set search_path = ''
as $$
  select date_trunc('week', p_at at time zone 'America/Lima')::date;
$$;

create function private.ensure_current_week(p_family_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_week_start date := private.current_week_start_lima();
begin
  insert into public.family_weeks (family_id, week_start)
  values (p_family_id, v_week_start)
  on conflict (family_id, week_start) do nothing;

  insert into public.member_weekly_goals (
    family_id, member_id, week_start, target_points
  )
  select
    m.family_id,
    m.id,
    v_week_start,
    coalesce(
      (
        select previous_goal.target_points
        from public.member_weekly_goals as previous_goal
        where previous_goal.family_id = m.family_id
          and previous_goal.member_id = m.id
          and previous_goal.week_start < v_week_start
        order by previous_goal.week_start desc
        limit 1
      ),
      100
    )
  from public.family_members as m
  where m.family_id = p_family_id
    and m.is_active
  on conflict (member_id, week_start) do nothing;
end;
$$;

create function private.require_auth_session_id()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  begin
    v_session_id := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  exception when invalid_text_representation then
    raise exception using errcode = 'P0001', message = 'AUTH_SESSION_INVALID';
  end;

  if v_session_id is null or not exists (
    select 1
    from auth.sessions as s
    where s.id = v_session_id
      and s.user_id = v_user_id
  ) then
    raise exception using errcode = 'P0001', message = 'AUTH_SESSION_INVALID';
  end if;

  return v_session_id;
end;
$$;

create function private.require_active_member()
returns table (member_id uuid, family_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_session_id uuid := private.require_auth_session_id();
  v_family_id uuid := auth.uid();
  v_member_id uuid;
  v_idle_expires_at timestamptz;
  v_absolute_expires_at timestamptz;
begin
  select s.member_id, s.idle_expires_at, s.absolute_expires_at
    into v_member_id, v_idle_expires_at, v_absolute_expires_at
  from private.active_member_sessions as s
  join public.family_members as m
    on m.id = s.member_id
   and m.family_id = s.family_id
   and m.is_active
  where s.auth_session_id = v_session_id
    and s.family_id = v_family_id
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

create function private.period_bounds(
  p_recurrence public.task_recurrence,
  p_at timestamptz default now()
)
returns table (period_start timestamptz, period_end timestamptz)
language sql
stable
set search_path = ''
as $$
  select
    case p_recurrence
      when 'daily' then
        date_trunc('day', p_at at time zone 'America/Lima') at time zone 'America/Lima'
      when 'weekly' then
        date_trunc('week', p_at at time zone 'America/Lima') at time zone 'America/Lima'
      when 'monthly' then
        date_trunc('month', p_at at time zone 'America/Lima') at time zone 'America/Lima'
    end,
    case p_recurrence
      when 'daily' then
        (date_trunc('day', p_at at time zone 'America/Lima') + interval '1 day') at time zone 'America/Lima'
      when 'weekly' then
        (date_trunc('week', p_at at time zone 'America/Lima') + interval '1 week') at time zone 'America/Lima'
      when 'monthly' then
        (date_trunc('month', p_at at time zone 'America/Lima') + interval '1 month') at time zone 'America/Lima'
    end;
$$;

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create function private.prevent_completion_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = 'P0001', message = 'COMPLETION_HISTORY_IMMUTABLE';
end;
$$;

create function private.protect_past_week()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_week_start date;
begin
  v_week_start := case when tg_op = 'DELETE' then old.week_start else new.week_start end;
  if v_week_start < private.current_week_start_lima() then
    raise exception using errcode = 'P0001', message = 'PAST_WEEK_IMMUTABLE';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger families_set_updated_at
before update on public.families
for each row execute function private.set_updated_at();

create trigger family_members_set_updated_at
before update on public.family_members
for each row execute function private.set_updated_at();

create trigger tasks_set_updated_at
before update on public.tasks
for each row execute function private.set_updated_at();

create trigger family_weeks_set_updated_at
before update on public.family_weeks
for each row execute function private.set_updated_at();

create trigger member_weekly_goals_set_updated_at
before update on public.member_weekly_goals
for each row execute function private.set_updated_at();

create trigger member_pin_credentials_set_updated_at
before update on private.member_pin_credentials
for each row execute function private.set_updated_at();

create trigger task_completions_are_immutable
before update or delete on public.task_completions
for each row execute function private.prevent_completion_mutation();

create trigger family_weeks_past_is_immutable
before insert or update or delete on public.family_weeks
for each row execute function private.protect_past_week();

create trigger member_weekly_goals_past_is_immutable
before insert or update or delete on public.member_weekly_goals
for each row execute function private.protect_past_week();

alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.tasks enable row level security;
alter table public.family_weeks enable row level security;
alter table public.member_weekly_goals enable row level security;
alter table public.task_completions enable row level security;
alter table private.member_pin_credentials enable row level security;
alter table private.active_member_sessions enable row level security;
alter table private.member_pin_attempts enable row level security;

create policy families_select_own
on public.families for select to authenticated
using (id = (select auth.uid()));

create policy family_members_select_own_family
on public.family_members for select to authenticated
using (family_id = (select auth.uid()));

create policy tasks_select_own_family
on public.tasks for select to authenticated
using (family_id = (select auth.uid()));

create policy family_weeks_select_own_family
on public.family_weeks for select to authenticated
using (family_id = (select auth.uid()));

create policy member_weekly_goals_select_own_family
on public.member_weekly_goals for select to authenticated
using (family_id = (select auth.uid()));

create policy task_completions_select_own_family
on public.task_completions for select to authenticated
using (family_id = (select auth.uid()));

revoke all on table public.families from anon, authenticated;
revoke all on table public.family_members from anon, authenticated;
revoke all on table public.tasks from anon, authenticated;
revoke all on table public.family_weeks from anon, authenticated;
revoke all on table public.member_weekly_goals from anon, authenticated;
revoke all on table public.task_completions from anon, authenticated;

grant select on table public.families to authenticated;
grant select on table public.family_members to authenticated;
grant select on table public.tasks to authenticated;
grant select on table public.family_weeks to authenticated;
grant select on table public.member_weekly_goals to authenticated;
grant select on table public.task_completions to authenticated;

revoke all on table private.member_pin_credentials from public, anon, authenticated;
revoke all on table private.active_member_sessions from public, anon, authenticated;
revoke all on table private.member_pin_attempts from public, anon, authenticated;

create function public.create_family(
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
  if exists (select 1 from public.families where id = v_family_id) then
    raise exception using errcode = 'P0001', message = 'FAMILY_ALREADY_EXISTS';
  end if;

  insert into public.families (id, name)
  values (v_family_id, btrim(p_family_name));

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
    'week_start', v_week_start
  );
end;
$$;

create function public.select_member(p_member_id uuid, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_family_id uuid := auth.uid();
  v_auth_session_id uuid := private.require_auth_session_id();
  v_pin_hash text;
  v_locked_until timestamptz;
  v_failed_attempts smallint;
  v_attempts_remaining integer;
begin
  if p_pin is null or p_pin !~ '^[0-9]{4}$' then
    return jsonb_build_object('ok', false, 'code', 'INVALID_PIN', 'attempts_remaining', 5);
  end if;

  select c.pin_hash
    into v_pin_hash
  from private.member_pin_credentials as c
  join public.family_members as m on m.id = c.member_id
  where c.member_id = p_member_id
    and c.family_id = v_family_id
    and m.is_active;

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

create function public.get_active_member()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_family_id uuid := auth.uid();
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
    and s.family_id = v_family_id
    and s.idle_expires_at > now()
    and s.absolute_expires_at > now();

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

create function public.clear_active_member()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_session_id uuid := private.require_auth_session_id();
begin
  delete from private.active_member_sessions
  where auth_session_id = v_auth_session_id
    and family_id = auth.uid();
  return jsonb_build_object('ok', true);
end;
$$;

create function public.add_family_member(
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
  v_identity record;
  v_member_id uuid;
  v_week_start date := private.current_week_start_lima();
begin
  select * into v_identity from private.require_active_member();
  if p_pin is null or p_pin !~ '^[0-9]{4}$' then
    raise exception using errcode = 'P0001', message = 'PIN_MUST_HAVE_4_DIGITS';
  end if;
  if p_weekly_goal not between 1 and 1000000 then
    raise exception using errcode = 'P0001', message = 'INVALID_WEEKLY_GOAL';
  end if;

  insert into public.family_members (family_id, name, avatar_key)
  values (v_identity.family_id, btrim(p_name), p_avatar_key)
  returning id into v_member_id;

  insert into private.member_pin_credentials (member_id, family_id, pin_hash)
  values (
    v_member_id,
    v_identity.family_id,
    extensions.crypt(p_pin, extensions.gen_salt('bf', 10))
  );

  insert into public.member_weekly_goals (family_id, member_id, week_start, target_points)
  values (v_identity.family_id, v_member_id, v_week_start, p_weekly_goal);

  return jsonb_build_object('ok', true, 'member_id', v_member_id);
end;
$$;

create function public.update_family_settings(p_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_identity record;
begin
  select * into v_identity from private.require_active_member();
  update public.families
  set name = btrim(p_name)
  where id = v_identity.family_id;
  return jsonb_build_object('ok', true, 'family_id', v_identity.family_id);
end;
$$;

create function public.update_member_profile(p_name text, p_avatar_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_identity record;
begin
  select * into v_identity from private.require_active_member();
  update public.family_members
  set name = btrim(p_name), avatar_key = p_avatar_key
  where id = v_identity.member_id
    and family_id = v_identity.family_id;
  return jsonb_build_object('ok', true, 'member_id', v_identity.member_id);
end;
$$;

create function public.create_task(
  p_title text,
  p_description text,
  p_points integer,
  p_recurrence public.task_recurrence,
  p_quota_per_period integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_identity record;
  v_task_id uuid;
begin
  select * into v_identity from private.require_active_member();
  insert into public.tasks (
    family_id, title, description, points, recurrence,
    quota_per_period, created_by_member_id
  ) values (
    v_identity.family_id, btrim(p_title), nullif(btrim(p_description), ''),
    p_points, p_recurrence, p_quota_per_period, v_identity.member_id
  ) returning id into v_task_id;
  return jsonb_build_object('ok', true, 'task_id', v_task_id);
end;
$$;

create function public.update_task(
  p_task_id uuid,
  p_title text,
  p_description text,
  p_points integer,
  p_recurrence public.task_recurrence,
  p_quota_per_period integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_identity record;
begin
  select * into v_identity from private.require_active_member();
  update public.tasks
  set title = btrim(p_title),
      description = nullif(btrim(p_description), ''),
      points = p_points,
      recurrence = p_recurrence,
      quota_per_period = p_quota_per_period
  where id = p_task_id
    and family_id = v_identity.family_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'TASK_NOT_FOUND';
  end if;
  return jsonb_build_object('ok', true, 'task_id', p_task_id);
end;
$$;

create function public.deactivate_task(p_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_identity record;
begin
  select * into v_identity from private.require_active_member();
  update public.tasks
  set is_active = false
  where id = p_task_id
    and family_id = v_identity.family_id
    and is_active;
  if not found then
    raise exception using errcode = 'P0001', message = 'TASK_NOT_FOUND_OR_INACTIVE';
  end if;
  return jsonb_build_object('ok', true, 'task_id', p_task_id);
end;
$$;

create function public.complete_task(p_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_identity record;
  v_task public.tasks%rowtype;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_used integer;
  v_remaining integer;
  v_completion_id uuid;
  v_week_start date := private.current_week_start_lima();
begin
  select * into v_identity from private.require_active_member();

  -- The task row lock serializes quota checks for simultaneous completions.
  select * into v_task
  from public.tasks
  where id = p_task_id
    and family_id = v_identity.family_id
    and is_active
  for update;

  if v_task.id is null then
    raise exception using errcode = 'P0001', message = 'TASK_NOT_FOUND_OR_INACTIVE';
  end if;

  select period_start, period_end
    into v_period_start, v_period_end
  from private.period_bounds(v_task.recurrence, now());

  select count(*)::integer into v_used
  from public.task_completions
  where family_id = v_identity.family_id
    and task_id = v_task.id
    and completed_at >= v_period_start
    and completed_at < v_period_end;

  if v_used >= v_task.quota_per_period then
    return jsonb_build_object(
      'ok', false,
      'code', 'QUOTA_EXHAUSTED',
      'task_id', v_task.id,
      'remaining_quota', 0,
      'period_ends_at', v_period_end
    );
  end if;

  insert into public.task_completions (
    family_id, task_id, member_id, points_awarded, week_start, completed_at
  ) values (
    v_identity.family_id, v_task.id, v_identity.member_id,
    v_task.points, v_week_start, now()
  ) returning id into v_completion_id;

  v_remaining := v_task.quota_per_period - v_used - 1;
  return jsonb_build_object(
    'ok', true,
    'completion_id', v_completion_id,
    'task_id', v_task.id,
    'points_awarded', v_task.points,
    'remaining_quota', v_remaining,
    'is_last_slot', v_remaining = 0,
    'period_ends_at', v_period_end
  );
end;
$$;

create function public.set_weekly_goal(p_target_points integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_identity record;
  v_week_start date := private.current_week_start_lima();
begin
  select * into v_identity from private.require_active_member();
  if p_target_points not between 1 and 1000000 then
    raise exception using errcode = 'P0001', message = 'INVALID_WEEKLY_GOAL';
  end if;
  insert into public.member_weekly_goals (family_id, member_id, week_start, target_points)
  values (v_identity.family_id, v_identity.member_id, v_week_start, p_target_points)
  on conflict (member_id, week_start) do update
  set target_points = excluded.target_points;
  return jsonb_build_object(
    'ok', true,
    'member_id', v_identity.member_id,
    'week_start', v_week_start,
    'target_points', p_target_points
  );
end;
$$;

create function public.set_weekly_consequence(p_consequence text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_identity record;
  v_week_start date := private.current_week_start_lima();
begin
  select * into v_identity from private.require_active_member();
  insert into public.family_weeks (family_id, week_start, consequence)
  values (v_identity.family_id, v_week_start, nullif(btrim(p_consequence), ''))
  on conflict (family_id, week_start) do update
  set consequence = excluded.consequence;
  return jsonb_build_object(
    'ok', true,
    'week_start', v_week_start,
    'consequence', nullif(btrim(p_consequence), '')
  );
end;
$$;

create function public.get_home_summary()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_identity record;
  v_week_start date := private.current_week_start_lima();
  v_points integer;
  v_goal integer;
  v_tasks jsonb;
begin
  select * into v_identity from private.require_active_member();

  select coalesce(sum(c.points_awarded), 0)::integer
    into v_points
  from public.task_completions as c
  where c.family_id = v_identity.family_id
    and c.member_id = v_identity.member_id
    and c.week_start = v_week_start;

  select g.target_points into v_goal
  from public.member_weekly_goals as g
  where g.family_id = v_identity.family_id
    and g.member_id = v_identity.member_id
    and g.week_start = v_week_start;

  select coalesce(jsonb_agg(task_data order by (task_data ->> 'title')), '[]'::jsonb)
    into v_tasks
  from (
    select jsonb_build_object(
      'id', t.id,
      'title', t.title,
      'description', t.description,
      'points', t.points,
      'recurrence', t.recurrence,
      'quota_per_period', t.quota_per_period,
      'remaining_quota', greatest(t.quota_per_period - usage.used_count, 0),
      'is_last_slot', greatest(t.quota_per_period - usage.used_count, 0) = 1,
      'is_exhausted', usage.used_count >= t.quota_per_period,
      'period_ends_at', bounds.period_end
    ) as task_data
    from public.tasks as t
    cross join lateral private.period_bounds(t.recurrence, now()) as bounds
    cross join lateral (
      select count(*)::integer as used_count
      from public.task_completions as c
      where c.family_id = t.family_id
        and c.task_id = t.id
        and c.completed_at >= bounds.period_start
        and c.completed_at < bounds.period_end
    ) as usage
    where t.family_id = v_identity.family_id
      and t.is_active
  ) as available_tasks;

  return jsonb_build_object(
    'ok', true,
    'member_id', v_identity.member_id,
    'week_start', v_week_start,
    'points', v_points,
    'goal', coalesce(v_goal, 0),
    'points_remaining', greatest(coalesce(v_goal, 0) - v_points, 0),
    'week_ends_at', (v_week_start + 7)::timestamp at time zone 'America/Lima',
    'tasks', v_tasks
  );
end;
$$;

create view public.weekly_member_results
with (security_invoker = true)
as
select
  g.family_id,
  g.member_id,
  m.name as member_name,
  g.week_start,
  g.target_points,
  coalesce(sum(c.points_awarded), 0)::integer as earned_points,
  coalesce(sum(c.points_awarded), 0) >= g.target_points as goal_reached,
  fw.consequence
from public.member_weekly_goals as g
join public.family_members as m
  on m.id = g.member_id and m.family_id = g.family_id
left join public.task_completions as c
  on c.family_id = g.family_id
 and c.member_id = g.member_id
 and c.week_start = g.week_start
left join public.family_weeks as fw
  on fw.family_id = g.family_id and fw.week_start = g.week_start
group by
  g.family_id, g.member_id, m.name, g.week_start,
  g.target_points, fw.consequence;

revoke all on table public.weekly_member_results from anon, authenticated;
grant select on table public.weekly_member_results to authenticated;

revoke execute on all functions in schema private from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;

grant execute on function public.create_family(text, text, text, integer, text) to authenticated;
grant execute on function public.select_member(uuid, text) to authenticated;
grant execute on function public.get_active_member() to authenticated;
grant execute on function public.clear_active_member() to authenticated;
grant execute on function public.add_family_member(text, text, integer, text) to authenticated;
grant execute on function public.update_family_settings(text) to authenticated;
grant execute on function public.update_member_profile(text, text) to authenticated;
grant execute on function public.create_task(text, text, integer, public.task_recurrence, integer) to authenticated;
grant execute on function public.update_task(uuid, text, text, integer, public.task_recurrence, integer) to authenticated;
grant execute on function public.deactivate_task(uuid) to authenticated;
grant execute on function public.complete_task(uuid) to authenticated;
grant execute on function public.set_weekly_goal(integer) to authenticated;
grant execute on function public.set_weekly_consequence(text) to authenticated;
grant execute on function public.get_home_summary() to authenticated;

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema private revoke all on tables from public, anon, authenticated;
alter default privileges in schema private revoke execute on functions from public, anon, authenticated;

comment on table public.task_completions is
  'Immutable source of truth for awarded points. Never update or delete rows.';
comment on table private.active_member_sessions is
  'Member identity bound to a Supabase Auth session_id; 45 minute idle timeout and 12 hour absolute lifetime.';
comment on function public.complete_task(uuid) is
  'Completes a task for the server-resolved active member and enforces the shared family quota atomically.';
