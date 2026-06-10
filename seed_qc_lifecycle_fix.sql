-- ============================================================
-- TraceFlow — QC Lifecycle Fix
-- ============================================================
-- PURPOSE
--   Corrects QC records whose timestamps predate the production
--   completion they are supposed to follow. This can occur when:
--     • QC is recorded the same day as production order creation
--     • Data is entered out of order through the UI
--     • Seed runs used approximate timestamps
--
-- RULES ENFORCED
--   1. batch_qc_results.inspected_at must be > production_orders.completed_at
--      Fix: pin to completed_at + 1 hour
--   2. quality_inspections.inspection_date must be > production_orders.completed_at
--      Fix: pin to completed_at + 1 day
--   3. Both rules only apply when production_orders.completed_at IS NOT NULL
--      (in-progress batches have no QC results at all after this fix — handled
--      client-side by enforceLifecycleOrder)
--
-- HOW TO RUN
--   Supabase Dashboard → SQL Editor → New Query → paste → Run
--   Safe to run multiple times (UPDATE WHERE is idempotent).
-- ============================================================

-- 1. Fix batch_qc_results: pin any result whose inspected_at ≤ completed_at
UPDATE batch_qc_results bqr
SET
  inspected_at = po.completed_at + interval '1 hour',
  created_at   = LEAST(bqr.created_at, po.completed_at + interval '1 hour')
FROM production_orders po
WHERE bqr.batch_id    = po.id
  AND po.completed_at IS NOT NULL
  AND bqr.inspected_at <= po.completed_at;

-- 2. Fix quality_inspections: pin any result whose inspection_date ≤ completed_at date
UPDATE quality_inspections qi
SET
  inspection_date = (po.completed_at + interval '1 day')::date,
  updated_at      = po.completed_at + interval '1 day'
FROM production_orders po
WHERE qi.batch_id                       = po.id::text
  AND po.completed_at                   IS NOT NULL
  AND qi.inspection_date::timestamptz   <= po.completed_at;

-- Report how many rows were affected
DO $$
DECLARE
  n1 int;
  n2 int;
BEGIN
  SELECT COUNT(*) INTO n1
  FROM batch_qc_results bqr
  JOIN production_orders po ON bqr.batch_id = po.id
  WHERE po.completed_at IS NOT NULL
    AND bqr.inspected_at > po.completed_at;

  SELECT COUNT(*) INTO n2
  FROM quality_inspections qi
  JOIN production_orders po ON qi.batch_id = po.id::text
  WHERE po.completed_at IS NOT NULL
    AND qi.inspection_date::timestamptz > po.completed_at;

  RAISE NOTICE 'QC lifecycle fix complete.';
  RAISE NOTICE '  batch_qc_results with valid timestamps after fix: %', n1;
  RAISE NOTICE '  quality_inspections with valid dates after fix: %', n2;
END;
$$;
