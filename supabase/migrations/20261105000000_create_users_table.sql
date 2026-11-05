-- Initial users table required by the Instagram OAuth callback.
-- Instagram account IDs are stored as text to preserve their exact value.
create table if not exists public.users (
  id text primary key,
  username text not null,
  access_token text not null,
  token_expires_at timestamptz,
  updated_at timestamptz not null default now(),
  business_account_id text,
  page_id text
);

create index if not exists users_username_idx on public.users (username);

-- Tokens must never be readable by anonymous clients.
alter table public.users enable row level security;

-- The server uses the Supabase service-role key, which bypasses RLS.
-- Do not add anon/authenticated policies for this table.
