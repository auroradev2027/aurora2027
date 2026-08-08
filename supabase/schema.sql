-- Class of 2026 Portal — run this entire file in Supabase SQL Editor

-- ─── Tables ───────────────────────────────────────────────────────────────

create table if not exists assignments (
  id uuid primary key default gen_random_uuid(),
  class_name text not null,
  title text not null,
  due_date date not null,
  is_completed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null check (category in ('Study Guides', 'Test Summaries', 'College Apps')),
  file_url text not null,
  uploaded_at timestamptz not null default now()
);

create table if not exists calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_date date not null,
  description text
);

create table if not exists edit_requests (
  id uuid primary key default gen_random_uuid(),
  proposed_title text not null,
  proposed_date date not null,
  proposed_description text,
  requester_name text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected'))
);

-- ─── Row Level Security ───────────────────────────────────────────────────

alter table assignments enable row level security;
alter table resources enable row level security;
alter table calendar_events enable row level security;
alter table edit_requests enable row level security;

-- assignments: public read + write (PIN gated in frontend)
create policy "assignments_select_public"
  on assignments for select
  using (true);

create policy "assignments_insert_public"
  on assignments for insert
  with check (true);

create policy "assignments_update_public"
  on assignments for update
  using (true);

create policy "assignments_delete_public"
  on assignments for delete
  using (true);

-- resources: public read + insert (uploads)
create policy "resources_select_public"
  on resources for select
  using (true);

create policy "resources_insert_public"
  on resources for insert
  with check (true);

-- calendar_events: public read only (admin approve flow inserts via anon key)
create policy "calendar_events_select_public"
  on calendar_events for select
  using (true);

create policy "calendar_events_insert_public"
  on calendar_events for insert
  with check (true);

create policy "calendar_events_update_public"
  on calendar_events for update
  using (true);

create policy "calendar_events_delete_public"
  on calendar_events for delete
  using (true);

-- edit_requests: public read + insert; admin approve/reject = delete/update
create policy "edit_requests_select_public"
  on edit_requests for select
  using (true);

create policy "edit_requests_insert_public"
  on edit_requests for insert
  with check (true);

create policy "edit_requests_update_public"
  on edit_requests for update
  using (true);

create policy "edit_requests_delete_public"
  on edit_requests for delete
  using (true);

-- ─── Storage bucket (public read for Resource Hub) ────────────────────────
-- Note: bucket creation via SQL; policies below allow public upload + read.

insert into storage.buckets (id, name, public)
values ('resources', 'resources', true)
on conflict (id) do update set public = true;

create policy "resources_storage_select_public"
  on storage.objects for select
  using (bucket_id = 'resources');

create policy "resources_storage_insert_public"
  on storage.objects for insert
  with check (bucket_id = 'resources');

create policy "resources_storage_delete_public"
  on storage.objects for delete
  using (bucket_id = 'resources');

-- ─── Optional seed data (remove if not wanted) ────────────────────────────

insert into calendar_events (title, event_date, description) values
  ('Graduation', '2026-06-12', 'Class of 2026 graduation ceremony');
