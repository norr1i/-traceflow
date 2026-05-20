-- ══════════════════════════════════════════════════════════════════════════════
-- TraceFlow — Backfill company_id on all existing rows
--
-- Run this after supabase_multitenancy_v2.sql if dashboard data is blank.
-- The RLS policy filters out any row where company_id IS NULL, so rows
-- inserted via SQL editor (where auth.uid() returns NULL) need to be
-- assigned to your company explicitly.
--
-- Safe: only touches rows with company_id IS NULL. No deletes.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Step 1: Diagnostic — run this first to see the current state ──────────────

SELECT
  'companies'        AS tbl, COUNT(*) AS total, NULL::bigint AS null_company FROM companies
UNION ALL
SELECT 'user_profiles',  COUNT(*), COUNT(*) FILTER (WHERE company_id IS NULL) FROM user_profiles
UNION ALL
SELECT 'products',       COUNT(*), COUNT(*) FILTER (WHERE company_id IS NULL) FROM products
UNION ALL
SELECT 'suppliers',      COUNT(*), COUNT(*) FILTER (WHERE company_id IS NULL) FROM suppliers
UNION ALL
SELECT 'raw_materials',  COUNT(*), COUNT(*) FILTER (WHERE company_id IS NULL) FROM raw_materials
UNION ALL
SELECT 'production_orders', COUNT(*), COUNT(*) FILTER (WHERE company_id IS NULL) FROM production_orders
UNION ALL
SELECT 'sales',          COUNT(*), COUNT(*) FILTER (WHERE company_id IS NULL) FROM sales
UNION ALL
SELECT 'quality_inspections', COUNT(*), COUNT(*) FILTER (WHERE company_id IS NULL) FROM quality_inspections
UNION ALL
SELECT 'quality_defects', COUNT(*), COUNT(*) FILTER (WHERE company_id IS NULL) FROM quality_defects;

-- ── Step 2: Backfill — assigns all NULL company_id rows to your company ────────
-- Uses LIMIT 1 on companies so it always picks the one company in the DB.
-- On re-run: WHERE company_id IS NULL means already-linked rows are untouched.

DO $$
DECLARE
  target uuid;
  n      int;
BEGIN
  -- Find the company (only one exists in a fresh single-tenant setup)
  SELECT id INTO target FROM companies ORDER BY created_at LIMIT 1;

  IF target IS NULL THEN
    RAISE EXCEPTION
      'No company found. Run supabase_multitenancy_v2.sql first to create the companies table.';
  END IF;

  RAISE NOTICE 'Backfilling to company_id = %', target;

  UPDATE products SET company_id = target WHERE company_id IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'products: % rows updated', n;

  UPDATE suppliers SET company_id = target WHERE company_id IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'suppliers: % rows updated', n;

  UPDATE raw_materials SET company_id = target WHERE company_id IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'raw_materials: % rows updated', n;

  UPDATE production_orders SET company_id = target WHERE company_id IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'production_orders: % rows updated', n;

  UPDATE sales SET company_id = target WHERE company_id IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'sales: % rows updated', n;

  UPDATE quality_inspections SET company_id = target WHERE company_id IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'quality_inspections: % rows updated', n;

  UPDATE quality_defects SET company_id = target WHERE company_id IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'quality_defects: % rows updated', n;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bill_of_materials' AND table_schema = 'public') THEN
    UPDATE bill_of_materials SET company_id = target WHERE company_id IS NULL;
    GET DIAGNOSTICS n = ROW_COUNT;
    RAISE NOTICE 'bill_of_materials: % rows updated', n;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'batch_qc_results' AND table_schema = 'public') THEN
    UPDATE batch_qc_results SET company_id = target WHERE company_id IS NULL;
    GET DIAGNOSTICS n = ROW_COUNT;
    RAISE NOTICE 'batch_qc_results: % rows updated', n;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scan_events' AND table_schema = 'public') THEN
    UPDATE scan_events SET company_id = target WHERE company_id IS NULL;
    GET DIAGNOSTICS n = ROW_COUNT;
    RAISE NOTICE 'scan_events: % rows updated', n;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'batch_lineage' AND table_schema = 'public') THEN
    UPDATE batch_lineage SET company_id = target WHERE company_id IS NULL;
    GET DIAGNOSTICS n = ROW_COUNT;
    RAISE NOTICE 'batch_lineage: % rows updated', n;
  END IF;

  -- Also ensure user_profiles itself is linked (edge case: orphaned profiles)
  UPDATE user_profiles SET company_id = target WHERE company_id IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'user_profiles: % rows updated', n;

  RAISE NOTICE '=== Backfill complete. Company: % ===', target;
END;
$$;

-- ── Step 3: Verify — re-run the diagnostic to confirm zeros in null_company ───

SELECT
  'user_profiles'    AS tbl, COUNT(*) AS total, COUNT(*) FILTER (WHERE company_id IS NULL) AS null_company FROM user_profiles
UNION ALL
SELECT 'products',       COUNT(*), COUNT(*) FILTER (WHERE company_id IS NULL) FROM products
UNION ALL
SELECT 'suppliers',      COUNT(*), COUNT(*) FILTER (WHERE company_id IS NULL) FROM suppliers
UNION ALL
SELECT 'raw_materials',  COUNT(*), COUNT(*) FILTER (WHERE company_id IS NULL) FROM raw_materials
UNION ALL
SELECT 'production_orders', COUNT(*), COUNT(*) FILTER (WHERE company_id IS NULL) FROM production_orders
UNION ALL
SELECT 'sales',          COUNT(*), COUNT(*) FILTER (WHERE company_id IS NULL) FROM sales
UNION ALL
SELECT 'quality_inspections', COUNT(*), COUNT(*) FILTER (WHERE company_id IS NULL) FROM quality_inspections
UNION ALL
SELECT 'quality_defects', COUNT(*), COUNT(*) FILTER (WHERE company_id IS NULL) FROM quality_defects;
-- All null_company values should be 0 after the backfill.
