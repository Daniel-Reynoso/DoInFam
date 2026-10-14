begin;
select plan(13);

select ok(exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'family_auth_accounts' and column_name = 'is_family_admin'), 'family access records identify the family administrator');
select ok(exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'family_auth_accounts_one_admin_per_family_idx'), 'only one family administrator can exist per family');
select ok(exists (select 1 from information_schema.tables where table_schema = 'private' and table_name = 'member_pin_reset_requests'), 'PIN reset authorizations are stored privately');
select ok(has_function_privilege('authenticated', 'public.get_pin_recovery_access()', 'EXECUTE'), 'authenticated accounts can inspect their recovery access');
select ok(not has_function_privilege('anon', 'public.get_pin_recovery_access()', 'EXECUTE'), 'anon database role cannot inspect recovery access');
select ok(has_function_privilege('authenticated', 'public.authorize_member_pin_reset(uuid)', 'EXECUTE'), 'authenticated accounts can call the guarded authorization endpoint');
select ok(not has_function_privilege('anon', 'public.authorize_member_pin_reset(uuid)', 'EXECUTE'), 'anon database role cannot authorize a PIN reset');
select ok(has_function_privilege('authenticated', 'public.complete_member_pin_reset(uuid,text)', 'EXECUTE'), 'authenticated accounts can call the guarded PIN creation endpoint');
select ok(not has_function_privilege('anon', 'public.complete_member_pin_reset(uuid,text)', 'EXECUTE'), 'anon database role cannot create the replacement PIN');
select ok(exists (select 1 from pg_proc where oid = 'public.authorize_member_pin_reset(uuid)'::regprocedure and prosecdef and array_to_string(proconfig, ',') like 'search_path=%'), 'PIN reset authorization is security definer with an explicit search path');
select ok(exists (select 1 from pg_proc where oid = 'public.complete_member_pin_reset(uuid,text)'::regprocedure and prosecdef and array_to_string(proconfig, ',') like 'search_path=%'), 'PIN creation is security definer with an explicit search path');
select ok(not exists (select 1 from information_schema.routine_privileges where routine_schema = 'public' and routine_name in ('authorize_member_pin_reset', 'complete_member_pin_reset') and grantee = 'PUBLIC'), 'PIN reset endpoints are not executable through PUBLIC');
select ok(to_regprocedure('public.reset_member_pin(uuid,text)') is null, 'the administrator can no longer directly choose a member PIN');

select * from finish();
rollback;
