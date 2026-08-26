-- MayBahaBa — "humupa na" (the flood has subsided) + follow-up reports
--
-- Run after 0006. Safe to run more than once.
--
-- Two changes, both additive:
--
--  1. A new `flood_depth` enum value. It is stored in the same column as
--     the depths even though it is not one, because what the card shows
--     is always "the newest condition reported here", and subsided is a
--     condition. Keeping it in one column is what lets the existing
--     freshness, confidence and ordering logic work unchanged.
--
--  2. `follow_up_to` — a self-reference recording that this report was
--     filed in answer to an earlier one. A follow-up is a NEW row, never
--     an edit of the original: the first reporter's observation was true
--     when they made it, and overwriting it would both destroy the audit
--     trail and let one anonymous tap erase a stranger's flood warning.

-- Enum values cannot be added inside a transaction block in older
-- Postgres, and `if not exists` makes the re-run case a no-op.
alter type flood_depth add value if not exists 'HUMUPA_NA';

alter table reports
  add column if not exists follow_up_to uuid references reports(id) on delete set null;

-- Lets the moderator view answer "what happened at this spot after that
-- report?" without a sequential scan as the table grows.
create index if not exists reports_follow_up_to_idx
  on reports (follow_up_to)
  where follow_up_to is not null;

comment on column reports.follow_up_to is
  'The report this one updates, if any. Follow-ups are new rows, never edits — the original observation is preserved.';

-- ===================================================================
-- Verification — both must say OK
-- ===================================================================
-- Deliberately checks the catalog rather than casting a literal to the
-- enum: Postgres refuses to *use* a new enum value in the same
-- transaction that added it, and the Supabase SQL editor runs a pasted
-- file as one transaction. Reading pg_enum sidesteps that entirely.
select
  case when exists (
    select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
     where t.typname = 'flood_depth' and e.enumlabel = 'HUMUPA_NA'
  ) then 'OK' else 'MISSING' end                        as "HUMUPA_NA enum value",
  case when exists (
    select 1 from information_schema.columns
     where table_name = 'reports' and column_name = 'follow_up_to'
  ) then 'OK' else 'MISSING' end                        as "follow_up_to column";
