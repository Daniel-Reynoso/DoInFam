begin;
select plan(20);

select ok(
  exists (select 1 from pg_namespace where nspname = 'private'),
  'private schema exists'
);

select is(
  (
    select count(*)::integer
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relname in (
        'families', 'family_members', 'tasks', 'family_weeks',
        'member_weekly_goals', 'task_completions'
      )
  ),
  6,
  'all six public core tables exist'
);

select is(
  (
    select count(*)::integer
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'private'
      and c.relkind = 'r'
      and c.relname in (
        'member_pin_credentials', 'active_member_sessions', 'member_pin_attempts'
      )
  ),
  3,
  'all three private identity tables exist'
);

select ok(
  not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relname in (
        'families', 'family_members', 'tasks', 'family_weeks',
        'member_weekly_goals', 'task_completions'
      )
      and not c.relrowsecurity
  ),
  'RLS is enabled on every public core table'
);

select ok(
  not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'private'
      and c.relkind = 'r'
      and c.relname in (
        'member_pin_credentials', 'active_member_sessions', 'member_pin_attempts'
      )
      and not c.relrowsecurity
  ),
  'RLS is enabled on every private identity table'
);

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'public'
      and policyname in (
        'families_select_own',
        'family_members_select_own_family',
        'tasks_select_own_family',
        'family_weeks_select_own_family',
        'member_weekly_goals_select_own_family',
        'task_completions_select_own_family'
      )
  ),
  6,
  'each public table has its family-scoped read policy'
);

select ok(
  has_table_privilege('authenticated', 'public.tasks', 'SELECT'),
  'authenticated can read tasks through RLS'
);

select ok(
  not has_table_privilege('authenticated', 'public.tasks', 'INSERT'),
  'authenticated cannot insert tasks directly'
);

select ok(
  not has_table_privilege('authenticated', 'public.task_completions', 'INSERT'),
  'authenticated cannot insert completions directly'
);

select ok(
  not has_table_privilege('authenticated', 'public.task_completions', 'DELETE'),
  'authenticated cannot delete completions directly'
);

select ok(
  not has_table_privilege('anon', 'public.tasks', 'SELECT'),
  'anonymous clients cannot read tasks'
);

select ok(
  not has_table_privilege('authenticated', 'private.active_member_sessions', 'SELECT'),
  'member sessions are inaccessible to authenticated clients'
);

select ok(
  has_function_privilege('authenticated', 'public.complete_task(uuid)', 'EXECUTE'),
  'authenticated can call complete_task'
);

select ok(
  not has_function_privilege('anon', 'public.complete_task(uuid)', 'EXECUTE'),
  'anonymous clients cannot call complete_task'
);

select ok(
  has_function_privilege('authenticated', 'public.delete_task_completion(uuid)', 'EXECUTE'),
  'authenticated can call delete_task_completion'
);

select ok(
  not has_function_privilege('anon', 'public.delete_task_completion(uuid)', 'EXECUTE'),
  'anonymous clients cannot call delete_task_completion'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.oid = 'public.complete_task(uuid)'::regprocedure
      and p.pronargs = 1
  ),
  'complete_task accepts only task_id and no member identity'
);

select ok(
  exists (
    select 1
    from pg_proc p
    where p.oid = 'public.complete_task(uuid)'::regprocedure
      and p.prosecdef
      and array_to_string(p.proconfig, ',') like 'search_path=%'
  ),
  'complete_task is security definer with an explicit search_path'
);

select ok(
  not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name in ('families', 'family_members')
      and column_name in ('points', 'points_total', 'total_points')
  ),
  'no mutable points counter exists on family profiles'
);

select ok(
  not exists (
    select 1 from information_schema.columns
    where table_schema = 'private'
      and table_name = 'member_pin_credentials'
      and column_name = 'pin'
  ),
  'no plaintext PIN column exists'
);

select ok(
  'monthly' = any(enum_range(null::public.task_recurrence)::text[]),
  'monthly recurrence is supported in the database'
);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'private'
      and table_name = 'active_member_sessions'
      and column_name = 'idle_expires_at'
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'private'
      and table_name = 'active_member_sessions'
      and column_name = 'absolute_expires_at'
  ),
  'member sessions track idle and absolute expiration'
);

select * from finish();
rollback;
