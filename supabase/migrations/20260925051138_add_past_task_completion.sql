create or replace function public.get_past_task_options(p_completion_date date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_identity record;
  v_today date := (now() at time zone 'America/Lima')::date;
  v_week_start date := private.current_week_start_lima();
  v_effective_at timestamptz;
  v_tasks jsonb;
begin
  select * into v_identity from private.require_active_member();

  if p_completion_date is null
    or p_completion_date < v_week_start
    or p_completion_date >= v_today then
    raise exception using errcode = 'P0001', message = 'INVALID_PAST_TASK_DATE';
  end if;

  if private.member_is_resting_now(v_identity.family_id, v_identity.member_id) then
    return jsonb_build_object(
      'ok', false,
      'code', 'MEMBER_RESTING',
      'completion_date', p_completion_date,
      'tasks', '[]'::jsonb
    );
  end if;

  v_effective_at := (p_completion_date::timestamp + time '12:00') at time zone 'America/Lima';

  select coalesce(jsonb_agg(task_data order by task_data ->> 'title'), '[]'::jsonb)
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
      'is_available', usage.used_count < t.quota_per_period
        and not (t.recurrence <> 'daily'::public.task_recurrence and daily_usage.used_count > 0),
      'unavailable_reason', case
        when usage.used_count >= t.quota_per_period then 'QUOTA_EXHAUSTED'
        when t.recurrence <> 'daily'::public.task_recurrence and daily_usage.used_count > 0
          then 'TASK_ALREADY_DONE_ON_DATE'
        else null
      end,
      'period_ends_at', bounds.period_end
    ) as task_data
    from public.tasks as t
    cross join lateral private.period_bounds(t.recurrence, v_effective_at) as bounds
    cross join lateral private.period_bounds('daily'::public.task_recurrence, v_effective_at) as day_bounds
    cross join lateral (
      select count(*)::integer as used_count
      from public.task_completions as c
      where c.family_id = t.family_id
        and c.task_id = t.id
        and c.completed_at >= bounds.period_start
        and c.completed_at < bounds.period_end
    ) as usage
    cross join lateral (
      select count(*)::integer as used_count
      from public.task_completions as c
      where c.family_id = t.family_id
        and c.task_id = t.id
        and c.completed_at >= day_bounds.period_start
        and c.completed_at < day_bounds.period_end
    ) as daily_usage
    where t.family_id = v_identity.family_id
      and t.is_active
  ) as available_tasks;

  return jsonb_build_object(
    'ok', true,
    'completion_date', p_completion_date,
    'tasks', v_tasks
  );
end;
$$;

create or replace function public.complete_past_task(
  p_task_id uuid,
  p_completion_date date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_identity record;
  v_task public.tasks%rowtype;
  v_today date := (now() at time zone 'America/Lima')::date;
  v_week_start date := private.current_week_start_lima();
  v_effective_at timestamptz;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_day_start timestamptz;
  v_day_end timestamptz;
  v_used integer;
  v_used_on_date integer;
  v_remaining integer;
  v_completion_id uuid;
  v_previous_week_points integer;
  v_current_week_points integer;
  v_weekly_goal integer;
begin
  select * into v_identity from private.require_active_member();

  if p_completion_date is null
    or p_completion_date < v_week_start
    or p_completion_date >= v_today then
    raise exception using errcode = 'P0001', message = 'INVALID_PAST_TASK_DATE';
  end if;

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

  v_effective_at := (p_completion_date::timestamp + time '12:00') at time zone 'America/Lima';

  select period_start, period_end into v_period_start, v_period_end
  from private.period_bounds(v_task.recurrence, v_effective_at);

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

  if v_task.recurrence <> 'daily'::public.task_recurrence then
    select period_start, period_end into v_day_start, v_day_end
    from private.period_bounds('daily'::public.task_recurrence, v_effective_at);

    select count(*)::integer into v_used_on_date
    from public.task_completions
    where family_id = v_identity.family_id
      and task_id = v_task.id
      and completed_at >= v_day_start
      and completed_at < v_day_end;

    if v_used_on_date > 0 then
      return jsonb_build_object(
        'ok', false,
        'code', 'TASK_ALREADY_DONE_ON_DATE',
        'task_id', v_task.id,
        'remaining_quota', greatest(v_task.quota_per_period - v_used, 0),
        'period_ends_at', v_period_end
      );
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
    family_id,
    task_id,
    member_id,
    points_awarded,
    week_start,
    completed_at
  ) values (
    v_identity.family_id,
    v_task.id,
    v_identity.member_id,
    v_task.points,
    v_week_start,
    v_effective_at
  ) returning id into v_completion_id;

  v_remaining := v_task.quota_per_period - v_used - 1;
  v_current_week_points := v_previous_week_points + v_task.points;

  return jsonb_build_object(
    'ok', true,
    'completion_id', v_completion_id,
    'task_id', v_task.id,
    'completion_date', p_completion_date,
    'points_awarded', v_task.points,
    'remaining_quota', v_remaining,
    'is_last_slot', v_remaining = 0,
    'period_ends_at', v_period_end,
    'current_week_points', v_current_week_points,
    'weekly_goal', coalesce(v_weekly_goal, 0),
    'goal_reached_now', coalesce(v_weekly_goal, 0) > 0
      and v_previous_week_points < coalesce(v_weekly_goal, 0)
      and v_current_week_points >= coalesce(v_weekly_goal, 0)
  );
end;
$$;

revoke execute on function public.get_past_task_options(date) from public, anon;
revoke execute on function public.complete_past_task(uuid, date) from public, anon;
grant execute on function public.get_past_task_options(date) to authenticated;
grant execute on function public.complete_past_task(uuid, date) to authenticated;

comment on function public.get_past_task_options(date) is
  'Lists active tasks and their quota availability for a previous day in the current open Lima week.';
comment on function public.complete_past_task(uuid, date) is
  'Registers a task on a previous day of the current open Lima week while enforcing family quotas.';
