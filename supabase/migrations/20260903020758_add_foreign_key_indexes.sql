-- Cover composite foreign keys used for tenant-consistent references.
create index tasks_family_created_by_member_idx
  on public.tasks (family_id, created_by_member_id);

create index task_completions_family_task_idx
  on public.task_completions (family_id, task_id);

create index task_completions_family_member_idx
  on public.task_completions (family_id, member_id);
