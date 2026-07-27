begin;

alter table public.training_plan_activations_v2
  add column start_date date;

do $$
begin
  if exists (
    select 1
    from public.training_plan_activations_v2 activation
    where not exists (
      select 1
      from pg_catalog.pg_timezone_names timezone
      where timezone.name = activation.timezone
    )
  ) then
    raise exception 'training V2 activation contains an invalid stored timezone'
      using errcode = '22023';
  end if;
end;
$$;

update public.training_plan_activations_v2
set start_date = (effective_at at time zone timezone)::date;

alter table public.training_plan_activations_v2
  add constraint training_plan_activations_v2_pending_start_date_check
  check (status <> 'pending' or start_date is not null);

comment on column public.training_plan_activations_v2.start_date is
  'User-entered local start date for scheduled activation; immediate activation creates no activation row.';

commit;
