-- TOS Supabase/Postgres starter schema for the next persistence layer.
-- This mirrors the approved Phase 1 data model.

create table if not exists firms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  city text,
  state text,
  status text not null default 'TRIAL',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid references firms(id),
  name text not null,
  email text not null unique,
  platform_role text not null default 'STANDARD',
  firm_role text not null default 'ARTICLE_STAFF',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id),
  name text not null,
  pan text,
  gstin text,
  email text,
  mobile text,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms(id),
  client_id uuid not null references clients(id),
  title text not null,
  description text,
  status text not null default 'OPEN',
  priority text not null default 'NORMAL',
  due_date date not null,
  reviewer_id uuid not null references profiles(id),
  created_by_id uuid not null references profiles(id),
  closed_by_id uuid references profiles(id),
  closure_remarks text,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists task_assignees (
  task_id uuid not null references tasks(id),
  user_id uuid not null references profiles(id),
  assigned_at timestamptz not null default now(),
  primary key (task_id, user_id)
);

create table if not exists task_notes (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id),
  author_id uuid not null references profiles(id),
  note text not null,
  old_status text,
  new_status text,
  created_at timestamptz not null default now()
);

create table if not exists activity_logs (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid references firms(id),
  actor_id uuid references profiles(id),
  entity_type text not null,
  entity_id text,
  action text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);
