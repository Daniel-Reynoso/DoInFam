drop trigger if exists task_completions_are_immutable on public.task_completions;

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

  if v_task.recurrence <> 'daily'::public.task_recurrence then
    select period_start, period_end
      into v_day_start, v_day_end
    from private.period_bounds('daily'::public.task_recurrence, now());

    select count(*)::integer into v_used_today
    from public.task_completions
    where family_id = v_identity.family_id
      and task_id = v_task.id
      and completed_at >= v_day_start
      and completed_at < v_day_end;

    if v_used_today > 0 then
      return jsonb_build_object(
        'ok', false,
        'code', 'TASK_ALREADY_DONE_TODAY',
        'task_id', v_task.id,
        'remaining_quota', greatest(v_task.quota_per_period - v_used, 0),
        'period_ends_at', v_period_end
      );
    end if;
  end if;

  select coalesce(sum(c.points_awarded), 0)::integer
    into v_previous_week_points
  from public.task_completions as c
  where c.family_id = v_identity.family_id
    and c.member_id = v_identity.member_id
    and c.week_start = v_week_start;

  select g.target_points
    into v_weekly_goal
  from public.member_weekly_goals as g
  where g.family_id = v_identity.family_id
    and g.member_id = v_identity.member_id
    and g.week_start = v_week_start;

  insert into public.task_completions (
    family_id, task_id, member_id, points_awarded, week_start, completed_at
  ) values (
    v_identity.family_id, v_task.id, v_identity.member_id,
    v_task.points, v_week_start, now()
  ) returning id into v_completion_id;

  v_remaining := v_task.quota_per_period - v_used - 1;
  v_current_week_points := v_previous_week_points + v_task.points;

  return jsonb_build_object(
    'ok', true,
    'completion_id', v_completion_id,
    'task_id', v_task.id,
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

create or replace function public.delete_task_completion(p_completion_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_identity record;
  v_completion public.task_completions%rowtype;
  v_week_start date := private.current_week_start_lima();
begin
  select * into v_identity from private.require_active_member();

  select * into v_completion
  from public.task_completions
  where id = p_completion_id
    and family_id = v_identity.family_id
    and member_id = v_identity.member_id
  for update;

  if v_completion.id is null then
    raise exception using errcode = 'P0001', message = 'COMPLETION_NOT_FOUND';
  end if;

  if v_completion.week_start <> v_week_start then
    raise exception using errcode = 'P0001', message = 'ONLY_CURRENT_WEEK_COMPLETIONS_CAN_BE_DELETED';
  end if;

  delete from public.task_completions
  where id = v_completion.id;

  return jsonb_build_object(
    'ok', true,
    'completion_id', v_completion.id,
    'task_id', v_completion.task_id,
    'points_removed', v_completion.points_awarded
  );
end;
$$;

revoke execute on function public.delete_task_completion(uuid) from public, anon;
grant execute on function public.delete_task_completion(uuid) to authenticated;

comment on function public.complete_task(uuid) is
  'Completes a task for the active internal member session. Non-daily tasks can be completed at most once per Lima day by the whole family.';

comment on function public.delete_task_completion(uuid) is
  'Physically deletes an active member own current-week completion when it was marked by mistake.';

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
