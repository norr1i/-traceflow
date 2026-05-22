-- ============================================================
-- TraceFlow — Activity Logs Table
-- ============================================================
-- Records important user actions inside each company.
-- RLS ensures company isolation: users only ever see their
-- own company's activity.
--
-- HOW TO RUN
--   Supabase Dashboard → SQL Editor → New Query → paste → Run
--
-- Idempotent: safe to run multiple times.
-- ============================================================

-- ── Table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id            uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id    uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  actor_user_id uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email   text,
  action_type   text        NOT NULL,
  entity_type   text        NOT NULL,
  entity_id     text,
  message       text        NOT NULL,
  metadata      jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ── Index ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS activity_logs_company_created
  ON public.activity_logs (company_id, created_at DESC);

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activity_logs: select own company" ON public.activity_logs;
CREATE POLICY "activity_logs: select own company"
  ON public.activity_logs FOR SELECT
  USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "activity_logs: insert own company" ON public.activity_logs;
CREATE POLICY "activity_logs: insert own company"
  ON public.activity_logs FOR INSERT
  WITH CHECK (company_id = get_my_company_id());

-- No UPDATE or DELETE — activity logs are immutable.

DO $$
BEGIN
  RAISE NOTICE 'activity_logs table and RLS policies applied successfully.';
END $$;
