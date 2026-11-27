-- READ ONLY. This query never applies migrations or repairs their journal.
begin transaction isolation level repeatable read read only;
with expected(version) as (values
 ('20260726180000'),('20260726190000'),('20260726200000'),('20260726210000'),
 ('20260728210635'),('20260729060000'),('20260730120000'),('20260731090000'),
 ('20260731130000'),('20260809100000'),('20261123180000'),('20261126110000'),
 ('20261126120000'),('20261126130000')
), state as (
 select
  (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relkind='r' and c.relname ~ '^training_.*_v2$') as v2_tables,
  (select count(*) from expected e join supabase_migrations.schema_migrations m using(version)) as journal_entries
)
select v2_tables,journal_entries,
 case when v2_tables=0 and journal_entries=0 then 'EMPTY_V2_BASELINE_REQUIRES_BACKUP_AND_APPROVAL'
      when v2_tables=19 and journal_entries=14 then 'VERIFY_OBJECT_DEFINITIONS_AND_CONTRACTS'
      else 'HARD_STOP_SCHEMA_JOURNAL_DRIFT' end as migration_gate,
 (select jsonb_agg(e.version order by e.version) from expected e
  where not exists(select 1 from supabase_migrations.schema_migrations m where m.version=e.version)) as missing_journal_versions,
 (select count(*) from public.training_plans) as legacy_plans,
 (select count(*) from public.training_sessions) as legacy_sessions
from state;
commit;
