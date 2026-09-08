create index member_rest_periods_changed_by_user_idx
  on public.member_rest_periods (changed_by_user_id)
  where changed_by_user_id is not null;
