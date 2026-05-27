alter table organizations
  add column if not exists pipeline_template text not null default 'real_estate_default',
  add column if not exists organization_settings jsonb not null default '{}'::jsonb;

alter table contacts
  add column if not exists pipeline_metadata jsonb not null default '{}'::jsonb;

alter table lead_opportunities
  add column if not exists pipeline_metadata jsonb not null default '{}'::jsonb;
