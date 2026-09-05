create table private.weekly_closure_views (
  user_id uuid not null references auth.users (id) on delete cascade,
  family_id uuid not null references public.families (id) on delete cascade,
  member_id uuid not null,
  week_start date not null,
  seen_at timestamptz not null default now(),
  primary key (user_id, member_id, week_start),
  foreign key (family_id, member_id)
    references public.family_members (family_id, id) on delete cascade
);

create index weekly_closure_views_family_week_idx
  on private.weekly_closure_views (family_id, week_start);

alter table private.weekly_closure_views enable row level security;
revoke all on table private.weekly_closure_views from public, anon, authenticated;

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
    and not exists (
      select 1
      from private.weekly_closure_views as seen
      where seen.user_id = v_user_id
        and seen.family_id = r.family_id
        and seen.member_id = r.member_id
        and seen.week_start = r.week_start
    )
  order by r.week_start desc
  limit 1;

  if v_result.week_start is null then
    return jsonb_build_object('ok', true, 'has_pending', false);
  end if;

  select count(*)::integer
    into v_task_count
  from public.task_completions as c
  where c.family_id = v_identity.family_id
    and c.member_id = v_identity.member_id
    and c.week_start = v_result.week_start;

  select coalesce(jsonb_agg(task_data order by task_data ->> 'completed_at' desc), '[]'::jsonb)
    into v_top_tasks
  from (
    select jsonb_build_object(
      'id', c.id,
      'title', t.title,
      'points', c.points_awarded,
      'completed_at', c.completed_at
    ) as task_data
    from public.task_completions as c
    join public.tasks as t
      on t.id = c.task_id
     and t.family_id = c.family_id
    where c.family_id = v_identity.family_id
      and c.member_id = v_identity.member_id
      and c.week_start = v_result.week_start
    order by c.completed_at desc
    limit 3
  ) as recent_tasks;

  return jsonb_build_object(
    'ok', true,
    'has_pending', true,
    'week_start', v_result.week_start,
    'member_name', v_result.member_name,
    'earned_points', coalesce(v_result.earned_points, 0),
    'target_points', coalesce(v_result.target_points, 0),
    'points_missing', greatest(coalesce(v_result.target_points, 0) - coalesce(v_result.earned_points, 0), 0),
    'goal_reached', v_result.goal_reached is true,
    'consequence', v_result.consequence,
    'task_count', coalesce(v_task_count, 0),
    'top_tasks', coalesce(v_top_tasks, '[]'::jsonb)
  );
end;
$$;

create or replace function public.mark_weekly_closure_seen(p_week_start date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_identity record;
  v_user_id uuid := auth.uid();
  v_current_week_start date := private.current_week_start_lima();
begin
  select * into v_identity from private.require_active_member();

  if p_week_start is null or p_week_start >= v_current_week_start then
    raise exception using errcode = 'P0001', message = 'INVALID_CLOSED_WEEK';
  end if;

  if not exists (
    select 1
    from public.member_weekly_goals as g
    where g.family_id = v_identity.family_id
      and g.member_id = v_identity.member_id
      and g.week_start = p_week_start
  ) then
    raise exception using errcode = 'P0001', message = 'WEEKLY_RESULT_NOT_FOUND';
  end if;

  insert into private.weekly_closure_views (user_id, family_id, member_id, week_start)
  values (v_user_id, v_identity.family_id, v_identity.member_id, p_week_start)
  on conflict (user_id, member_id, week_start) do update
  set seen_at = now();

  return jsonb_build_object('ok', true, 'week_start', p_week_start);
end;
$$;

revoke execute on function public.get_pending_weekly_closure() from public, anon;
revoke execute on function public.mark_weekly_closure_seen(date) from public, anon;

grant execute on function public.get_pending_weekly_closure() to authenticated;
grant execute on function public.mark_weekly_closure_seen(date) to authenticated;

comment on table private.weekly_closure_views is
  'Tracks which authenticated account has already seen each closed weekly result for an active member.';
comment on function public.get_pending_weekly_closure() is
  'Returns the newest closed weekly result that the current active member has not seen yet on this auth account.';
comment on function public.mark_weekly_closure_seen(date) is
  'Marks a closed weekly result as seen for the current active member and auth account.';
