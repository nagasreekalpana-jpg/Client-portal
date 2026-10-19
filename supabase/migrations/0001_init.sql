-- TimeSheet Pro schema
-- All app data access happens server-side with the service role key after the
-- signed-in user is verified, so RLS is enabled with no policies (deny-all for
-- the anon/authenticated roles).

create type public.ts_status as enum ('draft', 'submitted', 'returned', 'approved', 'shared');
create type public.app_role as enum ('employee', 'manager');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text not null,
  designation text not null default '',
  role public.app_role not null default 'employee',
  manager_id uuid references public.profiles (id) on delete set null,
  company text not null default 'Hrudai',
  weekly_target numeric(5, 2) not null default 40,
  created_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  company_name text not null default 'New client',
  contact_name text not null default '',
  contact_title text not null default '',
  contact_email text not null default '',
  project_name text not null default '',
  project_code text not null default '',
  created_at timestamptz not null default now()
);
create index clients_owner_idx on public.clients (owner_id);

create table public.phases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  is_current boolean not null default false,
  created_at timestamptz not null default now()
);
create index phases_owner_idx on public.phases (owner_id);

create table public.timesheets (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  period_start date not null,
  period_end date not null,
  status public.ts_status not null default 'draft',
  version int not null default 1,
  code text not null,
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references public.profiles (id) on delete set null,
  shared_at timestamptz,
  shared_to text,
  return_comment text,
  returned_count int not null default 0,
  created_at timestamptz not null default now(),
  constraint timesheets_period_check check (period_end >= period_start),
  unique (employee_id, period_start)
);
create index timesheets_employee_idx on public.timesheets (employee_id);

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  timesheet_id uuid not null references public.timesheets (id) on delete cascade,
  entry_date date not null,
  category text not null,
  phase_id uuid references public.phases (id) on delete set null,
  phase_name text not null default '',
  description text not null,
  hours numeric(6, 2) not null check (hours > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index time_entries_ts_idx on public.time_entries (timesheet_id, entry_date);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  timesheet_id uuid not null references public.timesheets (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  actor_name text not null,
  actor_role text not null,
  action text not null,
  status public.ts_status,
  detail text,
  created_at timestamptz not null default now()
);
create index audit_events_ts_idx on public.audit_events (timesheet_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.phases enable row level security;
alter table public.timesheets enable row level security;
alter table public.time_entries enable row level security;
alter table public.audit_events enable row level security;
