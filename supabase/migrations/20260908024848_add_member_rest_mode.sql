create table public.member_rest_periods (
  id uuid primary key default extensions.gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  member_id uuid not null,
  duration text not null check (duration in ('this_week', 'until_disabled')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  changed_by_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (family_id, member_id)
    references public.family_members (family_id, id) on delete cascade,
  check (ended_at is null or ended_at > started_at)
);

create index member_rest_periods_member_time_idx
  on public.member_rest_periods (family_id, member_id, started_at desc);

alter table public.member_rest_periods enable row level security;

create policy member_rest_periods_select_member_family
on public.member_rest_periods for select to authenticated
using (
  exists (
    select 1
    from public.family_auth_accounts as access
    where access.family_id = member_rest_periods.family_id
      and access.user_id = (select auth.uid())
  )
);

revoke all on table public.member_rest_periods from public, anon, authenticated;
grant select on table public.member_rest_periods to authenticated;

create or replace function private.member_is_resting_now(p_family_id uuid, p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.member_rest_periods as rest
    where rest.family_id = p_family_id
      and rest.member_id = p_member_id
      and rest.started_at <= now()
      and (rest.ended_at is null or rest.ended_at > now())
  );
$$;

revoke execute on function private.member_is_resting_now(uuid, uuid) from public, anon, authenticated;

create or replace function public.get_rest_mode()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_identity record;
  v_rest public.member_rest_periods%rowtype;
begin
  select * into v_identity from private.require_active_member();

  select * into v_rest
  from public.member_rest_periods as rest
  where rest.family_id = v_identity.family_id
    and rest.member_id = v_identity.member_id
    and rest.started_at <= now()
    and (rest.ended_at is null or rest.ended_at > now())
  order by rest.started_at desc
  limit 1;

  return jsonb_build_object(
    'ok', true,
    'active', v_rest.id is not null,
    'duration', v_rest.duration,
    'started_at', v_rest.started_at,
    'ends_at', v_rest.ended_at
  );
end;
$$;

create or replace function public.set_rest_mode(p_duration text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_identity record;
  v_existing public.member_rest_periods%rowtype;
  v_period public.member_rest_periods%rowtype;
  v_ends_at timestamptz;
begin
  select * into v_identity from private.require_active_member();

  if p_duration not in ('this_week', 'until_disabled') then
    raise exception using errcode = 'P0001', message = 'INVALID_REST_DURATION';
  end if;

  perform 1
  from public.family_members
  where family_id = v_identity.family_id and id = v_identity.member_id
  for update;

  select * into v_existing
  from public.member_rest_periods as rest
  where rest.family_id = v_identity.family_id
    and rest.member_id = v_identity.member_id
    and rest.started_at <= now()
    and (rest.ended_at is null or rest.ended_at > now())
  order by rest.started_at desc
  limit 1
  for update;

  if v_existing.id is not null and v_existing.duration = p_duration then
    return jsonb_build_object(
      'ok', true,
      'active', true,
      'duration', v_existing.duration,
      'started_at', v_existing.started_at,
      'ends_at', v_existing.ended_at
    );
  end if;

  update public.member_rest_periods
  set ended_at = now()
  where family_id = v_identity.family_id
    and member_id = v_identity.member_id
    and started_at < now()
    and (ended_at is null or ended_at > now());

  if p_duration = 'this_week' then
    v_ends_at := (private.current_week_start_lima() + 7)::timestamp at time zone 'America/Lima';
  end if;

  insert into public.member_rest_periods (
    family_id, member_id, duration, started_at, ended_at, changed_by_user_id
  ) values (
    v_identity.family_id, v_identity.member_id, p_duration, now(), v_ends_at, auth.uid()
  ) returning * into v_period;

  return jsonb_build_object(
    'ok', true,
    'active', true,
    'duration', v_period.duration,
    'started_at', v_period.started_at,
    'ends_at', v_period.ended_at
  );
end;
$$;

create or replace function public.disable_rest_mode()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_identity record;
begin
  select * into v_identity from private.require_active_member();

  perform 1
  from public.family_members
  where family_id = v_identity.family_id and id = v_identity.member_id
  for update;

  update public.member_rest_periods
  set ended_at = now()
  where family_id = v_identity.family_id
    and member_id = v_identity.member_id
    and started_at < now()
    and (ended_at is null or ended_at > now());

  return jsonb_build_object('ok', true, 'active', false);
end;
$$;

revoke execute on function public.get_rest_mode() from public, anon;
revoke execute on function public.set_rest_mode(text) from public, anon;
revoke execute on function public.disable_rest_mode() from public, anon;
grant execute on function public.get_rest_mode() to authenticated;
grant execute on function public.set_rest_mode(text) to authenticated;
grant execute on function public.disable_rest_mode() to authenticated;

create or replace function public.complete_task(p_task_id uuid)
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
  v_day_start timestamptz;
  v_day_end timestamptz;
  v_used integer;
  v_used_today integer;
  v_remaining integer;
  v_completion_id uuid;
  v_week_start date := private.current_week_start_lima();
  v_previous_week_points integer;
  v_current_week_points integer;
  v_weekly_goal integer;
begin
  select * into v_identity from private.require_active_member();

  if private.member_is_resting_now(v_identity.family_id, v_identity.member_id) then
    return jsonb_build_object('ok', false, 'code', 'MEMBER_RESTING', 'task_id', p_task_id);
  end if;

  select * into v_task
  from public.tasks
  where id = p_task_id
    and family_id = v_identity.family_id
    and is_active
  for update;

  if v_task.id is null then
    raise exception using errcode = 'P0001', message = 'TASK_NOT_FOUND_OR_INACTIVE';
  end if;

  select period_start, period_end into v_period_start, v_period_end
  from private.period_bounds(v_task.recurrence, now());

  select count(*)::integer into v_used
  from public.task_completions
  where family_id = v_identity.family_id
    and task_id = v_task.id
    and completed_at >= v_period_start
    and completed_at < v_period_end;

  if v_used >= v_task.quota_per_period then
    return jsonb_build_object('ok', false, 'code', 'QUOTA_EXHAUSTED', 'task_id', v_task.id,
      'remaining_quota', 0, 'period_ends_at', v_period_end);
  end if;

  if v_task.recurrence <> 'daily'::public.task_recurrence then
    select period_start, period_end into v_day_start, v_day_end
    from private.period_bounds('daily'::public.task_recurrence, now());

    select count(*)::integer into v_used_today
    from public.task_completions
    where family_id = v_identity.family_id
      and task_id = v_task.id
      and completed_at >= v_day_start
      and completed_at < v_day_end;

    if v_used_today > 0 then
      return jsonb_build_object('ok', false, 'code', 'TASK_ALREADY_DONE_TODAY', 'task_id', v_task.id,
        'remaining_quota', greatest(v_task.quota_per_period - v_used, 0), 'period_ends_at', v_period_end);
    end if;
  end if;

  select coalesce(sum(c.points_awarded), 0)::integer into v_previous_week_points
  from public.task_completions as c
  where c.family_id = v_identity.family_id
    and c.member_id = v_identity.member_id
    and c.week_start = v_week_start;

  select g.target_points into v_weekly_goal
  from public.member_weekly_goals as g
  where g.family_id = v_identity.family_id
    and g.member_id = v_identity.member_id
    and g.week_start = v_week_start;

  insert into public.task_completions (
    family_id, task_id, member_id, points_awarded, week_start, completed_at
  ) values (
    v_identity.family_id, v_task.id, v_identity.member_id, v_task.points, v_week_start, now()
  ) returning id into v_completion_id;

  v_remaining := v_task.quota_per_period - v_used - 1;
  v_current_week_points := v_previous_week_points + v_task.points;

  return jsonb_build_object(
    'ok', true, 'completion_id', v_completion_id, 'task_id', v_task.id,
    'points_awarded', v_task.points, 'remaining_quota', v_remaining,
    'is_last_slot', v_remaining = 0, 'period_ends_at', v_period_end,
    'current_week_points', v_current_week_points, 'weekly_goal', coalesce(v_weekly_goal, 0),
    'goal_reached_now', coalesce(v_weekly_goal, 0) > 0
      and v_previous_week_points < coalesce(v_weekly_goal, 0)
      and v_current_week_points >= coalesce(v_weekly_goal, 0)
  );
end;
$$;

create or replace function public.get_home_summary()
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
  v_rest public.member_rest_periods%rowtype;
begin
  select * into v_identity from private.require_active_member();

  select * into v_rest
  from public.member_rest_periods as rest
  where rest.family_id = v_identity.family_id
    and rest.member_id = v_identity.member_id
    and rest.started_at <= now()
    and (rest.ended_at is null or rest.ended_at > now())
  order by rest.started_at desc
  limit 1;

  select coalesce(sum(c.points_awarded), 0)::integer into v_points
  from public.task_completions as c
  where c.family_id = v_identity.family_id
    and c.member_id = v_identity.member_id
    and c.week_start = v_week_start;

  select g.target_points into v_goal
  from public.member_weekly_goals as g
  where g.family_id = v_identity.family_id
    and g.member_id = v_identity.member_id
    and g.week_start = v_week_start;

  if v_rest.id is not null then
    v_tasks := '[]'::jsonb;
  else
    select coalesce(jsonb_agg(task_data order by (task_data ->> 'title')), '[]'::jsonb) into v_tasks
    from (
      select jsonb_build_object(
        'id', t.id, 'title', t.title, 'description', t.description, 'points', t.points,
        'recurrence', t.recurrence, 'quota_per_period', t.quota_per_period,
        'remaining_quota', greatest(t.quota_per_period - usage.used_count, 0),
        'is_last_slot', greatest(t.quota_per_period - usage.used_count, 0) = 1
          and not (t.recurrence <> 'daily'::public.task_recurrence and daily_usage.used_count > 0),
        'is_done_today', t.recurrence <> 'daily'::public.task_recurrence and daily_usage.used_count > 0,
        'is_exhausted', usage.used_count >= t.quota_per_period
          or (t.recurrence <> 'daily'::public.task_recurrence and daily_usage.used_count > 0),
        'period_ends_at', bounds.period_end
      ) as task_data
      from public.tasks as t
      cross join lateral private.period_bounds(t.recurrence, now()) as bounds
      cross join lateral private.period_bounds('daily'::public.task_recurrence, now()) as day_bounds
      cross join lateral (
        select count(*)::integer as used_count from public.task_completions as c
        where c.family_id = t.family_id and c.task_id = t.id
          and c.completed_at >= bounds.period_start and c.completed_at < bounds.period_end
      ) as usage
      cross join lateral (
        select count(*)::integer as used_count from public.task_completions as c
        where c.family_id = t.family_id and c.task_id = t.id
          and c.completed_at >= day_bounds.period_start and c.completed_at < day_bounds.period_end
      ) as daily_usage
      where t.family_id = v_identity.family_id and t.is_active
    ) as available_tasks;
  end if;

  return jsonb_build_object(
    'ok', true, 'member_id', v_identity.member_id, 'week_start', v_week_start,
    'points', v_points, 'goal', coalesce(v_goal, 0),
    'points_remaining', greatest(coalesce(v_goal, 0) - v_points, 0),
    'week_ends_at', (v_week_start + 7)::timestamp at time zone 'America/Lima',
    'is_resting', v_rest.id is not null,
    'rest_duration', v_rest.duration,
    'rest_ends_at', v_rest.ended_at,
    'tasks', v_tasks
  );
end;
$$;

create or replace view public.weekly_member_results
with (security_invoker = true)
as
select
  g.family_id,
  g.member_id,
  m.name as member_name,
  g.week_start,
  g.target_points,
  coalesce(sum(c.points_awarded), 0)::integer as earned_points,
  (not rest.is_resting and coalesce(sum(c.points_awarded), 0) >= g.target_points) as goal_reached,
  fw.consequence,
  rest.is_resting
from public.member_weekly_goals as g
join public.family_members as m
  on m.id = g.member_id and m.family_id = g.family_id
left join public.task_completions as c
  on c.family_id = g.family_id and c.member_id = g.member_id and c.week_start = g.week_start
left join public.family_weeks as fw
  on fw.family_id = g.family_id and fw.week_start = g.week_start
cross join lateral (
  select exists (
    select 1
    from public.member_rest_periods as period
    where period.family_id = g.family_id
      and period.member_id = g.member_id
      and period.started_at < (g.week_start + 7)::timestamp at time zone 'America/Lima'
      and (period.ended_at is null or period.ended_at >= (g.week_start + 7)::timestamp at time zone 'America/Lima')
  ) as is_resting
) as rest
group by
  g.family_id, g.member_id, m.name, g.week_start,
  g.target_points, fw.consequence, rest.is_resting;

revoke all on table public.weekly_member_results from anon, authenticated;
grant select on table public.weekly_member_results to authenticated;

create or replace function public.get_pending_weekly_closure()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_identity record;
  v_user_id uuid := auth.uid();
  v_current_week_start date := private.current_week_start_lima();
  v_result record;
  v_task_count integer;
  v_top_tasks jsonb;
begin
  select * into v_identity from private.require_active_member();

  select r.week_start, r.member_name, r.earned_points, r.target_points, r.goal_reached, r.consequence
    into v_result
  from public.weekly_member_results as r
  where r.family_id = v_identity.family_id
    and r.member_id = v_identity.member_id
    and r.week_start < v_current_week_start
    and r.is_resting is false
    and not exists (
      select 1 from private.weekly_closure_views as seen
      where seen.user_id = v_user_id and seen.family_id = r.family_id
        and seen.member_id = r.member_id and seen.week_start = r.week_start
    )
  order by r.week_start desc
  limit 1;

  if v_result.week_start is null then
    return jsonb_build_object('ok', true, 'has_pending', false);
  end if;

  select count(*)::integer into v_task_count
  from public.task_completions as c
  where c.family_id = v_identity.family_id
    and c.member_id = v_identity.member_id
    and c.week_start = v_result.week_start;

  select coalesce(jsonb_agg(task_data order by task_data ->> 'completed_at' desc), '[]'::jsonb) into v_top_tasks
  from (
    select jsonb_build_object('id', c.id, 'title', t.title, 'points', c.points_awarded,
      'completed_at', c.completed_at) as task_data
    from public.task_completions as c
    join public.tasks as t on t.id = c.task_id and t.family_id = c.family_id
    where c.family_id = v_identity.family_id
      and c.member_id = v_identity.member_id
      and c.week_start = v_result.week_start
    order by c.completed_at desc
    limit 3
  ) as recent_tasks;

  return jsonb_build_object(
    'ok', true, 'has_pending', true, 'week_start', v_result.week_start,
    'member_name', v_result.member_name, 'earned_points', coalesce(v_result.earned_points, 0),
    'target_points', coalesce(v_result.target_points, 0),
    'points_missing', greatest(coalesce(v_result.target_points, 0) - coalesce(v_result.earned_points, 0), 0),
    'goal_reached', v_result.goal_reached is true, 'consequence', v_result.consequence,
    'task_count', coalesce(v_task_count, 0), 'top_tasks', coalesce(v_top_tasks, '[]'::jsonb)
  );
end;
$$;

comment on table public.member_rest_periods is
  'Auditable periods where a member is exempt from the weekly goal. Changes apply immediately.';
comment on function public.set_rest_mode(text) is
  'Activates rest mode immediately for the active member, either through this week or until disabled.';
comment on function public.disable_rest_mode() is
  'Ends the active member rest period immediately. The current week is then evaluated normally.';
