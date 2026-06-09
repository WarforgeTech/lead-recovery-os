alter table imports
  add column if not exists input_type text not null default 'csv',
  add column if not exists source_kind text not null default 'lead_file',
  add column if not exists workflow_status text not null default 'processed',
  add column if not exists workflow_phase text,
  add column if not exists workflow_percent integer not null default 100,
  add column if not exists workflow_eta_seconds integer,
  add column if not exists parser_version text,
  add column if not exists ai_pipeline_version text,
  add column if not exists ai_model text,
  add column if not exists review_summary jsonb not null default '{}'::jsonb,
  add column if not exists ready_rows integer not null default 0,
  add column if not exists problem_rows integer not null default 0,
  add column if not exists suppressed_rows integer not null default 0,
  add column if not exists merged_rows integer not null default 0,
  add column if not exists raw_hash text,
  add column if not exists idempotency_key text,
  add column if not exists accepted_by uuid references auth.users(id),
  add column if not exists accepted_at timestamptz,
  add column if not exists rejected_at timestamptz,
  add column if not exists error_message text;

create table if not exists import_jobs (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references imports(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  status text not null default 'queued',
  phase text not null default 'queued',
  percent integer not null default 0,
  eta_seconds integer,
  counts jsonb not null default '{}'::jsonb,
  locked_by text,
  locked_at timestamptz,
  retry_count integer not null default 0,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (import_id)
);

create table if not exists import_rows (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references imports(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  row_number integer not null,
  raw_record jsonb not null default '{}'::jsonb,
  normalized_record jsonb not null default '{}'::jsonb,
  journey jsonb not null default '{}'::jsonb,
  proposed_action text not null default 'create',
  confidence text not null default 'medium',
  dedupe_key text,
  matched_contact_id uuid references contacts(id) on delete set null,
  review_status text not null default 'needs_review',
  problem_reason text,
  suppression_reason text,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists contact_identities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  kind text not null,
  normalized_value text not null,
  confidence text not null default 'high',
  source_import_id uuid references imports(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists contact_exclusions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  kind text not null,
  email text,
  phone text,
  normalized_name text,
  reason text not null,
  source_import_id uuid references imports(id) on delete set null,
  created_by uuid references auth.users(id),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists contact_journey_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  import_id uuid references imports(id) on delete set null,
  event_date date,
  event_type text not null default 'note',
  source text,
  summary text not null,
  confidence text not null default 'medium',
  raw_refs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists import_merge_decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  import_id uuid not null references imports(id) on delete cascade,
  import_row_id uuid references import_rows(id) on delete set null,
  contact_id uuid references contacts(id) on delete set null,
  decision text not null,
  reason text,
  decided_by uuid references auth.users(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists ai_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  import_id uuid references imports(id) on delete cascade,
  purpose text not null,
  model text,
  input_tokens integer,
  output_tokens integer,
  latency_ms integer,
  status text not null default 'completed',
  trace_id text,
  cost_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists imports_org_workflow_idx on imports(organization_id, workflow_status);
create index if not exists import_jobs_claim_idx on import_jobs(status, locked_at, created_at);
create index if not exists import_jobs_import_idx on import_jobs(import_id);
create index if not exists import_rows_import_status_idx on import_rows(import_id, review_status);
create index if not exists import_rows_org_idx on import_rows(organization_id);
create unique index if not exists contact_identities_unique_idx
  on contact_identities(organization_id, kind, normalized_value);
create index if not exists contact_exclusions_lookup_idx on contact_exclusions(organization_id, email, phone);
create index if not exists contact_journey_contact_idx on contact_journey_events(contact_id, event_date);
create index if not exists ai_runs_import_idx on ai_runs(import_id, purpose);

drop trigger if exists import_jobs_touch on import_jobs;
create trigger import_jobs_touch before update on import_jobs for each row execute function touch_updated_at();
drop trigger if exists import_rows_touch on import_rows;
create trigger import_rows_touch before update on import_rows for each row execute function touch_updated_at();

alter table import_jobs enable row level security;
alter table import_rows enable row level security;
alter table contact_identities enable row level security;
alter table contact_exclusions enable row level security;
alter table contact_journey_events enable row level security;
alter table import_merge_decisions enable row level security;
alter table ai_runs enable row level security;

create policy import_jobs_member_select on import_jobs for select using (is_org_member(organization_id));
create policy import_jobs_admin_write on import_jobs for all using (is_org_admin(organization_id)) with check (is_org_admin(organization_id));

create policy import_rows_member_select on import_rows for select using (is_org_member(organization_id));
create policy import_rows_admin_write on import_rows for all using (is_org_admin(organization_id)) with check (is_org_admin(organization_id));

create policy identities_member_select on contact_identities for select using (is_org_member(organization_id));
create policy identities_admin_write on contact_identities for all using (is_org_admin(organization_id)) with check (is_org_admin(organization_id));

create policy exclusions_member_select on contact_exclusions for select using (is_org_member(organization_id));
create policy exclusions_admin_write on contact_exclusions for all using (is_org_admin(organization_id)) with check (is_org_admin(organization_id));

create policy journey_member_select on contact_journey_events for select using (is_org_member(organization_id));
create policy journey_member_insert on contact_journey_events for insert with check (is_org_member(organization_id));
create policy journey_admin_write on contact_journey_events for all using (is_org_admin(organization_id)) with check (is_org_admin(organization_id));

create policy merge_decisions_member_select on import_merge_decisions for select using (is_org_member(organization_id));
create policy merge_decisions_admin_write on import_merge_decisions for all using (is_org_admin(organization_id)) with check (is_org_admin(organization_id));

create policy ai_runs_member_select on ai_runs for select using (is_org_member(organization_id));
create policy ai_runs_admin_write on ai_runs for all using (is_org_admin(organization_id)) with check (is_org_admin(organization_id));

create or replace function claim_next_import_job(p_worker_id text)
returns import_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed import_jobs;
begin
  update import_jobs
  set
    status = 'processing',
    phase = 'reading_file',
    percent = greatest(percent, 5),
    locked_by = p_worker_id,
    locked_at = now(),
    retry_count = retry_count + case when status = 'failed' then 1 else 0 end,
    error_message = null
  where id = (
    select id
    from import_jobs
    where
      status = 'queued'
      or (
        status = 'processing'
        and locked_at < now() - interval '10 minutes'
      )
      or (
        status = 'failed'
        and retry_count < 2
      )
    order by created_at asc
    for update skip locked
    limit 1
  )
  returning * into claimed;

  return claimed;
end;
$$;

create or replace function set_import_job_progress(
  p_job_id uuid,
  p_status text,
  p_phase text,
  p_percent integer,
  p_eta_seconds integer default null,
  p_counts jsonb default '{}'::jsonb,
  p_error_message text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update import_jobs
  set
    status = p_status,
    phase = p_phase,
    percent = greatest(0, least(100, p_percent)),
    eta_seconds = p_eta_seconds,
    counts = coalesce(p_counts, '{}'::jsonb),
    error_message = p_error_message,
    completed_at = case when p_status in ('ready_for_review', 'accepted', 'failed') then now() else completed_at end
  where id = p_job_id;

  update imports
  set
    workflow_status = p_status,
    workflow_phase = p_phase,
    workflow_percent = greatest(0, least(100, p_percent)),
    workflow_eta_seconds = p_eta_seconds,
    error_message = p_error_message
  where id = (select import_id from import_jobs where id = p_job_id);
end;
$$;
