-- Frank Group AI Governance Dashboard — Phase 2 persistence (TASK-05)
-- Run in Supabase SQL Editor after creating a project.

-- Periods
create table if not exists periods (
  id          uuid primary key default gen_random_uuid(),
  label       text not null,
  date_from   date,
  date_to     date,
  created_at  timestamptz default now()
);

-- Per-user metrics per period
create table if not exists period_users (
  id                uuid primary key default gen_random_uuid(),
  period_id         uuid not null references periods(id) on delete cascade,
  email             text not null,
  name              text,
  entity            text,
  seat_tier         text,
  total_spend_usd   numeric,
  total_tokens      bigint,
  total_requests    integer,
  opus_pct          numeric,
  fluency_score     numeric,
  fluency_tier      integer,
  model_breakdown   jsonb,
  product_breakdown jsonb,
  created_at        timestamptz default now()
);

create index if not exists period_users_period_id_idx on period_users (period_id);
create index if not exists period_users_email_idx on period_users (email);

-- Row-level security (Magic Link / session required)
alter table periods enable row level security;
alter table period_users enable row level security;

-- Adjust role names if your project uses a custom authenticated role.
create policy "periods_select_authenticated" on periods
  for select to authenticated using (true);

create policy "periods_insert_authenticated" on periods
  for insert to authenticated with check (true);

create policy "period_users_select_authenticated" on period_users
  for select to authenticated using (true);

create policy "period_users_insert_authenticated" on period_users
  for insert to authenticated with check (true);

-- Optional: restrict sign-ups to Frank domains via Supabase Dashboard → Authentication →
-- Hooks or email templates. Client-side checks are not sufficient on their own.
