-- ═══════════════════════════════════════════════════════════════════════
-- Migration: Roqué de Duprey / Betances groups + per-person completions
--            + help requests
-- Run this ENTIRE file once in the Supabase SQL Editor (Project → SQL Editor
-- → New query → paste → Run). It's additive: it does not touch existing
-- rows, and re-running it is safe (everything uses IF NOT EXISTS / OR
-- REPLACE-style guards).
-- ═══════════════════════════════════════════════════════════════════════

-- ─── 1. Assignments: which group (Roqué de Duprey vs Betances) ───────────

alter table assignments
  add column if not exists class_group text not null default 'roque'
  check (class_group in ('roque', 'betances'));

-- ─── 2. Friday cycles: same table, now split by group too ────────────────
-- (friday_cycles already exists in your live project — it wasn't in the
-- original schema.sql file. This adds a class_group column and re-does the
-- uniqueness so the same Friday can be Cycle 1 for one group and Cycle 2
-- for the other.)

alter table friday_cycles
  add column if not exists class_group text not null default 'roque'
  check (class_group in ('roque', 'betances'));

-- Drop the old single-column uniqueness on friday_date, if it exists, so a
-- date can appear twice (once per group). This uses Postgres's default
-- constraint-naming convention; if it errors, open Table Editor →
-- friday_cycles → the date column → and remove its "unique" constraint by
-- hand, then re-run just the two statements below.
alter table friday_cycles drop constraint if exists friday_cycles_friday_date_key;

create unique index if not exists friday_cycles_date_group_idx
  on friday_cycles (friday_date, class_group);

-- ─── 3. Per-person completions ("mark done" by first name, no accounts) ──

create table if not exists assignment_completions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments(id) on delete cascade,
  first_name text not null,
  completed_at timestamptz not null default now()
);

-- One completion row per person per assignment (case-insensitive on name).
create unique index if not exists assignment_completions_unique_person
  on assignment_completions (assignment_id, lower(first_name));

alter table assignment_completions enable row level security;

create policy "assignment_completions_select_public"
  on assignment_completions for select
  using (true);

create policy "assignment_completions_insert_public"
  on assignment_completions for insert
  with check (true);

create policy "assignment_completions_delete_public"
  on assignment_completions for delete
  using (true);

-- ─── 4. Help requests ("Help" button on each assignment) ─────────────────

create table if not exists assignment_help_requests (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments(id) on delete cascade,
  first_name text not null,
  created_at timestamptz not null default now()
);

-- One open help request per person per assignment; asking again just
-- refreshes the timestamp instead of creating a duplicate row.
create unique index if not exists assignment_help_requests_unique_person
  on assignment_help_requests (assignment_id, lower(first_name));

alter table assignment_help_requests enable row level security;

create policy "assignment_help_requests_select_public"
  on assignment_help_requests for select
  using (true);

create policy "assignment_help_requests_insert_public"
  on assignment_help_requests for insert
  with check (true);

create policy "assignment_help_requests_update_public"
  on assignment_help_requests for update
  using (true);

create policy "assignment_help_requests_delete_public"
  on assignment_help_requests for delete
  using (true);
