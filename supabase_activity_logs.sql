-- ============================================================
-- TraceFlow — Activity Logs Table
-- ============================================================
-- Records important user actions inside each company.
-- RLS ensures company isolation: users only ever see their
-- own company's activity.
--
-- HOW TO RUN
--   Supabase Dashboard → SQL Editor → New Query → paste → Run
-- ============================================================

-- ── Table ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id            uuid         PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id    uuid         NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  actor_user_id uuid         REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email   text,
  action_type   text         NOT NULL,  -- e.g. 'production_order.created'
  entity_type   text         NOT NULL,  -- e.g. 'production_order'
  entity_id     text,                   -- UUID or other identifier
  message       text         NOT NULL,  -- human-readable log line
  metadata      jsonb,                  -- optional structured extras
  created_at    timestamptz  NOT NULL DEFAULT now()
);

-- ── Index ────────────────────────────────────────────────────────────────────
-- Dashboard queries always order by created_at DESC scoped to company_id.
CREATE INDEX IF NOT EXISTS activity_logs_company_created
  ON public.activity_logs (company_id, created_at DESC);

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Users may read logs from their own company only.
CREATE POLICY "activity_logs: select own company"
  ON public.activity_logs FOR SELECT
  USING (company_id = get_my_company_id());

-- Users may insert logs for their own company only.
CREATE POLICY "activity_logs: insert own company"
  ON public.activity_logs FOR INSERT
  WITH CHECK (company_id = get_my_company_id());

-- No UPDATE or DELETE — activity logs are immutable.

RAISE NOTICE 'activity_logs table and RLS policies created successfully.';
