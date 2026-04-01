-- Frank Group AI Governance Dashboard — Schema Hardening Migrations
-- Generated from docs/SCHEMA_HARDENING_PLAN.md
--
-- HOW TO APPLY: Paste each migration block into the Supabase Dashboard SQL Editor
-- (Project: pwuapjdfrdbgcekrwlpr → SQL Editor) and run them IN ORDER.
-- Each block is idempotent (IF NOT EXISTS / DO NOTHING / OR REPLACE).

-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 1: fix_constraints_and_indexes (P1 correctness bugs)
-- ─────────────────────────────────────────────────────────────────────────────

-- P1-A: unique constraint on period_users (prevents duplicates on retry/double-click)
ALTER TABLE public.period_users
  ADD CONSTRAINT period_users_period_email_unique UNIQUE (period_id, email);

-- P1-B: make date columns NOT NULL (safe — 0 rows currently; NULL=NULL is false in Postgres)
ALTER TABLE public.periods
  ALTER COLUMN date_from SET NOT NULL,
  ALTER COLUMN date_to   SET NOT NULL;

-- P1-C: composite index on periods dates (used by every Save Period click)
CREATE INDEX IF NOT EXISTS periods_dates_idx ON public.periods (date_from, date_to);

-- P1-D: unique constraint on document_chunks (prevents duplicates on Edge Function retry)
ALTER TABLE public.document_chunks
  ADD CONSTRAINT document_chunks_upload_chunk_unique UNIQUE (upload_id, chunk_index);


-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 2: add_usage_rows_table
-- Raw CSV rows — enables all SQL analytics without re-parsing files
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.usage_rows (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id         uuid NOT NULL REFERENCES public.uploads(id) ON DELETE CASCADE,
  period_id         uuid REFERENCES public.periods(id) ON DELETE SET NULL,
  user_email        text NOT NULL,
  model_id          text NOT NULL,
  model_class       text NOT NULL CHECK (model_class IN ('Opus', 'Sonnet', 'Haiku', 'Other')),
  product           text,
  requests          integer NOT NULL DEFAULT 0,
  prompt_tokens     bigint NOT NULL DEFAULT 0,
  completion_tokens bigint NOT NULL DEFAULT 0,
  total_tokens      bigint GENERATED ALWAYS AS (prompt_tokens + completion_tokens) STORED,
  net_spend_usd     numeric(12,6) NOT NULL DEFAULT 0,
  row_date          date,
  created_at        timestamptz DEFAULT now(),
  CONSTRAINT usage_rows_upload_user_model_product_unique
    UNIQUE (upload_id, user_email, model_id, product)
);

CREATE INDEX IF NOT EXISTS usage_rows_upload_id_idx   ON public.usage_rows (upload_id);
CREATE INDEX IF NOT EXISTS usage_rows_user_email_idx  ON public.usage_rows (user_email);
CREATE INDEX IF NOT EXISTS usage_rows_model_class_idx ON public.usage_rows (model_class);
CREATE INDEX IF NOT EXISTS usage_rows_row_date_idx    ON public.usage_rows (row_date);
CREATE INDEX IF NOT EXISTS usage_rows_upload_user_idx ON public.usage_rows (upload_id, user_email);

ALTER TABLE public.usage_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usage_rows_select_anon"          ON public.usage_rows FOR SELECT TO anon          USING (true);
CREATE POLICY "usage_rows_insert_anon"          ON public.usage_rows FOR INSERT TO anon          WITH CHECK (true);
CREATE POLICY "usage_rows_delete_anon"          ON public.usage_rows FOR DELETE TO anon          USING (true);
CREATE POLICY "usage_rows_select_authenticated" ON public.usage_rows FOR SELECT TO authenticated USING (true);
CREATE POLICY "usage_rows_insert_authenticated" ON public.usage_rows FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "usage_rows_delete_authenticated" ON public.usage_rows FOR DELETE TO authenticated USING (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 3: add_period_breakdown_tables
-- Normalised breakdown rows — enables SQL trend analytics on model/product mix
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.period_model_breakdown (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id   uuid NOT NULL REFERENCES public.periods(id) ON DELETE CASCADE,
  email       text NOT NULL,
  model_class text NOT NULL CHECK (model_class IN ('Opus', 'Sonnet', 'Haiku', 'Other')),
  spend_usd   numeric(12,6) NOT NULL DEFAULT 0,
  tokens      bigint NOT NULL DEFAULT 0,
  requests    integer NOT NULL DEFAULT 0,
  CONSTRAINT period_model_breakdown_unique UNIQUE (period_id, email, model_class)
);

CREATE INDEX IF NOT EXISTS pmb_period_id_idx ON public.period_model_breakdown (period_id);
CREATE INDEX IF NOT EXISTS pmb_email_idx     ON public.period_model_breakdown (email);

ALTER TABLE public.period_model_breakdown ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pmb_select_anon"          ON public.period_model_breakdown FOR SELECT TO anon          USING (true);
CREATE POLICY "pmb_insert_anon"          ON public.period_model_breakdown FOR INSERT TO anon          WITH CHECK (true);
CREATE POLICY "pmb_delete_anon"          ON public.period_model_breakdown FOR DELETE TO anon          USING (true);
CREATE POLICY "pmb_select_authenticated" ON public.period_model_breakdown FOR SELECT TO authenticated USING (true);
CREATE POLICY "pmb_insert_authenticated" ON public.period_model_breakdown FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "pmb_delete_authenticated" ON public.period_model_breakdown FOR DELETE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.period_product_breakdown (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id   uuid NOT NULL REFERENCES public.periods(id) ON DELETE CASCADE,
  email       text NOT NULL,
  product     text NOT NULL,
  spend_usd   numeric(12,6) NOT NULL DEFAULT 0,
  tokens      bigint NOT NULL DEFAULT 0,
  requests    integer NOT NULL DEFAULT 0,
  CONSTRAINT period_product_breakdown_unique UNIQUE (period_id, email, product)
);

CREATE INDEX IF NOT EXISTS ppb_period_id_idx ON public.period_product_breakdown (period_id);
CREATE INDEX IF NOT EXISTS ppb_email_idx     ON public.period_product_breakdown (email);

ALTER TABLE public.period_product_breakdown ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ppb_select_anon"          ON public.period_product_breakdown FOR SELECT TO anon          USING (true);
CREATE POLICY "ppb_insert_anon"          ON public.period_product_breakdown FOR INSERT TO anon          WITH CHECK (true);
CREATE POLICY "ppb_delete_anon"          ON public.period_product_breakdown FOR DELETE TO anon          USING (true);
CREATE POLICY "ppb_select_authenticated" ON public.period_product_breakdown FOR SELECT TO authenticated USING (true);
CREATE POLICY "ppb_insert_authenticated" ON public.period_product_breakdown FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ppb_delete_authenticated" ON public.period_product_breakdown FOR DELETE TO authenticated USING (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 4: add_seats_table
-- 8 current seats — replaces hardcoded USERS_MAP in index.html
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.seats (
  email           text PRIMARY KEY,
  display_name    text NOT NULL,
  entity          text NOT NULL CHECK (entity IN ('Frank Advisory', 'Frank Law')),
  seat_tier       text NOT NULL DEFAULT 'Standard' CHECK (seat_tier IN ('Standard', 'Premium')),
  spend_limit_aud numeric(10,2),   -- NULL = unlimited
  is_benchmark    boolean NOT NULL DEFAULT false,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE public.seats ENABLE ROW LEVEL SECURITY;

-- Read-only for anon (dashboard loads seat config on startup)
CREATE POLICY "seats_select_anon"          ON public.seats FOR SELECT TO anon          USING (true);
-- Full CRUD for authenticated (admin manages seats)
CREATE POLICY "seats_select_authenticated" ON public.seats FOR SELECT TO authenticated USING (true);
CREATE POLICY "seats_insert_authenticated" ON public.seats FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "seats_update_authenticated" ON public.seats FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "seats_delete_authenticated" ON public.seats FOR DELETE TO authenticated USING (true);

-- Seed the 8 current seats
INSERT INTO public.seats (email, display_name, entity, seat_tier, spend_limit_aud, is_benchmark) VALUES
  ('trowley@frankadvisory.com.au', 'Travis Rowley',  'Frank Advisory', 'Standard', NULL,   true),
  ('alex@frankadvisory.com.au',    'Alex',            'Frank Advisory', 'Premium',  NULL,   false),
  ('andrea@frankadvisory.com.au',  'Andrea',          'Frank Advisory', 'Standard', NULL,   false),
  ('rsharma@frankadvisory.com.au', 'Reginald Sharma', 'Frank Advisory', 'Standard', 190.00, false),
  ('tbrcic@franklaw.com.au',       'Tamara Brcic',    'Frank Law',      'Standard', 10.00,  false),
  ('bagar@franklaw.com.au',        'Bahar Agar',      'Frank Law',      'Standard', 20.00,  false),
  ('bwoodward@franklaw.com.au',    'Ben Woodward',    'Frank Law',      'Standard', NULL,   false),
  ('rlyons@franklaw.com.au',       'Rhys Lyons',      'Frank Law',      'Standard', 50.00,  false)
ON CONFLICT (email) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 5: add_data_quality_fixes (P2-D through P3-C)
-- ─────────────────────────────────────────────────────────────────────────────

-- P2-D: constrain uploads.file_type to 6 valid values
ALTER TABLE public.uploads
  ADD CONSTRAINT uploads_file_type_check
  CHECK (file_type IN ('anthropic-csv', 'code-csv', 'conversations', 'projects', 'memories', 'users'));

-- P2-E: Claude Code columns on period_users (Code spend/tokens dropped before this)
ALTER TABLE public.period_users
  ADD COLUMN IF NOT EXISTS code_spend_usd numeric(12,6),
  ADD COLUMN IF NOT EXISTS code_tokens     bigint;

-- P2-F: link uploads rows back to the period snapshot they informed
ALTER TABLE public.uploads
  ADD COLUMN IF NOT EXISTS period_id uuid REFERENCES public.periods(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS uploads_period_id_idx
  ON public.uploads (period_id) WHERE period_id IS NOT NULL;

-- P3-A: explicit precision on spend/score columns
ALTER TABLE public.period_users
  ALTER COLUMN total_spend_usd TYPE numeric(12,6),
  ALTER COLUMN opus_pct        TYPE numeric(5,2),
  ALTER COLUMN fluency_score   TYPE numeric(5,2);

-- P3-B: auto-update updated_at on app_settings changes
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- P3-C: file_size to bigint (convention for byte counts)
ALTER TABLE public.uploads ALTER COLUMN file_size TYPE bigint;


-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 6: add_initiatives_table (P3-D)
-- Row-level persistence for Module 7 initiatives (replaces app_settings JSONB blob)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.initiatives (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  owner         text,
  target_metric text,
  current_value text,
  status        text NOT NULL DEFAULT 'Planned'
                CHECK (status IN ('Planned', 'In Progress', 'Done', 'At Risk')),
  notes         text,
  sort_order    integer,
  -- these two fields map to the JS model: targetValue, lowerIsBetter
  target_value  numeric,
  lower_is_better boolean NOT NULL DEFAULT false,
  status_override text,
  updated_at    timestamptz DEFAULT now(),
  created_at    timestamptz DEFAULT now()
);

CREATE TRIGGER initiatives_updated_at
  BEFORE UPDATE ON public.initiatives
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.initiatives ENABLE ROW LEVEL SECURITY;

-- Full CRUD for both anon and authenticated (PIN-gated admin tab controls access in the UI)
CREATE POLICY "initiatives_select_anon"          ON public.initiatives FOR SELECT TO anon          USING (true);
CREATE POLICY "initiatives_insert_anon"          ON public.initiatives FOR INSERT TO anon          WITH CHECK (true);
CREATE POLICY "initiatives_update_anon"          ON public.initiatives FOR UPDATE TO anon          USING (true) WITH CHECK (true);
CREATE POLICY "initiatives_delete_anon"          ON public.initiatives FOR DELETE TO anon          USING (true);
CREATE POLICY "initiatives_select_authenticated" ON public.initiatives FOR SELECT TO authenticated USING (true);
CREATE POLICY "initiatives_insert_authenticated" ON public.initiatives FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "initiatives_update_authenticated" ON public.initiatives FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "initiatives_delete_authenticated" ON public.initiatives FOR DELETE TO authenticated USING (true);

-- Seed the 5 default initiatives (from DEFAULT_INITIATIVES in index.html)
INSERT INTO public.initiatives (name, owner, target_metric, target_value, lower_is_better, sort_order) VALUES
  ('Get all 8 seats active',             'Trav',        'active_users_count',    8,          false, 1),
  ('Frank Law onboarding',               'Trav',        'frank_law_adoption_pct',100,        false, 2),
  ('Sonnet as default model',            'AI Committee','org_opus_pct',          50,         true,  3),
  ('Average fluency score',              'AI Committee','avg_fluency_score',     60,         false, 4),
  ('Team token milestone (org AI depth)','Trav',        'total_tokens',          1000000000, false, 5)
ON CONFLICT DO NOTHING;
