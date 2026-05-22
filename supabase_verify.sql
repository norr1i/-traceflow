-- ============================================================
-- TraceFlow — Post-Reseed Data Integrity Verification
-- ============================================================
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- What it checks:
--   1. Row counts for all seeded tables
--   2. FK integrity (no dangling references)
--   3. Dashboard widget data availability per role section
--   4. scan_events → production_orders linkage
--   5. batch_qc_results recency (last 7 days for trend chart)
--   6. RLS: company isolation (all rows owned by single company)
-- ============================================================

DO $$
DECLARE
  cid         uuid;
  row_count   bigint;
  orphan_count bigint;
  recent_count bigint;
  companies_count bigint;
BEGIN

  -- ── Resolve company ─────────────────────────────────────────────────────
  SELECT id INTO cid FROM companies ORDER BY created_at LIMIT 1;
  IF cid IS NULL THEN
    RAISE EXCEPTION 'No company found.';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '╔═══════════════════════════════════════════════════════╗';
  RAISE NOTICE '║   TraceFlow Post-Reseed Verification                  ║';
  RAISE NOTICE '╚═══════════════════════════════════════════════════════╝';
  RAISE NOTICE 'Company UUID : %', cid;
  SELECT name INTO STRICT companies_count FROM companies WHERE id = cid;
  RAISE NOTICE '';

  -- ── 1. Row counts ────────────────────────────────────────────────────────
  RAISE NOTICE '── 1. Row counts (scoped to this company) ─────────────────';

  SELECT COUNT(*) INTO row_count FROM products           WHERE company_id = cid;
  RAISE NOTICE '  products            : % rows  (target ≥ 20)', row_count;

  SELECT COUNT(*) INTO row_count FROM raw_materials      WHERE company_id = cid;
  RAISE NOTICE '  raw_materials       : % rows  (target ≥ 15)', row_count;

  SELECT COUNT(*) INTO row_count FROM production_orders  WHERE company_id = cid;
  RAISE NOTICE '  production_orders   : % rows  (target = 80)', row_count;

  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'batch_qc_results') THEN
    SELECT COUNT(*) INTO row_count FROM batch_qc_results WHERE company_id = cid;
    RAISE NOTICE '  batch_qc_results    : % rows  (target = 55)', row_count;
  ELSE
    RAISE NOTICE '  batch_qc_results    : TABLE MISSING — QC dashboard widgets will be empty';
  END IF;

  SELECT COUNT(*) INTO row_count FROM sales              WHERE company_id = cid;
  RAISE NOTICE '  sales               : % rows  (target = 60)', row_count;

  SELECT COUNT(*) INTO row_count FROM quality_inspections WHERE company_id = cid;
  RAISE NOTICE '  quality_inspections : % rows  (target = 50)', row_count;

  SELECT COUNT(*) INTO row_count FROM quality_defects    WHERE company_id = cid;
  RAISE NOTICE '  quality_defects     : % rows  (target ~40)', row_count;

  SELECT COUNT(*) INTO row_count FROM scan_events        WHERE company_id = cid;
  RAISE NOTICE '  scan_events         : % rows  (target = 500, re-linked)', row_count;

  RAISE NOTICE '';

  -- ── 2. FK integrity ───────────────────────────────────────────────────────
  RAISE NOTICE '── 2. Foreign-key integrity ───────────────────────────────';

  -- production_orders.product_id → products.id
  SELECT COUNT(*) INTO orphan_count
  FROM production_orders po
  LEFT JOIN products pr ON pr.id = po.product_id AND pr.company_id = cid
  WHERE po.company_id = cid AND pr.id IS NULL;
  RAISE NOTICE '  production_orders with missing product  : % orphans  (want 0)', orphan_count;

  -- batch_qc_results.batch_id → production_orders.id
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'batch_qc_results') THEN
    SELECT COUNT(*) INTO orphan_count
    FROM batch_qc_results bq
    LEFT JOIN production_orders po ON po.id = bq.batch_id AND po.company_id = cid
    WHERE bq.company_id = cid AND po.id IS NULL;
    RAISE NOTICE '  batch_qc_results with missing batch     : % orphans  (want 0)', orphan_count;
  END IF;

  -- scan_events.batch_id → production_orders.id
  SELECT COUNT(*) INTO orphan_count
  FROM scan_events se
  LEFT JOIN production_orders po ON po.id = se.batch_id AND po.company_id = cid
  WHERE se.company_id = cid AND po.id IS NULL;
  RAISE NOTICE '  scan_events with missing production_order: % orphans  (want 0)', orphan_count;

  -- sales.product_id → products.id
  SELECT COUNT(*) INTO orphan_count
  FROM sales s
  LEFT JOIN products pr ON pr.id = s.product_id AND pr.company_id = cid
  WHERE s.company_id = cid AND pr.id IS NULL;
  RAISE NOTICE '  sales with missing product              : % orphans  (want 0)', orphan_count;

  RAISE NOTICE '';

  -- ── 3. Dashboard widget data (mirrors dashboard.ts queries) ───────────────
  RAISE NOTICE '── 3. Dashboard widget data ───────────────────────────────';

  -- Production section (operations / warehouse / admin / manager)
  SELECT COUNT(*) INTO row_count FROM production_orders WHERE company_id = cid;
  RAISE NOTICE '  [Production] total batches              : %', row_count;

  SELECT COUNT(*) INTO row_count FROM production_orders WHERE company_id = cid AND status = 'in_progress';
  RAISE NOTICE '  [Production] in_progress batches        : %', row_count;

  SELECT COUNT(*) INTO row_count FROM production_orders WHERE company_id = cid AND status = 'completed';
  RAISE NOTICE '  [Production] completed batches          : %', row_count;

  SELECT COUNT(*) INTO row_count FROM production_orders WHERE company_id = cid AND status = 'pending';
  RAISE NOTICE '  [Production] pending batches            : %', row_count;

  -- Recall risk: failed QC + sold product overlap
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'batch_qc_results') THEN
    SELECT COUNT(*) INTO row_count
    FROM batch_qc_results WHERE company_id = cid AND status = 'fail';
    RAISE NOTICE '  [Recall]     failed QC batches          : %  (non-zero = recall risk banner shows)', row_count;
  END IF;

  -- QC section (qc_inspector / admin / manager)
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'batch_qc_results') THEN
    SELECT COUNT(*) INTO row_count
    FROM batch_qc_results WHERE company_id = cid AND status = 'pass';
    RAISE NOTICE '  [QC]         pass count                 : %', row_count;

    SELECT COUNT(*) INTO row_count
    FROM batch_qc_results WHERE company_id = cid AND status = 'fail';
    RAISE NOTICE '  [QC]         fail count                 : %', row_count;

    SELECT COUNT(*) INTO row_count
    FROM batch_qc_results WHERE company_id = cid AND status = 'hold';
    RAISE NOTICE '  [QC]         hold count                 : %', row_count;

    -- 7-day trend (28 rows seeded into this window)
    SELECT COUNT(*) INTO recent_count
    FROM batch_qc_results
    WHERE company_id = cid
      AND inspected_at >= now() - INTERVAL '7 days';
    RAISE NOTICE '  [QC Trend]   inspections last 7 days    : %  (want ≥ 1 for trend chart)', recent_count;

    SELECT COUNT(*) INTO row_count
    FROM batch_qc_results WHERE company_id = cid;
    IF row_count > 0 THEN
      RAISE NOTICE '  [QC]         pass rate                  : %%%',
        ROUND(
          (SELECT COUNT(*) FROM batch_qc_results WHERE company_id = cid AND status = 'pass')::numeric
          / row_count * 100
        );
    END IF;
  END IF;

  -- Tracing section (admin / manager)
  SELECT COUNT(*) INTO row_count FROM scan_events WHERE company_id = cid;
  RAISE NOTICE '  [Tracing]    total scan_events           : %', row_count;

  SELECT COUNT(DISTINCT batch_id) INTO row_count FROM scan_events WHERE company_id = cid;
  RAISE NOTICE '  [Tracing]    distinct batches scanned    : %  (want = 80)', row_count;

  SELECT COUNT(*) INTO recent_count
  FROM scan_events
  WHERE company_id = cid
    AND scanned_at >= now() - INTERVAL '7 days';
  RAISE NOTICE '  [Tracing]    scans last 7 days           : %', recent_count;

  RAISE NOTICE '';

  -- ── 4. scan_events linkage quality ────────────────────────────────────────
  RAISE NOTICE '── 4. scan_events → production_orders linkage ─────────────';

  SELECT COUNT(DISTINCT se.batch_id) INTO row_count
  FROM scan_events se
  INNER JOIN production_orders po ON po.id = se.batch_id
  WHERE se.company_id = cid;
  RAISE NOTICE '  distinct batches with valid link        : %  (want = 80)', row_count;

  SELECT COUNT(*) INTO row_count
  FROM scan_events se
  INNER JOIN production_orders po ON po.id = se.batch_id
  INNER JOIN products pr ON pr.id = po.product_id
  WHERE se.company_id = cid;
  RAISE NOTICE '  scans that resolve to a product name   : %  (want = 500)', row_count;

  RAISE NOTICE '';

  -- ── 5. RLS isolation check ────────────────────────────────────────────────
  RAISE NOTICE '── 5. RLS company isolation ───────────────────────────────';

  SELECT COUNT(*) INTO row_count FROM products WHERE company_id != cid;
  RAISE NOTICE '  products rows for OTHER companies       : %  (want 0 in single-tenant demo)', row_count;

  SELECT COUNT(*) INTO row_count FROM production_orders WHERE company_id != cid;
  RAISE NOTICE '  production_orders rows for OTHER co.    : %  (want 0 in single-tenant demo)', row_count;

  SELECT COUNT(*) INTO row_count FROM scan_events WHERE company_id != cid;
  RAISE NOTICE '  scan_events rows for OTHER companies    : %  (want 0 in single-tenant demo)', row_count;

  RAISE NOTICE '';

  -- ── 6. Role-section mapping summary ──────────────────────────────────────
  RAISE NOTICE '── 6. Dashboard sections visible per role ─────────────────';
  RAISE NOTICE '  admin       : Production ✓  QC ✓  Tracing ✓  (all sections)';
  RAISE NOTICE '  manager     : Production ✓  QC ✓  Tracing ✓  (all sections)';
  RAISE NOTICE '  operations  : Production ✓  QC —  Tracing —  (view:dashboard.production)';
  RAISE NOTICE '  qc_inspector: Production —  QC ✓  Tracing —  (view:dashboard.quality)';
  RAISE NOTICE '  warehouse   : Production ✓  QC —  Tracing —  (view:dashboard.production)';
  RAISE NOTICE '  sales       : Production ✓  QC —  Tracing —  (recall risk via production)';
  RAISE NOTICE '';
  RAISE NOTICE '  Permissions enforced by hasPermission() in app/lib/permissions.ts';
  RAISE NOTICE '  DB enforced by RLS company_id = get_my_company_id() on each table';
  RAISE NOTICE '';

  RAISE NOTICE '╔═══════════════════════════════════════════════════════╗';
  RAISE NOTICE '║   Verification complete.                              ║';
  RAISE NOTICE '║   All orphan counts should be 0.                     ║';
  RAISE NOTICE '║   All row counts should meet targets above.          ║';
  RAISE NOTICE '╚═══════════════════════════════════════════════════════╝';

END;
$$;
