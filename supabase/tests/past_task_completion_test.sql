begin;
select plan(8);

select ok(
  has_function_privilege('authenticated', 'public.get_past_task_options(date)', 'EXECUTE'),
  'authenticated accounts can list past task options'
);

select ok(
  not has_function_privilege('anon', 'public.get_past_task_options(date)', 'EXECUTE'),
  'anon database role cannot list past task options'
);

select ok(
  has_function_privilege('authenticated', 'public.complete_past_task(uuid,date)', 'EXECUTE'),
  'authenticated accounts can call the guarded past completion endpoint'
);

select ok(
  not has_function_privilege('anon', 'public.complete_past_task(uuid,date)', 'EXECUTE'),
  'anon database role cannot register past task completions'
);

select ok(
  exists (
    select 1 from pg_proc
    where oid = 'public.get_past_task_options(date)'::regprocedure
      and prosecdef
      and array_to_string(proconfig, ',') like 'search_path=%'
  ),
  'past task options use security definer with an explicit search path'
);

select ok(
  exists (
    select 1 from pg_proc
    where oid = 'public.complete_past_task(uuid,date)'::regprocedure
      and prosecdef
      and array_to_string(proconfig, ',') like 'search_path=%'
  ),
  'past task completion uses security definer with an explicit search path'
);

select ok(
  not exists (
    select 1 from information_schema.routine_privileges
    where routine_schema = 'public'
      and routine_name = 'get_past_task_options'
      and grantee = 'PUBLIC'
  ),
  'past task options are not executable through PUBLIC'
);

select ok(
  not exists (
    select 1 from information_schema.routine_privileges
    where routine_schema = 'public'
      and routine_name = 'complete_past_task'
      and grantee = 'PUBLIC'
  ),
  'past task completion is not executable through PUBLIC'
);

select * from finish();
rollback;
