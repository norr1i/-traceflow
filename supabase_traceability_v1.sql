-- ============================================================
-- TraceFlow — Phase 1A: Traceability Engine Foundation
-- File: supabase_traceability_v1.sql
-- ============================================================
--
-- Creates:
--   1. batch_journey_events  — lifecycle event log per batch
--   2. raw_material_lots     — formal lot/batch records for raw materials
--
-- Augments (additive only):
--   3. bill_of_materials     — adds nullable raw_material_lot_id FK
--
-- SAFETY GUARANTEES
--   • Fully additive. No existing row is modified or deleted.
--   • All CREATE TABLE statements use IF NOT EXISTS.
--   • The bill_of_materials augmentation uses ADD COLUMN IF NOT EXISTS
--     with a nullable column — all existing rows remain unchanged.
--   • RLS follows the exact existing pattern:
--       USING (company_id = get_my_company_id())
--   • DEFAULT get_my_company_id() on company_id so callers never need
--     to supply it explicitly, matching every other business table.
--   • Idempotent: safe to run multiple times without side effects.
--
-- PREREQUISITES (must exist before running)
--   • Tables:   companies, production_orders, raw_materials, suppliers,
--               bill_of_materials
--   • Function: get_my_company_id()
--   • Function: set_updated_at()   (defined in supabase_schema.sql)
--   • Extension: uuid-ossp         (enabled in supabase_schema.sql)
--
-- HOW TO RUN
--   Supabase Dashboard → SQL Editor → New Query → paste → Run
-- ============================================================


-- ── 0. Prerequisite guard ────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'companies'
  ) THEN
    RAISE EXCEPTION
      'companies table not found — run multitenancy migrations first.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'production_orders'
  ) THEN
    RAISE EXCEPTION 'production_orders table not found.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'raw_materials'
  ) THEN
    RAISE EXCEPTION 'raw_materials table not found.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public'
      AND routine_name   = 'get_my_company_id'
  ) THEN
    RAISE EXCEPTION
      'get_my_company_id() not found — run multitenancy migrations first.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public'
      AND routine_name   = 'set_updated_at'
  ) THEN
    RAISE EXCEPTION
      'set_updated_at() not found — run supabase_schema.sql first.';
  END IF;

  RAISE NOTICE 'Prerequisites verified — proceeding with Phase 1A migration.';
END;
$$;


-- ════════════════════════════════════════════════════════════
-- TABLE 1: batch_journey_events
-- ════════════════════════════════════════════════════════════
--
-- Purpose
--   Append-only event log for lifecycle events that are NOT
--   already captured by a dedicated domain table.
--
--   This table closes the gaps in the existing event record.
--   The get_batch_journey RPC (Phase 1B) will synthesise a
--   complete timeline by UNION-ing this table with:
--     production_orders   (created_at, started_at, completed_at)
--     batch_qc_results    (inspected_at)
--     quality_inspections (inspection_date)
--     scan_events         (scanned_at)
--     distribution_records(shipped_at)
--
--   Write targets — events that belong in this table:
--     raw_material.received        raw_material.qc_passed
--     raw_material.qc_failed       material.added_to_inventory
--     packaging.completed          storage.entry
--     supplier.approved            capa.created
--     distributor.received         market.delivered
--
--   Do NOT duplicate events already recorded elsewhere:
--     production.order_created  → production_orders.created_at
--     production.started        → production_orders.started_at
--     production.completed      → production_orders.completed_at
--     qc.*                      → batch_qc_results / quality_inspections
--     qr.scan                   → scan_events
--     distribution.shipped      → distribution_records
--
-- Immutability
--   Rows are never updated or deleted. No UPDATE/DELETE RLS
--   policies are created. Historical accuracy requires this.
--
-- Columns
--   batch_id        UUID FK → production_orders.id
--                   production_orders.id is the canonical batch
--                   identifier throughout TraceFlow.
--   event_type      Free-text vocabulary (see Write targets above).
--                   No CHECK constraint — vocabulary grows over time
--                   and is enforced at the application layer.
--   event_timestamp The real-world time the event occurred.
--                   Distinct from created_at (write time).
--   actor_user_id   FK → auth.users. Nullable: some events are
--                   system-generated with no human actor.
--   actor_email     Denormalised for fast display without a JOIN.
--   entity_type     What kind of entity triggered this event.
--                   e.g. 'raw_material', 'supplier', 'shipment'
--   entity_id       UUID of that entity. Nullable; type varies.
--   metadata        JSONB payload for event-specific fields.
--                   e.g. { "lot_number": "LOT-42", "quantity": 50 }
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.batch_journey_events (
  id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id      uuid        NOT NULL
                                REFERENCES public.companies(id)
                                ON DELETE CASCADE,
  batch_id        uuid        NOT NULL
                                REFERENCES public.production_orders(id)
                                ON DELETE CASCADE,
  event_type      text        NOT NULL,
  event_timestamp timestamptz NOT NULL DEFAULT now(),
  actor_user_id   uuid        REFERENCES auth.users(id)
                                ON DELETE SET NULL,
  actor_email     text,
  entity_type     text,
  entity_id       uuid,
  metadata        jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- company_id auto-populated from the inserting user's session.
ALTER TABLE public.batch_journey_events
  ALTER COLUMN company_id SET DEFAULT get_my_company_id();

COMMENT ON TABLE  public.batch_journey_events                IS
  'Append-only lifecycle events for production batches not captured by other domain tables.';
COMMENT ON COLUMN public.batch_journey_events.event_timestamp IS
  'Real-world time the event occurred; may differ from created_at if back-dated.';
COMMENT ON COLUMN public.batch_journey_events.entity_id      IS
  'UUID of the related entity (type varies by event_type). Nullable.';
COMMENT ON COLUMN public.batch_journey_events.metadata       IS
  'Event-specific payload. Schema varies by event_type.';

-- ── Indexes: batch_journey_events ────────────────────────────

-- Primary: fetch all events for one batch in timeline order.
CREATE INDEX IF NOT EXISTS bje_batch_timeline
  ON public.batch_journey_events (company_id, batch_id, event_timestamp DESC);

-- Recall / compliance: find all events of a specific type.
CREATE INDEX IF NOT EXISTS bje_event_type
  ON public.batch_journey_events (company_id, event_type, event_timestamp DESC);

-- Feed: most recent events across the company (dashboard, notifications).
CREATE INDEX IF NOT EXISTS bje_company_recent
  ON public.batch_journey_events (company_id, event_timestamp DESC);

-- Entity lookup: find all events referencing a specific entity
-- (e.g. all batches that used a particular supplier or lot).
CREATE INDEX IF NOT EXISTS bje_entity
  ON public.batch_journey_events (company_id, entity_type, entity_id)
  WHERE entity_id IS NOT NULL;

-- ── RLS: batch_journey_events ─────────────────────────────────
ALTER TABLE public.batch_journey_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bje: select own company" ON public.batch_journey_events;
CREATE POLICY "bje: select own company"
  ON public.batch_journey_events
  FOR SELECT TO authenticated
  USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "bje: insert own company" ON public.batch_journey_events;
CREATE POLICY "bje: insert own company"
  ON public.batch_journey_events
  FOR INSERT TO authenticated
  WITH CHECK (company_id = get_my_company_id());

-- No UPDATE or DELETE policies — events are immutable records.


-- ════════════════════════════════════════════════════════════
-- TABLE 2: raw_material_lots
-- ════════════════════════════════════════════════════════════
--
-- Purpose
--   First-class lot record for every discrete delivery of a
--   raw material. Each row represents a single receipt event:
--   a specific lot number, quantity, supplier, and date.
--
--   Before this table, lot numbers were only captured as
--   free-text in bill_of_materials.lot_number — a string with
--   no entity, no history, no forward/backward traversal.
--   This table gives each lot an identity and a lifecycle.
--
--   Enables:
--     • Forward trace: "Which production batches used lot X?"
--       → bill_of_materials WHERE raw_material_lot_id = lot.id
--     • Backward trace: "What lots went into batch Y?"
--       → bill_of_materials WHERE production_order_id = batch.id
--         JOIN raw_material_lots
--     • Recall scope: "Quarantine all batches using lot X"
--     • Expiry: auto-flag lots past expiry_date
--     • Supplier audit: all lots received from supplier Z
--
-- Status lifecycle
--   available  →  quarantine   (QC hold, pending investigation)
--             →  consumed     (fully used in production)
--             →  rejected     (failed incoming QC, disposed)
--             →  expired      (past expiry_date)
--   quarantine →  available   (hold lifted)
--             →  rejected     (confirmed failed)
--
-- Uniqueness constraint
--   (company_id, raw_material_id, lot_number) must be unique.
--   The same lot number can exist for different materials
--   (e.g. "LOT-001" for both Steel Rod and Aluminium Sheet)
--   but not twice for the same material within one company.
--
-- Relationship to bill_of_materials
--   bill_of_materials.raw_material_lot_id (added in section 3)
--   provides the bidirectional FK link. It is nullable: existing
--   BOM rows without a lot entity are unaffected.
--
-- Columns
--   raw_material_id   FK → raw_materials.id. Identifies the
--                     material this lot is an instance of.
--   lot_number        Supplier-assigned lot/batch identifier.
--   quantity          Amount received in this delivery.
--   unit              Unit of measure (matches raw_materials.unit).
--   supplier_id       FK → suppliers.id. Nullable: unknown supplier.
--   received_at       Timestamp of physical receipt.
--   expiry_date       Optional expiry / best-before date.
--   status            Lifecycle state (see Status lifecycle above).
--   notes             Free-text for QC notes, quarantine reasons, etc.
--   updated_at        Auto-updated by set_updated_at() trigger.
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.raw_material_lots (
  id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id      uuid        NOT NULL
                                REFERENCES public.companies(id)
                                ON DELETE CASCADE,
  raw_material_id uuid        NOT NULL
                                REFERENCES public.raw_materials(id)
                                ON DELETE RESTRICT,
  lot_number      text        NOT NULL,
  quantity        numeric     NOT NULL DEFAULT 0
                                CHECK (quantity >= 0),
  unit            text        NOT NULL,
  supplier_id     uuid        REFERENCES public.suppliers(id)
                                ON DELETE SET NULL,
  received_at     timestamptz NOT NULL DEFAULT now(),
  expiry_date     date,
  status          text        NOT NULL DEFAULT 'available'
                    CHECK (status IN (
                      'available', 'quarantine', 'consumed',
                      'rejected',  'expired'
                    )),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE (company_id, raw_material_id, lot_number)
);

ALTER TABLE public.raw_material_lots
  ALTER COLUMN company_id SET DEFAULT get_my_company_id();

COMMENT ON TABLE  public.raw_material_lots              IS
  'First-class lot records for raw material receipts. One row per delivery of a specific lot number.';
COMMENT ON COLUMN public.raw_material_lots.lot_number   IS
  'Supplier-assigned lot/batch identifier. Unique per (company, material).';
COMMENT ON COLUMN public.raw_material_lots.status       IS
  'Lifecycle: available → quarantine | consumed | rejected | expired.';
COMMENT ON COLUMN public.raw_material_lots.expiry_date  IS
  'Optional expiry date. Application should flag/expire lots past this date.';

-- ── Auto-update updated_at ────────────────────────────────────
-- Reuses set_updated_at() already defined in supabase_schema.sql.
DROP TRIGGER IF EXISTS raw_material_lots_updated_at
  ON public.raw_material_lots;

CREATE TRIGGER raw_material_lots_updated_at
  BEFORE UPDATE ON public.raw_material_lots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Indexes: raw_material_lots ────────────────────────────────

-- Primary: all lots for a given raw material, newest first.
CREATE INDEX IF NOT EXISTS rml_material
  ON public.raw_material_lots (company_id, raw_material_id, received_at DESC);

-- Recall: find a lot by lot_number (supports exact and ILIKE).
CREATE INDEX IF NOT EXISTS rml_lot_number
  ON public.raw_material_lots (company_id, lot_number);

-- Supplier audit: all lots received from a supplier.
CREATE INDEX IF NOT EXISTS rml_supplier
  ON public.raw_material_lots (company_id, supplier_id)
  WHERE supplier_id IS NOT NULL;

-- Status filter: quarantined / available lots for inventory view.
CREATE INDEX IF NOT EXISTS rml_status
  ON public.raw_material_lots (company_id, status);

-- Expiry management: lots with a defined expiry date, sorted soonest first.
CREATE INDEX IF NOT EXISTS rml_expiry
  ON public.raw_material_lots (company_id, expiry_date ASC)
  WHERE expiry_date IS NOT NULL;

-- ── RLS: raw_material_lots ────────────────────────────────────
ALTER TABLE public.raw_material_lots ENABLE ROW LEVEL SECURITY;

-- Full CRUD within company: lots are mutable (status changes, notes updated).
DROP POLICY IF EXISTS "rml: all own company" ON public.raw_material_lots;
CREATE POLICY "rml: all own company"
  ON public.raw_material_lots
  FOR ALL TO authenticated
  USING  (company_id = get_my_company_id())
  WITH CHECK (company_id = get_my_company_id());


-- ════════════════════════════════════════════════════════════
-- SECTION 3: bill_of_materials — add raw_material_lot_id FK
-- ════════════════════════════════════════════════════════════
--
-- What this does
--   Adds a single nullable column raw_material_lot_id to the
--   existing bill_of_materials table. This is the spine of
--   bidirectional lot traceability.
--
-- Why it is additive-only
--   The column is nullable (no DEFAULT, no NOT NULL constraint).
--   Every existing BOM row retains raw_material_lot_id = NULL
--   and is completely unaffected. Only new BOM entries created
--   after the Raw Material Lots UI (Phase 1G) is deployed will
--   populate this column.
--
-- Bidirectional traversal this enables
--   Forward (lot → batches):
--     SELECT production_order_id
--     FROM   bill_of_materials
--     WHERE  raw_material_lot_id = '<lot_id>';
--
--   Backward (batch → lots):
--     SELECT rml.*
--     FROM   bill_of_materials bom
--     JOIN   raw_material_lots rml ON rml.id = bom.raw_material_lot_id
--     WHERE  bom.production_order_id = '<batch_id>'
--       AND  bom.raw_material_lot_id IS NOT NULL;
--
-- ON DELETE SET NULL
--   If a lot record is deleted (rare; only before any production
--   use), the BOM line item survives with lot_id = NULL. The
--   material_name and lot_number text fields on the BOM row
--   retain the human-readable history.
-- ════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'bill_of_materials'
  ) THEN
    RAISE NOTICE
      'bill_of_materials not found — FK augmentation skipped.';
    RETURN;
  END IF;

  -- Add column only if absent
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'bill_of_materials'
      AND column_name  = 'raw_material_lot_id'
  ) THEN
    ALTER TABLE public.bill_of_materials
      ADD COLUMN raw_material_lot_id uuid
        REFERENCES public.raw_material_lots(id)
        ON DELETE SET NULL;

    RAISE NOTICE 'bill_of_materials.raw_material_lot_id added (nullable FK).';
  ELSE
    RAISE NOTICE 'bill_of_materials.raw_material_lot_id already exists — skipped.';
  END IF;

  -- Partial index: only rows where the FK is populated.
  -- Supports the forward-trace query (lot → which BOM lines → which batches).
  EXECUTE $idx$
    CREATE INDEX IF NOT EXISTS bom_lot_id
      ON public.bill_of_materials (raw_material_lot_id)
      WHERE raw_material_lot_id IS NOT NULL;
  $idx$;

  RAISE NOTICE 'bill_of_materials: bom_lot_id index created/verified.';
END;
$$;


-- ── Completion notice ─────────────────────────────────────────
DO $$
DECLARE
  bje_count  int;
  rml_count  int;
BEGIN
  SELECT COUNT(*) INTO bje_count
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'batch_journey_events';

  SELECT COUNT(*) INTO rml_count
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'raw_material_lots';

  IF bje_count = 1 AND rml_count = 1 THEN
    RAISE NOTICE '';
    RAISE NOTICE '✓ Phase 1A complete.';
    RAISE NOTICE '  Tables:  batch_journey_events, raw_material_lots';
    RAISE NOTICE '  Augmented: bill_of_materials (raw_material_lot_id, nullable)';
    RAISE NOTICE '';
    RAISE NOTICE '  Next steps:';
    RAISE NOTICE '    Phase 1B — get_batch_journey RPC (synthesises full timeline)';
    RAISE NOTICE '    Phase 1C — Timeline component on /trace/[id]';
    RAISE NOTICE '    Phase 1D — get_lot_traceability RPC';
  ELSE
    RAISE WARNING 'One or more tables were not confirmed. Check above for errors.';
  END IF;
END;
$$;


-- ============================================================
-- ROLLBACK
-- ============================================================
-- To completely undo this migration, run the following block
-- in the SQL Editor. All data in the new tables will be lost.
--
-- Order matters: remove the FK reference from bill_of_materials
-- before dropping raw_material_lots, otherwise the DROP would
-- need CASCADE (which silently removes the FK constraint but
-- leaves the column as an untyped uuid with no FK).
--
-- DO $$
-- BEGIN
--
--   -- 1. Remove the FK column added to bill_of_materials.
--   IF EXISTS (
--     SELECT 1 FROM information_schema.columns
--     WHERE table_schema = 'public'
--       AND table_name   = 'bill_of_materials'
--       AND column_name  = 'raw_material_lot_id'
--   ) THEN
--     ALTER TABLE public.bill_of_materials
--       DROP COLUMN raw_material_lot_id;
--     RAISE NOTICE 'Removed bill_of_materials.raw_material_lot_id';
--   END IF;
--
--   -- 2. Drop batch_journey_events (no dependents).
--   DROP TABLE IF EXISTS public.batch_journey_events;
--   RAISE NOTICE 'Dropped batch_journey_events';
--
--   -- 3. Drop raw_material_lots (FK from bill_of_materials already removed).
--   DROP TABLE IF EXISTS public.raw_material_lots;
--   RAISE NOTICE 'Dropped raw_material_lots';
--
--   RAISE NOTICE 'Phase 1A rollback complete.';
-- END;
-- $$;
-- ============================================================
