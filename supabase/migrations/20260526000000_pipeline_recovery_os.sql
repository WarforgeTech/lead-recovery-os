create extension if not exists pgcrypto;

create type member_role as enum ('owner', 'client', 'admin');
create type client_status as enum ('pilot', 'active', 'paused', 'archived');
create type import_status as enum ('uploaded', 'processed', 'failed');
create type lead_segment as enum ('hot_reactivation', 'old_buyer', 'old_seller', 'past_client', 'referral_ask', 'needs_consent');
create type consent_status as enum ('ok', 'review', 'do_not_contact');
create type opportunity_status as enum ('new', 'needs_review', 'ready_to_contact', 'approved', 'contacted', 'replied', 'appointment_set', 'not_now', 'do_not_contact', 'closed_won', 'closed_lost');
create type draft_status as enum ('draft', 'edited', 'approved');

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  client_type text not null default 'agent',
  status client_status not null default 'pilot',
  market text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  email text not null,
  role member_role not null default 'client',
  created_at timestamptz not null default now(),
  unique (organization_id, email)
);

create table imports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  uploaded_by uuid references auth.users(id),
  source_filename text,
  raw_file_path text,
  status import_status not null default 'uploaded',
  mapping jsonb not null default '{}'::jsonb,
  total_rows integer not null default 0,
  processed_rows integer not null default 0,
  duplicate_rows integer not null default 0,
  missing_contact_rows integer not null default 0,
  held_for_review_rows integer not null default 0,
  priority_opportunities integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create table contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  import_id uuid references imports(id) on delete set null,
  name text not null,
  email text,
  phone text,
  source text,
  lead_type text,
  area text,
  price_range text,
  timeline text,
  last_contact_at date,
  consent consent_status not null default 'review',
  owner_name text,
  raw_notes text,
  normalized_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table contact_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  note text not null,
  note_date date,
  created_at timestamptz not null default now()
);

create table lead_opportunities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  segment lead_segment not null,
  status opportunity_status not null default 'new',
  priority_score integer not null default 50,
  estimated_value_cents integer not null default 830000,
  recommended_action text,
  next_follow_up_at date,
  assigned_to uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table message_drafts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  opportunity_id uuid not null references lead_opportunities(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  channel text not null default 'manual',
  draft_text text not null,
  edited_text text,
  approval_status draft_status not null default 'draft',
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table activity_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id),
  event text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index organization_members_user_idx on organization_members(user_id);
create index organization_members_email_idx on organization_members(lower(email));
create index imports_org_idx on imports(organization_id);
create index contacts_org_idx on contacts(organization_id);
create index contacts_email_idx on contacts(lower(email));
create index contacts_phone_idx on contacts(phone);
create index lead_opportunities_org_status_idx on lead_opportunities(organization_id, status);
create index lead_opportunities_org_segment_idx on lead_opportunities(organization_id, segment);
create index message_drafts_org_status_idx on message_drafts(organization_id, approval_status);

create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger organizations_touch before update on organizations for each row execute function touch_updated_at();
create trigger contacts_touch before update on contacts for each row execute function touch_updated_at();
create trigger lead_opportunities_touch before update on lead_opportunities for each row execute function touch_updated_at();
create trigger message_drafts_touch before update on message_drafts for each row execute function touch_updated_at();

create or replace function current_user_email()
returns text language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

create or replace function is_org_member(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from organization_members
    where organization_id = org
      and (
        user_id = auth.uid()
        or lower(email) = current_user_email()
      )
  );
$$;

create or replace function is_org_admin(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from organization_members
    where organization_id = org
      and role in ('owner', 'admin')
      and (
        user_id = auth.uid()
        or lower(email) = current_user_email()
      )
  );
$$;

alter table organizations enable row level security;
alter table organization_members enable row level security;
alter table imports enable row level security;
alter table contacts enable row level security;
alter table contact_notes enable row level security;
alter table lead_opportunities enable row level security;
alter table message_drafts enable row level security;
alter table activity_log enable row level security;

create policy organizations_member_select on organizations for select using (is_org_member(id));
create policy organizations_admin_update on organizations for update using (is_org_admin(id)) with check (is_org_admin(id));

create policy members_select on organization_members for select using (is_org_member(organization_id));
create policy members_admin_write on organization_members for all using (is_org_admin(organization_id)) with check (is_org_admin(organization_id));

create policy imports_member_select on imports for select using (is_org_member(organization_id));
create policy imports_admin_write on imports for all using (is_org_admin(organization_id)) with check (is_org_admin(organization_id));

create policy contacts_member_select on contacts for select using (is_org_member(organization_id));
create policy contacts_member_update on contacts for update using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy contacts_admin_insert on contacts for insert with check (is_org_admin(organization_id));

create policy notes_member_select on contact_notes for select using (is_org_member(organization_id));
create policy notes_member_insert on contact_notes for insert with check (is_org_member(organization_id));

create policy opportunities_member_select on lead_opportunities for select using (is_org_member(organization_id));
create policy opportunities_member_update on lead_opportunities for update using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy opportunities_admin_insert on lead_opportunities for insert with check (is_org_admin(organization_id));

create policy drafts_member_select on message_drafts for select using (is_org_member(organization_id));
create policy drafts_member_update on message_drafts for update using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy drafts_admin_insert on message_drafts for insert with check (is_org_admin(organization_id));

create policy activity_member_select on activity_log for select using (is_org_member(organization_id));
create policy activity_member_insert on activity_log for insert with check (is_org_member(organization_id));

insert into storage.buckets (id, name, public)
values ('raw-imports', 'raw-imports', false)
on conflict (id) do nothing;
