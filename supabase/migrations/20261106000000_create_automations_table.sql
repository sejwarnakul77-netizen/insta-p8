-- Automation rules used by POST/GET /api/automations.
create extension if not exists pgcrypto;

create table if not exists public.automations (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  trigger_source text not null check (trigger_source in ('comment', 'dm', 'story')),
  trigger_type text not null default 'keyword',
  trigger_value text not null,
  response_type text not null default 'pro',
  response_content text not null,
  is_active boolean not null default true,
  specific_media_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists automations_user_id_created_at_idx
  on public.automations (user_id, created_at desc);

alter table public.automations enable row level security;

-- Server-side API uses the Supabase service-role key; no public client policies
-- are created because automation records may contain private DM reply content.
