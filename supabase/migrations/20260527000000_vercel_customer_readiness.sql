alter table imports
  add column if not exists raw_storage_provider text not null default 'supabase',
  add column if not exists raw_file_url text,
  add column if not exists archived_at timestamptz;

alter table message_drafts
  add column if not exists model_used text,
  add column if not exists generated_at timestamptz,
  add column if not exists ai_generation_notes jsonb not null default '{}'::jsonb;
