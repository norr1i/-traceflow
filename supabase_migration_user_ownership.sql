-- ================================================================
-- TraceFlow – User Ownership Migration
-- Run in the Supabase SQL Editor (postgres / service-role context).
--
-- REQUIRED BEFORE RUNNING:
--   Replace the placeholder UUID on line 16 with the ID of the user
--   who should inherit all pre-existing rows.
--   Find it in: Supabase Dashboard → Authentication → Users → copy UID.
-- ================================================================

-- ── 0. Enable RLS on every table (idempotent) ────────────────────
ALTER TABLE public.products            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_materials       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_orders   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bom_usage           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qc_results          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_defects     ENABLE ROW LEVEL SECURITY;

-- ── 1. Add user_id to main tables (idempotent) ───────────────────
-- DEFAULT auth.uid() means every new INSERT from an authenticated
-- client is stamped automatically — no application code changes needed.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS user_id UUID
    DEFAULT auth.uid()
    REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS user_id UUID
    DEFAULT auth.uid()
    REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.raw_materials
  ADD COLUMN IF NOT EXISTS user_id UUID
    DEFAULT auth.uid()
    REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.production_orders
  ADD COLUMN IF NOT EXISTS user_id UUID
    DEFAULT auth.uid()
    REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS user_id UUID
    DEFAULT auth.uid()
    REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.quality_inspections
  ADD COLUMN IF NOT EXISTS user_id UUID
    DEFAULT auth.uid()
    REFERENCES auth.users(id) ON DELETE CASCADE;

-- ── 2. Backfill existing rows → assign to the nominated owner ────
-- Rows inserted before auth was set up have user_id = NULL and would
-- be invisible once RLS policies go live. This block assigns them to
-- a real user so they remain accessible.
--
-- !! Change the UUID inside this block to your real user ID !!
DO $$
DECLARE
  v_owner UUID := '00000000-0000-0000-0000-000000000000';
BEGIN
  -- Guard: refuse to run with the placeholder UUID
  IF v_owner = '00000000-0000-0000-0000-000000000000' THEN
    RAISE EXCEPTION
      'Replace the placeholder UUID in the backfill block with your real user ID before running.';
  END IF;

  -- Guard: refuse to run if the user does not exist
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_owner) THEN
    RAISE EXCEPTION
      'User % was not found in auth.users. Verify the UUID and retry.', v_owner;
  END IF;

  -- Only touches orphaned rows; already-owned rows are untouched
  UPDATE public.products            SET user_id = v_owner WHERE user_id IS NULL;
  UPDATE public.suppliers           SET user_id = v_owner WHERE user_id IS NULL;
  UPDATE public.raw_materials       SET user_id = v_owner WHERE user_id IS NULL;
  UPDATE public.production_orders   SET user_id = v_owner WHERE user_id IS NULL;
  UPDATE public.sales               SET user_id = v_owner WHERE user_id IS NULL;
  UPDATE public.quality_inspections SET user_id = v_owner WHERE user_id IS NULL;
END $$;

-- ── 3. Drop ALL existing policies (comprehensive) ─────────────────
-- Iterates pg_policies so it catches any policy name, not just known ones.
DO $$
DECLARE
  tbl TEXT;
  pol TEXT;
BEGIN
  FOR tbl IN VALUES
    ('products'), ('suppliers'), ('raw_materials'), ('production_orders'),
    ('bom_usage'), ('qc_results'), ('sales'), ('quality_inspections'), ('quality_defects')
  LOOP
    FOR pol IN
      SELECT policyname
      FROM   pg_policies
      WHERE  schemaname = 'public' AND tablename = tbl
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol, tbl);
    END LOOP;
  END LOOP;
END $$;

-- ── 4. RLS policies: main tables ─────────────────────────────────
-- Each authenticated user sees and mutates only their own rows.

CREATE POLICY "users_own_products" ON public.products
  FOR ALL TO authenticated
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_own_suppliers" ON public.suppliers
  FOR ALL TO authenticated
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_own_raw_materials" ON public.raw_materials
  FOR ALL TO authenticated
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_own_production_orders" ON public.production_orders
  FOR ALL TO authenticated
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_own_sales" ON public.sales
  FOR ALL TO authenticated
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_own_quality_inspections" ON public.quality_inspections
  FOR ALL TO authenticated
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 5. RLS policies: child tables ────────────────────────────────
-- These tables have no user_id column; ownership is inherited through
-- their parent foreign key via an EXISTS subquery.

-- bom_usage → production_orders
CREATE POLICY "users_own_bom_usage" ON public.bom_usage
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.production_orders po
      WHERE  po.id      = bom_usage.production_order_id
        AND  po.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.production_orders po
      WHERE  po.id      = bom_usage.production_order_id
        AND  po.user_id = auth.uid()
    )
  );

-- qc_results → production_orders
CREATE POLICY "users_own_qc_results" ON public.qc_results
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.production_orders po
      WHERE  po.id      = qc_results.production_order_id
        AND  po.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.production_orders po
      WHERE  po.id      = qc_results.production_order_id
        AND  po.user_id = auth.uid()
    )
  );

-- quality_defects → quality_inspections
CREATE POLICY "users_own_quality_defects" ON public.quality_defects
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quality_inspections qi
      WHERE  qi.id      = quality_defects.inspection_id
        AND  qi.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quality_inspections qi
      WHERE  qi.id      = quality_defects.inspection_id
        AND  qi.user_id = auth.uid()
    )
  );

-- ── 6. Verification (run after the above to confirm) ─────────────
SELECT
  tablename,
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
