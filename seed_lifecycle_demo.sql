-- ============================================================
-- TraceFlow — Production-Readiness Lifecycle Demo Seed
-- ============================================================
-- Purpose : Populate every module with realistic, SFDA-grade
--           manufacturing demo data across three full lifecycle
--           stories plus broad supporting data for all KPI
--           cards, charts, and list views.
--
-- Story 1 : Ball Valve 2in 316 SS
--           Raw Material → Production → QC Pass →
--           Distribution → Consumer QR Scans
--
-- Story 2 : Hydraulic Cylinder 50mm
--           Production → QC Fail → CAPA (open → investigation
--           → corrective action → verification → closed)
--
-- Story 3 : Safety Relief Valve 0.5in 10 bar
--           Production → QC Pass → Distribution →
--           Field Failure → Recall → CAPA → Both Closed
--
-- HOW TO RUN
--   Supabase Dashboard → SQL Editor → New Query → paste → Run
--   Run ONCE. ON CONFLICT DO NOTHING prevents duplicate rows.
-- ============================================================

DO $$
DECLARE
  -- ── Company lookup ─────────────────────────────────────────
  cid    uuid;           -- company_id resolved from first company
  uid    uuid;           -- user UUID resolved from user_profiles

  -- ── Story entity IDs ────────────────────────────────────────
  -- Suppliers
  s_gulf   uuid := gen_random_uuid();
  s_sabic  uuid := gen_random_uuid();
  s_yanbu  uuid := gen_random_uuid();
  s_aramo  uuid := gen_random_uuid();

  -- Story products
  p_valve  uuid := gen_random_uuid();  -- Ball Valve (Story 1)
  p_hyd    uuid := gen_random_uuid();  -- Hydraulic Cylinder (Story 2)
  p_relief uuid := gen_random_uuid();  -- Safety Relief Valve (Story 3)

  -- Supporting products (for dashboard charts / KPIs)
  p_bolt   uuid := gen_random_uuid();
  p_nut    uuid := gen_random_uuid();
  p_gate   uuid := gen_random_uuid();
  p_mccb   uuid := gen_random_uuid();
  p_vfd    uuid := gen_random_uuid();
  p_gear   uuid := gen_random_uuid();
  p_flange uuid := gen_random_uuid();
  p_helmet uuid := gen_random_uuid();

  -- Raw materials
  m_ss316  uuid := gen_random_uuid();
  m_carbon uuid := gen_random_uuid();
  m_ptfe   uuid := gen_random_uuid();
  m_chrome uuid := gen_random_uuid();
  m_nbr    uuid := gen_random_uuid();
  m_copper uuid := gen_random_uuid();
  m_hdpe   uuid := gen_random_uuid();

  -- Raw material lots (3 story-critical lots)
  lot_ss316  uuid := gen_random_uuid();
  lot_cs235  uuid := gen_random_uuid();
  lot_chrome uuid := gen_random_uuid();

  -- Production order IDs (3 story batches)
  batch_01 uuid := gen_random_uuid();  -- Story 1: Ball Valve
  batch_02 uuid := gen_random_uuid();  -- Story 2: Hydraulic Cylinder
  batch_03 uuid := gen_random_uuid();  -- Story 3: Safety Relief Valve

  -- Supporting production orders
  b04 uuid := gen_random_uuid();  b05 uuid := gen_random_uuid();
  b06 uuid := gen_random_uuid();  b07 uuid := gen_random_uuid();
  b08 uuid := gen_random_uuid();  b09 uuid := gen_random_uuid();
  b10 uuid := gen_random_uuid();  b11 uuid := gen_random_uuid();
  b12 uuid := gen_random_uuid();  b13 uuid := gen_random_uuid();
  b14 uuid := gen_random_uuid();  b15 uuid := gen_random_uuid();

  -- QC IDs (batch_qc_results)
  qc_01 uuid := gen_random_uuid();  -- Story 1: pass
  qc_02 uuid := gen_random_uuid();  -- Story 2: fail
  qc_03 uuid := gen_random_uuid();  -- Story 3: pass

  -- Quality inspection IDs (quality_inspections)
  qi_01 uuid := gen_random_uuid();  -- Story 1: passed
  qi_02 uuid := gen_random_uuid();  -- Story 2: failed
  qi_03 uuid := gen_random_uuid();  -- Story 3: passed (before recall)

  -- CAPA IDs
  capa_01 uuid := gen_random_uuid();  -- Story 2: cylinder hardness CAPA (closed)
  capa_02 uuid := gen_random_uuid();  -- Story 3: recall-linked CAPA (closed)
  capa_03 uuid := gen_random_uuid();  -- Open CAPA (in investigation)
  capa_04 uuid := gen_random_uuid();  -- Open CAPA (corrective action)

  -- Recall IDs
  recall_01 uuid := gen_random_uuid();  -- Story 3: closed recall
  recall_02 uuid := gen_random_uuid();  -- Active open recall

  -- Timestamps anchored to "90 days ago"
  t_base timestamptz := now() - interval '90 days';
  t1     timestamptz;  -- Story 1 timeline anchor
  t2     timestamptz;  -- Story 2 timeline anchor
  t3     timestamptz;  -- Story 3 timeline anchor

  n int;  -- row count for diagnostics

BEGIN

  -- ── 0. Resolve company & user ─────────────────────────────────
  SELECT id, (SELECT user_id FROM user_profiles WHERE company_id = c.id LIMIT 1)
  INTO cid, uid
  FROM companies c
  ORDER BY created_at
  LIMIT 1;

  IF cid IS NULL THEN
    RAISE EXCEPTION 'No company found. Complete onboarding first.';
  END IF;

  RAISE NOTICE 'Seeding company_id = %, user_id = %', cid, uid;

  -- ── 0b. Backfill any existing rows with NULL company_id ────────
  -- (Handles data inserted before the multitenancy migration backfill)
  UPDATE products          SET company_id = cid WHERE company_id IS NULL;
  UPDATE suppliers         SET company_id = cid WHERE company_id IS NULL;
  UPDATE raw_materials     SET company_id = cid WHERE company_id IS NULL;
  UPDATE production_orders SET company_id = cid WHERE company_id IS NULL;
  UPDATE sales             SET company_id = cid WHERE company_id IS NULL;
  UPDATE quality_inspections SET company_id = cid WHERE company_id IS NULL;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='bill_of_materials' AND table_schema='public') THEN
    UPDATE bill_of_materials  SET company_id = cid WHERE company_id IS NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='batch_qc_results' AND table_schema='public') THEN
    UPDATE batch_qc_results   SET company_id = cid WHERE company_id IS NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='scan_events' AND table_schema='public') THEN
    UPDATE scan_events        SET company_id = cid WHERE company_id IS NULL;
  END IF;

  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'Backfill complete';

  -- ── 0c. Ensure distribution_records has a notes column ────────
  -- The RPC uses dr.notes; defensive add in case only recipient exists.
  ALTER TABLE distribution_records ADD COLUMN IF NOT EXISTS notes text;
  ALTER TABLE distribution_records ADD COLUMN IF NOT EXISTS recipient text;
  ALTER TABLE distribution_records ADD COLUMN IF NOT EXISTS quantity int;

  -- ═══════════════════════════════════════════════════════════════
  -- 1. SUPPLIERS
  -- ═══════════════════════════════════════════════════════════════

  INSERT INTO suppliers (id, name, contact_email, contact_phone, company_id, created_at)
  VALUES
    (s_gulf,  'Gulf Steel Industries LLC',        'procurement@gulfsteel.sa',    '+966-11-234-5678', cid, t_base),
    (s_sabic, 'SABIC Advanced Polymers Co.',      'supply@sabic-polymers.sa',    '+966-13-445-6789', cid, t_base),
    (s_yanbu, 'Yanbu Precision Engineering Ltd',  'orders@yanbu-precision.sa',   '+966-14-332-1100', cid, t_base),
    (s_aramo, 'Arabian Valve & Fittings Co.',     'export@arabvalve.sa',         '+966-13-334-5673', cid, t_base)
  ON CONFLICT DO NOTHING;

  -- ═══════════════════════════════════════════════════════════════
  -- 2. PRODUCTS
  -- ═══════════════════════════════════════════════════════════════

  -- Three lifecycle story products
  INSERT INTO products (id, name, sku, description, company_id, created_at) VALUES
    (p_valve,  'Ball Valve 2in 316 Stainless Steel',    'VBC-2IN-316', 'Full-bore ball valve, fire-safe design, ISO 17292. For process isolation in petrochemical plants.', cid, t_base),
    (p_hyd,    'Hydraulic Cylinder 50mm Bore 200mm',    'HPC-50-200',  'Double-acting hydraulic cylinder, chrome-plated rod, honed bore. ISO 6020-2.', cid, t_base),
    (p_relief, 'Safety Relief Valve 0.5in 10 bar',      'VSR-05-010',  'Spring-loaded pressure relief valve. Set pressure factory-tested, ASME coded.', cid, t_base)
  ON CONFLICT (sku) DO NOTHING;

  -- Re-read IDs (in case rows already existed under a different UUID)
  SELECT id INTO p_valve  FROM products WHERE sku='VBC-2IN-316' AND company_id=cid LIMIT 1;
  SELECT id INTO p_hyd    FROM products WHERE sku='HPC-50-200'  AND company_id=cid LIMIT 1;
  SELECT id INTO p_relief FROM products WHERE sku='VSR-05-010'  AND company_id=cid LIMIT 1;

  -- Supporting products (for dashboard pipeline/charts)
  INSERT INTO products (id, name, sku, description, company_id, created_at) VALUES
    (p_bolt,   'Steel Hex Bolt M12x80 Grade 8.8',    'IFB-M12-880', 'High-strength industrial fastener, zinc-plated, meets DIN 931.', cid, t_base),
    (p_nut,    'Stainless Hex Nut M12 DIN 934',      'IFN-M12-934', 'A2-70 stainless steel, corrosion-resistant. Offshore certified.', cid, t_base),
    (p_gate,   'Gate Valve DN50 PN16 Carbon Steel',  'VGV-DN50-16', 'OS&Y gate valve, rising stem. API 600 compliant.', cid, t_base),
    (p_mccb,   'MCCB 3-Pole 250A Fixed Mount',       'ELM-3P-250A', 'Moulded case circuit breaker. IEC 60947-2 certified.', cid, t_base),
    (p_vfd,    'Variable Frequency Drive 7.5kW',      'ELV-7K5-VFD', 'Sensorless vector control drive, built-in EMC filter, RS485 Modbus RTU.', cid, t_base),
    (p_gear,   'Gear Pump 16cc 250 bar Hydraulic',    'HPG-16CC-250', 'External gear pump, SAE flange mount. Mobile and industrial circuits.', cid, t_base),
    (p_flange, 'Weld Neck Flange DN80 PN40',          'SPF-DN80-40', 'Class 300 raised-face weld neck flange. ASME B16.5.', cid, t_base),
    (p_helmet, 'Safety Helmet Class G EN397 White',   'PPH-CG-WHT',  'Polypropylene hard hat with 6-point suspension. EN 397 certified.', cid, t_base)
  ON CONFLICT (sku) DO NOTHING;

  -- ═══════════════════════════════════════════════════════════════
  -- 3. RAW MATERIALS
  -- ═══════════════════════════════════════════════════════════════

  INSERT INTO raw_materials (id, name, unit, quantity_in_stock, reorder_level, supplier_id, company_id, created_at) VALUES
    (m_ss316,  'Stainless Steel 316 Round Bar 25mm',  'kg',    1850.00,  200.00, s_gulf,  cid, t_base),
    (m_carbon, 'Carbon Steel Sheet S235 6mm',         'kg',    3200.00,  400.00, s_gulf,  cid, t_base),
    (m_ptfe,   'PTFE Virgin Rod Stock 20mm dia.',     'm',      120.00,   20.00, s_sabic, cid, t_base),
    (m_chrome, 'Chrome-Plated Steel Rod 50mm',        'kg',      45.00,  100.00, s_yanbu, cid, t_base),  -- Low stock after quarantine
    (m_nbr,    'NBR Nitrile Rubber Sheet 3mm',        'sheet',   45.00,   10.00, s_sabic, cid, t_base),
    (m_copper, 'Electrolytic Copper Wire 4mm2',       'kg',     920.00,  150.00, s_aramo, cid, t_base),
    (m_hdpe,   'HDPE Granules MFI 0.3 g/10min',      'kg',     280.00,   80.00, s_sabic, cid, t_base)
  ON CONFLICT DO NOTHING;

  -- ═══════════════════════════════════════════════════════════════
  -- 4. RAW MATERIAL LOTS
  -- ═══════════════════════════════════════════════════════════════

  INSERT INTO raw_material_lots (
    id, company_id, raw_material_id, lot_number, quantity, unit,
    supplier_id, received_at, expiry_date, status, notes, created_at, updated_at
  ) VALUES
    (lot_ss316,  cid, m_ss316,  'LOT-2025-SS316-0891', 500.0, 'kg',
     s_gulf,  t_base,              t_base + interval '2 years',
     'available', 'Mill cert EN 10204 3.1. Heat number HN-29841. Hardness 187 HB (within spec).', t_base, t_base),

    (lot_cs235,  cid, m_carbon, 'LOT-2025-CS235-0442', 800.0, 'kg',
     s_gulf,  t_base + interval '5 days', t_base + interval '3 years',
     'consumed',  'Fully consumed: used in Story 3 Safety Relief Valve production and supporting batches.', t_base + interval '5 days', t_base + interval '5 days'),

    (lot_chrome, cid, m_chrome, 'LOT-2025-CRROD-0115', 300.0, 'kg',
     s_yanbu, t_base + interval '2 days', t_base + interval '18 months',
     'quarantine','QUARANTINED: Surface hardness 48–51 HRC — below minimum 58 HRC. NCR-2025-0041 raised. Supplier Yanbu Precision Engineering notified. Return in progress.', t_base + interval '2 days', t_base + interval '30 days')
  ON CONFLICT DO NOTHING;

  -- ═══════════════════════════════════════════════════════════════
  -- STORY 1: Ball Valve 2in 316 SS
  -- Complete lifecycle: Raw Material → Production → QC Pass →
  -- Distribution → Consumer QR Scans
  -- ═══════════════════════════════════════════════════════════════

  t1 := t_base + interval '5 days';

  -- Production order
  INSERT INTO production_orders (id, product_id, quantity, status, started_at, completed_at, company_id, created_at)
  VALUES (batch_01, p_valve, 250, 'completed', t1 + interval '1 day', t1 + interval '8 days', cid, t1)
  ON CONFLICT DO NOTHING;

  -- Bill of materials
  INSERT INTO bill_of_materials (production_order_id, material_name, lot_number, quantity, unit, company_id, created_at)
  VALUES
    (batch_01, 'Stainless Steel 316 Round Bar 25mm', 'LOT-2025-SS316-0891', 87.5,  'kg',    cid, t1 + interval '1 day'),
    (batch_01, 'PTFE Virgin Rod Stock 20mm dia.',    'LOT-2025-PTFE-0054',  12.5,  'm',     cid, t1 + interval '1 day'),
    (batch_01, 'NBR Nitrile Rubber Sheet 3mm',       'LOT-2025-NBR-0203',    2.5,  'sheet', cid, t1 + interval '1 day')
  ON CONFLICT DO NOTHING;

  -- Batch QC result (pass)
  INSERT INTO batch_qc_results (id, batch_id, status, inspector_name, notes, inspected_at, company_id, created_at)
  VALUES (qc_01, batch_01, 'pass', 'Khalid Al-Rashidi',
    'All 250 units inspected. Ball rotation torque 7.8 Nm (spec 7–9 Nm). Pressure test at 1.5× working pressure: PASS. Fire-safe seat test per ISO 10497: PASS. Surface finish Ra 0.8 μm. Certificate of Conformance CC-2025-0891 issued.',
    t1 + interval '9 days', cid, t1 + interval '9 days')
  ON CONFLICT DO NOTHING;

  -- Formal quality inspection (quality_inspections — batch_id as text UUID)
  INSERT INTO quality_inspections (id, batch_id, inspector_id, inspector_name, inspection_date, inspection_type, status, overall_score, notes, company_id, created_at, updated_at)
  VALUES (qi_01, batch_01::text, 'INS-001', 'Khalid Al-Rashidi',
    (t1 + interval '9 days')::date, 'final', 'passed', 97.5,
    'Final inspection QCP-003 Rev 4. All dimensional checks within ±0.05 mm. Pressure test, fire-safe seat, and material certs reviewed. 100% units certified. Batch cleared for immediate shipment. CC-2025-0891 filed.',
    cid, t1 + interval '9 days', t1 + interval '9 days')
  ON CONFLICT DO NOTHING;

  -- Distribution shipments
  INSERT INTO distribution_records (company_id, batch_id, recipient, quantity, notes, shipped_at, created_at)
  VALUES
    (cid, batch_01::text, 'Saudi Aramco — Jubail Industrial Area',   120, 'DN-SA-2025-0441: 120 units per purchase order SAP-PO-84231. Shipped via SAPTCO cargo. Delivery confirmed.', t1 + interval '12 days', t1 + interval '12 days'),
    (cid, batch_01::text, 'Sipchem Jubail Plant 4',                   80, 'DN-SPC-2025-0217: 80 units to Plant 4 process isolation upgrade. Customer received and accepted.', t1 + interval '14 days', t1 + interval '14 days'),
    (cid, batch_01::text, 'Maaden Mining — Wa''ad Al Shamal',         50, 'DN-MAD-2025-0089: 50 units for potash plant valve replacement program. Cold chain transport.', t1 + interval '16 days', t1 + interval '16 days')
  ON CONFLICT DO NOTHING;

  -- Sales records
  INSERT INTO sales (product_id, product_name, quantity, unit_price, total_price, customer_name, status, sold_at, company_id, created_at)
  VALUES
    (p_valve, 'Ball Valve 2in 316 Stainless Steel', 120, 2850.00,  342000.00, 'Saudi Aramco',        'completed', t1 + interval '12 days', cid, t1 + interval '12 days'),
    (p_valve, 'Ball Valve 2in 316 Stainless Steel',  80, 2780.00,  222400.00, 'Sipchem Jubail',      'completed', t1 + interval '14 days', cid, t1 + interval '14 days'),
    (p_valve, 'Ball Valve 2in 316 Stainless Steel',  50, 2900.00,  145000.00, 'Maaden Mining Co.',   'completed', t1 + interval '16 days', cid, t1 + interval '16 days')
  ON CONFLICT DO NOTHING;

  -- Consumer QR Scans (35 scans, 3 different UA fingerprints for Repeat Rate metric)
  FOR i IN 1..35 LOOP
    INSERT INTO scan_events (batch_id, scanned_at, device_type, browser, user_agent, company_id)
    VALUES (
      batch_01,
      t1 + interval '12 days' + (i * 2.8 || ' days')::interval,
      CASE WHEN i % 3 = 0 THEN 'desktop' ELSE 'mobile' END,
      (ARRAY['Chrome','Safari','Safari','Chrome','Edge','Firefox','Chrome','Safari'])[1 + (i % 8)],
      CASE
        WHEN i % 3 = 0 THEN 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        WHEN i % 3 = 1 THEN 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.119 Mobile Safari/537.36'
        ELSE                 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1'
      END,
      cid
    );
  END LOOP;

  -- Scans in the LAST 7 DAYS for the Scan Activity chart
  FOR i IN 1..12 LOOP
    INSERT INTO scan_events (batch_id, scanned_at, device_type, browser, user_agent, company_id)
    VALUES (
      batch_01,
      now() - ((i * 0.55) || ' days')::interval,
      CASE WHEN i % 2 = 0 THEN 'desktop' ELSE 'mobile' END,
      (ARRAY['Chrome','Safari','Chrome','Edge','Chrome'])[1 + (i % 5)],
      CASE WHEN i % 2 = 0
        THEN 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36'
        ELSE 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1'
      END,
      cid
    );
  END LOOP;

  -- Batch journey events (narrative extras for the Product Journey timeline)
  INSERT INTO batch_journey_events (company_id, batch_id, event_type, event_timestamp, actor_email, entity_type, metadata, created_at)
  VALUES
    (cid, batch_01, 'raw_material.received',    t1,
     'warehouse@company.sa', 'raw_material',
     '{"title":"Raw Materials Received & Verified","description":"SS316 lot LOT-2025-SS316-0891 (87.5 kg) received from Gulf Steel Industries. Mill cert EN 10204 3.1 verified. Material cleared for production."}'::jsonb,
     t1),
    (cid, batch_01, 'packaging.completed',      t1 + interval '10 days',
     'ops@company.sa', 'production_order',
     '{"title":"Packaging & Labelling Complete","description":"All 250 units individually packed in VCI-coated cartons. SFDA traceability labels applied. QR codes verified. Ready for dispatch."}'::jsonb,
     t1 + interval '10 days'),
    (cid, batch_01, 'capa.closed',              t1 + interval '11 days',
     'qa@company.sa', 'production_order',
     '{"title":"SFDA Documentation Filed","description":"CE/API declarations of conformity, pressure test certificates, and material certs uploaded to SFDA product registry."}'::jsonb,
     t1 + interval '11 days');

  -- ═══════════════════════════════════════════════════════════════
  -- STORY 2: Hydraulic Cylinder 50mm
  -- QC Failure → CAPA (open → investigation → corrective →
  -- verification → closed)
  -- ═══════════════════════════════════════════════════════════════

  t2 := t_base + interval '25 days';

  INSERT INTO production_orders (id, product_id, quantity, status, started_at, completed_at, company_id, created_at)
  VALUES (batch_02, p_hyd, 80, 'completed', t2 + interval '1 day', t2 + interval '7 days', cid, t2)
  ON CONFLICT DO NOTHING;

  INSERT INTO bill_of_materials (production_order_id, material_name, lot_number, quantity, unit, company_id, created_at)
  VALUES
    (batch_02, 'Chrome-Plated Steel Rod 50mm', 'LOT-2025-CRROD-0115', 45.0, 'kg',    cid, t2 + interval '1 day'),
    (batch_02, 'Carbon Steel Sheet S235 6mm',  'LOT-2025-CS235-0442', 120.0,'kg',    cid, t2 + interval '1 day'),
    (batch_02, 'NBR Nitrile Rubber Sheet 3mm', 'LOT-2025-NBR-0203',    4.0, 'sheet', cid, t2 + interval '1 day')
  ON CONFLICT DO NOTHING;

  -- Batch QC result (fail)
  INSERT INTO batch_qc_results (id, batch_id, status, inspector_name, notes, inspected_at, company_id, created_at)
  VALUES (qc_02, batch_02, 'fail', 'Ahmed Al-Mutairi',
    'CRITICAL FAILURE — Surface hardness of chrome rod 48–51 HRC across all 80 units (specification: 58–62 HRC min). Bore honing tolerance exceeded: ±0.05 mm actual vs ±0.02 mm specified. All 80 units QUARANTINED. NCR-2025-0041 raised. Batch held — do not ship. Root cause: incorrect heat treatment cycle from supplier Yanbu Precision Engineering.',
    t2 + interval '8 days', cid, t2 + interval '8 days')
  ON CONFLICT DO NOTHING;

  -- Formal quality inspection (failed)
  INSERT INTO quality_inspections (id, batch_id, inspector_id, inspector_name, inspection_date, inspection_type, status, overall_score, notes, company_id, created_at, updated_at)
  VALUES (qi_02, batch_02::text, 'INS-003', 'Ahmed Al-Mutairi',
    (t2 + interval '8 days')::date, 'final', 'failed', 41.0,
    'FAILED — per QCP-003 Rev 4. Hardness OOS: 48–51 HRC vs 58–62 HRC min. Bore tolerance exceeded. Batch scrapped (destructive hardness test confirms no rework possible). 8D report HYD-8D-2025-041 initiated. SFDA NCR filed.',
    cid, t2 + interval '8 days', t2 + interval '8 days')
  ON CONFLICT DO NOTHING;

  -- Quality defects
  INSERT INTO quality_defects (inspection_id, defect_type, severity, quantity, description, corrective_action, resolved, resolved_at, created_at)
  VALUES
    (qi_02, 'Material Hardness Out of Spec', 'critical', 80,
     'Chrome rod surface hardness 48–51 HRC across entire batch. Root cause: supplier applied 850°C/2h heat treatment cycle vs specified 920°C/4h. Deviation undisclosed on material certificate.',
     'Quarantine LOT-2025-CRROD-0115. Raise supplier NCR-2025-0041. Return full lot to Yanbu Precision. Source replacement from Gulf Steel Industries. Validate with 100% hardness testing before production release.',
     true, t2 + interval '38 days', t2 + interval '8 days'),
    (qi_02, 'Tolerance Exceeded', 'major', 80,
     'Bore honing: ±0.05 mm actual vs ±0.02 mm spec on all 80 cylinders. Correlated failure — incorrect rod material hardness caused tool deflection during machining.',
     '80 units condemned and scrapped. 8D report HYD-8D-2025-041 documents full corrective action plan including revised in-process hardness check at machining stage.',
     true, t2 + interval '38 days', t2 + interval '8 days')
  ON CONFLICT DO NOTHING;

  -- CAPA (Story 2 — fully closed lifecycle)
  INSERT INTO capas (
    id, company_id, inspection_id, batch_id,
    title, severity, root_cause, corrective_action, preventive_action,
    owner_name, due_date, status,
    investigation_at, corrective_action_at, verification_at, closed_at,
    created_at, updated_at
  ) VALUES (
    capa_01, cid, qi_02, batch_02,
    'Critical Hardness Non-Conformance — Hydraulic Cylinder Batch HPC-2025-080',
    'critical',
    'Supplier Yanbu Precision Engineering applied 850°C/2h heat treatment (specified: 920°C/4h) to chrome rod LOT-2025-CRROD-0115. Process deviation due to uncontrolled furnace maintenance window. No in-process verification performed pre-shipment. Certificate of Conformance falsely declared correct heat cycle.',
    '1. Quarantine and scrap all 80 units. 2. Raise Supplier NCR-2025-0041 to Yanbu Precision Engineering. 3. Reject and return full LOT-2025-CRROD-0115 (300 kg). 4. Source replacement lot from Gulf Steel Industries (approved alternate). 5. Perform 100% Rockwell hardness test on replacement lot before production release.',
    '1. Update Approved Supplier List: mandatory hardness cert required for all chrome rod deliveries. 2. Introduce in-process Rockwell hardness check at machining stage (QCP-011 Rev 3). 3. Add thermal process verification step to incoming inspection checklist. 4. Yanbu Precision Engineering capacity audit within 60 days.',
    'Sara Al-Qahtani', (t2 + interval '45 days')::date, 'closed',
    t2 + interval '9 days',
    t2 + interval '18 days',
    t2 + interval '35 days',
    t2 + interval '42 days',
    t2 + interval '8 days',
    t2 + interval '42 days'
  ) ON CONFLICT DO NOTHING;

  -- ═══════════════════════════════════════════════════════════════
  -- STORY 3: Safety Relief Valve 0.5in 10 bar
  -- Production → QC Pass → Distribution → Field Failure →
  -- Recall → CAPA → Both Closed
  -- ═══════════════════════════════════════════════════════════════

  t3 := t_base + interval '42 days';

  INSERT INTO production_orders (id, product_id, quantity, status, started_at, completed_at, company_id, created_at)
  VALUES (batch_03, p_relief, 150, 'completed', t3 + interval '1 day', t3 + interval '6 days', cid, t3)
  ON CONFLICT DO NOTHING;

  INSERT INTO bill_of_materials (production_order_id, material_name, lot_number, quantity, unit, company_id, created_at)
  VALUES
    (batch_03, 'Carbon Steel Sheet S235 6mm',  'LOT-2025-CS235-0442', 62.0, 'kg',    cid, t3 + interval '1 day'),
    (batch_03, 'NBR Nitrile Rubber Sheet 3mm', 'LOT-2025-NBR-0223',    3.0, 'sheet', cid, t3 + interval '1 day'),
    (batch_03, 'Stainless Steel 316 Round Bar 25mm', 'LOT-2025-SS316-0891', 18.0, 'kg', cid, t3 + interval '1 day')
  ON CONFLICT DO NOTHING;

  -- Batch QC result (pass — latent field defect not yet detected)
  INSERT INTO batch_qc_results (id, batch_id, status, inspector_name, notes, inspected_at, company_id, created_at)
  VALUES (qc_03, batch_03, 'pass', 'Mohammed Al-Harbi',
    'Final inspection per ASME UG-136. Set pressure verified 10.0 bar ±0.28 bar. Full-lift test at 110% set pressure: PASS. Seat tightness at 90% set: PASS. All 150 units stamped, sealed, and tagged. Certificate of Conformance CC-2025-0903 issued. No anomalies detected at ambient temperature.',
    t3 + interval '7 days', cid, t3 + interval '7 days')
  ON CONFLICT DO NOTHING;

  -- Formal quality inspection (passed)
  INSERT INTO quality_inspections (id, batch_id, inspector_id, inspector_name, inspection_date, inspection_type, status, overall_score, notes, company_id, created_at, updated_at)
  VALUES (qi_03, batch_03::text, 'INS-002', 'Mohammed Al-Harbi',
    (t3 + interval '7 days')::date, 'final', 'passed', 91.0,
    'Passed. Set pressure within ±3% per ASME UG-136. 100% cold pressure tested. Full documentation package complete. Note: ambient-temp test only — high-temp performance assumed per spring material certificate. This gap later identified as root cause of field failure.',
    cid, t3 + interval '7 days', t3 + interval '7 days')
  ON CONFLICT DO NOTHING;

  -- Distribution (shipped before recall discovered)
  INSERT INTO distribution_records (company_id, batch_id, recipient, quantity, notes, shipped_at, created_at)
  VALUES
    (cid, batch_03::text, 'Tasnee Petrochemicals — Jubail',       60, 'DN-TAS-2025-0388: 60 units to Tasnee process safety system upgrade. Delivered to site warehouse.', t3 + interval '10 days', t3 + interval '10 days'),
    (cid, batch_03::text, 'National Gas Co. NGIC — Riyadh',       55, 'DN-NGC-2025-0154: 55 units for NGIC Riyadh pipeline pressure management project.', t3 + interval '12 days', t3 + interval '12 days'),
    (cid, batch_03::text, 'Advanced Polypropylene Co. — Jubail',  35, 'DN-APC-2025-0071: 35 units for APP polypropylene reactor safety system.', t3 + interval '14 days', t3 + interval '14 days')
  ON CONFLICT DO NOTHING;

  INSERT INTO sales (product_id, product_name, quantity, unit_price, total_price, customer_name, status, sold_at, company_id, created_at)
  VALUES
    (p_relief, 'Safety Relief Valve 0.5in 10 bar', 60, 1650.00,  99000.00, 'Tasnee Petrochemicals',      'completed', t3 + interval '10 days', cid, t3 + interval '10 days'),
    (p_relief, 'Safety Relief Valve 0.5in 10 bar', 55, 1620.00,  89100.00, 'National Gas Co. NGIC',      'completed', t3 + interval '12 days', cid, t3 + interval '12 days'),
    (p_relief, 'Safety Relief Valve 0.5in 10 bar', 35, 1680.00,  58800.00, 'Advanced Polypropylene Co.', 'completed', t3 + interval '14 days', cid, t3 + interval '14 days')
  ON CONFLICT DO NOTHING;

  -- Recall (initiated 25 days after distribution — field failure report)
  INSERT INTO recalls (
    id, company_id, product_id, batch_id,
    title, reason, severity, status,
    root_cause, corrective_action, affected_units,
    initiated_by_name, initiated_at, closed_at,
    created_at, updated_at
  ) VALUES (
    recall_01, cid, p_relief, batch_03,
    'Voluntary Recall — VSR-05-010 Safety Relief Valves, Batch 2025-Q1-003 (150 units)',
    'Field report from Tasnee Petrochemicals: 4 units failed to open at set pressure during scheduled safety relief test at 185°C operating temperature. Post-failure analysis: spring seat material — supplier substituted 17-7PH stainless (actual) for Inconel 625 (specified). At elevated temperature, spring relaxation rate exceeds design. All 150 units in batch potentially affected. SFDA voluntary recall notice filed per MD-CAB-04.',
    'critical',
    'closed',
    'Spring seat material substitution by undisclosed supplier change. Supplier used 17-7PH PH SS in place of specified Inconel 625 without engineering change notification. Material certificate falsely declared Inconel 625. Ambient-temperature QC pass did not detect high-temperature performance deviation. Gap: incoming inspection did not include XRF/PMI verification for spring assemblies.',
    'Voluntary recall of all 150 units. Replacement program: free Inconel 625 spring assembly retrofit within 30 days. All 3 customers notified within 24h. Field service teams deployed. SFDA Recall Notification RN-2025-VSR-003 submitted. Return rate: 148/150 units retrieved (98.7%). 2 units unaccounted — SFDA notified.',
    150,
    'Omar Al-Shamrani',
    t3 + interval '25 days',
    t3 + interval '62 days',
    t3 + interval '25 days',
    t3 + interval '62 days'
  ) ON CONFLICT DO NOTHING;

  -- CAPA linked to the recall (closed)
  INSERT INTO capas (
    id, company_id, recall_id, inspection_id, batch_id,
    title, severity, root_cause, corrective_action, preventive_action,
    owner_name, due_date, status,
    investigation_at, corrective_action_at, verification_at, closed_at,
    created_at, updated_at
  ) VALUES (
    capa_02, cid, recall_01, qi_03, batch_03,
    'Spring Material Deviation — Safety Relief Valve Recall VSR-2025-Q1-003',
    'critical',
    'Undisclosed supplier material substitution. XRF analysis confirmed 17-7PH SS (actual) vs Inconel 625 (specified). High-temperature creep failure at >160°C. Incoming QC did not include PMI/XRF for spring components.',
    '1. Full voluntary recall: 150 units. 2. Free Inconel 625 spring retrofit deployed to all 3 customer sites. 3. Supplier SHV-Springs disqualified from Approved Supplier List. 4. XRF spot-check on all safety valve spring stock in warehouse — 0 further OOS found. 5. SFDA RN-2025-VSR-003 filed within 24h.',
    '1. Mandatory XRF/PMI verification for all Inconel and superalloy spring components before production release — no exceptions. 2. Update Approved Supplier List: safety valve spring assemblies restricted to single-source (Gulf Steel Industries). 3. Add PMI verification field to incoming inspection checklist for safety-critical components. 4. Annual material audit clause added to all spring component supplier contracts.',
    'Fatima Al-Dosari', (t3 + interval '65 days')::date, 'closed',
    t3 + interval '26 days',
    t3 + interval '34 days',
    t3 + interval '54 days',
    t3 + interval '62 days',
    t3 + interval '25 days',
    t3 + interval '62 days'
  ) ON CONFLICT DO NOTHING;

  -- ═══════════════════════════════════════════════════════════════
  -- 5. ACTIVE / OPEN RECORDS (for KPI cards showing live state)
  -- ═══════════════════════════════════════════════════════════════

  -- Open recall (not yet resolved — shows on Active Recalls KPI)
  INSERT INTO recalls (
    id, company_id, product_id,
    title, reason, severity, status,
    affected_units, initiated_by_name, initiated_at,
    created_at, updated_at
  ) VALUES (
    recall_02, cid, p_bolt,
    'Precautionary Hold — Steel Hex Bolt M12 Grade 8.8, Batch IFB-2025-Q2-007',
    'In-service inspection by Saudi Aramco flagged 3 bolts with potential thread form deviation in flange joint application. Batch IFB-2025-Q2-007 placed on precautionary hold pending field sampling and thread gauge testing at customer site.',
    'medium',
    'in_progress',
    480,
    'Abdullah Al-Zahrani',
    now() - interval '8 days',
    now() - interval '8 days',
    now() - interval '8 days'
  ) ON CONFLICT DO NOTHING;

  -- Open CAPA: in investigation stage
  INSERT INTO capas (
    id, company_id, recall_id,
    title, severity, root_cause,
    owner_name, due_date, status, investigation_at,
    created_at, updated_at
  ) VALUES (
    capa_03, cid, recall_02,
    'Thread Form Deviation Investigation — Bolt Batch IFB-2025-Q2-007',
    'major',
    'Under investigation. Thread profile gauge measurements being conducted on retained samples at metrology lab. Saudi Aramco field team sampling in progress.',
    'Khalid Al-Rashidi', (now() + interval '21 days')::date, 'investigation',
    now() - interval '7 days',
    now() - interval '8 days',
    now() - interval '7 days'
  ) ON CONFLICT DO NOTHING;

  -- Open CAPA: corrective action stage
  INSERT INTO capas (
    id, company_id,
    title, severity, root_cause, corrective_action,
    owner_name, due_date, status, investigation_at, corrective_action_at,
    created_at, updated_at
  ) VALUES (
    capa_04, cid,
    'Supplier Documentation Gap — Missing SFDA Import Certificate LOT-SS316-0891',
    'major',
    'Lot LOT-2025-SS316-0891 received from Gulf Steel Industries without required SFDA import certificate (mandatory for products entering KSA process industry). Mill cert present; import cert omitted from documentation package.',
    'Gulf Steel Industries to provide retroactive SFDA import cert within 14 days. Purchase orders updated to include SFDA cert as mandatory delivery document. Procurement checklist updated.',
    'Abdullah Al-Zahrani', (now() + interval '10 days')::date, 'corrective_action',
    now() - interval '12 days',
    now() - interval '5 days',
    now() - interval '14 days',
    now() - interval '5 days'
  ) ON CONFLICT DO NOTHING;

  -- ═══════════════════════════════════════════════════════════════
  -- 6. SUPPORTING PRODUCTION ORDERS (for dashboard charts & KPIs)
  -- ═══════════════════════════════════════════════════════════════

  -- Completed orders across multiple products
  INSERT INTO production_orders (id, product_id, quantity, status, started_at, completed_at, company_id, created_at) VALUES
    (b04, p_bolt,   5000, 'completed', t_base+interval '8d',  t_base+interval '15d', cid, t_base+interval '7d'),
    (b05, p_nut,    8000, 'completed', t_base+interval '12d', t_base+interval '18d', cid, t_base+interval '11d'),
    (b06, p_gate,    120, 'completed', t_base+interval '18d', t_base+interval '26d', cid, t_base+interval '17d'),
    (b07, p_mccb,    200, 'completed', t_base+interval '22d', t_base+interval '30d', cid, t_base+interval '21d'),
    (b08, p_vfd,      75, 'completed', t_base+interval '30d', t_base+interval '40d', cid, t_base+interval '29d'),
    (b09, p_gear,    300, 'completed', t_base+interval '38d', t_base+interval '46d', cid, t_base+interval '37d'),
    (b10, p_flange,  500, 'completed', t_base+interval '45d', t_base+interval '52d', cid, t_base+interval '44d'),
    (b11, p_helmet,  1200,'completed', t_base+interval '50d', t_base+interval '56d', cid, t_base+interval '49d'),
    -- In-progress orders (for pipeline chart)
    (b12, p_bolt,   3000, 'in_progress', t_base+interval '82d', NULL, cid, t_base+interval '81d'),
    (b13, p_gate,    180, 'in_progress', t_base+interval '85d', NULL, cid, t_base+interval '84d'),
    (b14, p_vfd,      60, 'in_progress', t_base+interval '87d', NULL, cid, t_base+interval '86d'),
    -- Pending orders
    (b15, p_mccb,    250, 'pending', NULL, NULL, cid, t_base+interval '88d')
  ON CONFLICT DO NOTHING;

  -- ── Supporting QC results (batch_qc_results) ──────────────────
  -- Mixed pass/fail/hold across supporting batches + recent ones
  INSERT INTO batch_qc_results (batch_id, status, inspector_name, notes, inspected_at, company_id, created_at) VALUES
    (b04, 'pass', 'Khalid Al-Rashidi',  'Dimensional check on 50-unit sample: all within ±0.05 mm spec. Thread gauge GO/NO-GO: PASS. Tensile test 5 samples: 870 MPa avg (min 830 MPa). Batch cleared.', t_base+interval '16d', cid, t_base+interval '16d'),
    (b05, 'pass', 'Mohammed Al-Harbi',  'All 8000 nuts: pitch gauge PASS. Hardness 241 HB (spec 225–275 HB). Plating thickness 8 μm avg (min 5 μm). Certificate issued.', t_base+interval '19d', cid, t_base+interval '19d'),
    (b06, 'pass', 'Sara Al-Qahtani',    'Gate valve pressure test 1.5× WP: PASS. Seat leakage nil. Handwheel torque 32 Nm (spec ≤40 Nm). All 120 units certified.', t_base+interval '27d', cid, t_base+interval '27d'),
    (b07, 'pass', 'Omar Al-Shamrani',   'MCCB trip test at 10× rated: 28 ms avg (spec ≤30 ms). Insulation resistance >500 MΩ. All 200 units pass IEC 60947-2.', t_base+interval '31d', cid, t_base+interval '31d'),
    (b08, 'fail', 'Ahmed Al-Mutairi',   'VFD batch failed EMC pre-compliance test: conducted emissions 12 dB above EN 55011 Class A limit at 150 kHz. Root cause: PCB layout error in EMC filter stage. Batch quarantined. Engineering review initiated.', t_base+interval '41d', cid, t_base+interval '41d'),
    (b09, 'pass', 'Khalid Al-Rashidi',  'Gear pump: volumetric efficiency 95.2% (spec ≥93%). Pressure test 375 bar (1.5× WP 250 bar): PASS. Noise test 68 dB(A) (spec ≤72 dB(A)). Batch cleared.', t_base+interval '47d', cid, t_base+interval '47d'),
    (b10, 'hold', 'Sara Al-Qahtani',    'Flange facing surface finish Ra 3.6 μm on 12/500 units (spec Ra ≤3.2 μm). Non-critical lot placed on QC hold. Rework of 12 units authorised. Re-inspection within 72 hours.', t_base+interval '53d', cid, t_base+interval '53d'),
    (b11, 'pass', 'Abdullah Al-Zahrani','Helmet impact absorption: max 3.5 kN (spec ≤5 kN per EN 397). Penetration resistance: PASS. Chin strap hold: PASS. All 1200 units certified.', t_base+interval '57d', cid, t_base+interval '57d'),
    -- Recent QC results in the last 7 days (for Weekly Inspections KPI)
    (b04, 'pass', 'Noor Al-Hamdan',     'Re-inspection sample audit: 20 random units from stored batch — all within spec. Clearance for shipment confirmed.', now()-interval '5d', cid, now()-interval '5d'),
    (b12, 'pass', 'Mohammed Al-Harbi',  'In-process check at 50% completion: thread form, hardness, and dimensional within spec. Continue production.', now()-interval '3d', cid, now()-interval '3d'),
    (b13, 'hold', 'Ahmed Al-Mutairi',   'In-process check: 3/20 sample gate valve seats show minor pitting. Batch placed on hold for rework assessment. Not a safety issue.', now()-interval '1d', cid, now()-interval '1d')
  ON CONFLICT DO NOTHING;

  -- ── Supporting quality inspections (spread last 7 days for trend) ──
  -- These populate the QC Trend chart on the dashboard
  INSERT INTO quality_inspections (batch_id, inspector_id, inspector_name, inspection_date, inspection_type, status, overall_score, notes, company_id, created_at, updated_at) VALUES
    (b04::text, 'INS-001', 'Khalid Al-Rashidi',   (now()-interval '6d')::date, 'final',    'passed',      94.0, 'Sample audit on stored batch. All critical dimensions within spec.', cid, now()-interval '6d', now()-interval '6d'),
    (b09::text, 'INS-001', 'Khalid Al-Rashidi',   (now()-interval '6d')::date, 'random',   'passed',      91.5, 'Random post-production check. Efficiency and pressure tests PASS.', cid, now()-interval '6d', now()-interval '6d'),
    (b05::text, 'INS-002', 'Mohammed Al-Harbi',   (now()-interval '5d')::date, 'incoming', 'passed',      88.0, 'Incoming inspection on stainless nut bulk stock. Dimensional PASS.', cid, now()-interval '5d', now()-interval '5d'),
    (b10::text, 'INS-004', 'Sara Al-Qahtani',     (now()-interval '4d')::date, 'in_process','conditional',74.0, 'Surface finish non-conformance on 12 flanges. Corrective rework authorised.', cid, now()-interval '4d', now()-interval '4d'),
    (b12::text, 'INS-002', 'Mohammed Al-Harbi',   (now()-interval '3d')::date, 'in_process','passed',      92.0, 'In-process check at 50% production. Thread profile and hardness within spec.', cid, now()-interval '3d', now()-interval '3d'),
    (b07::text, 'INS-005', 'Omar Al-Shamrani',    (now()-interval '3d')::date, 'final',    'passed',      96.0, 'Final MCCB trip test and insulation resistance PASS per IEC 60947-2.', cid, now()-interval '3d', now()-interval '3d'),
    (b13::text, 'INS-003', 'Ahmed Al-Mutairi',    (now()-interval '2d')::date, 'in_process','conditional',68.0, 'Seat pitting on 3/20 sample. Hold applied. Rework assessment in progress.', cid, now()-interval '2d', now()-interval '2d'),
    (b11::text, 'INS-007', 'Abdullah Al-Zahrani', (now()-interval '1d')::date, 'random',   'passed',      98.5, 'Random audit on certified helmet batch. Impact and penetration retest: PASS.', cid, now()-interval '1d', now()-interval '1d'),
    (b14::text, 'INS-001', 'Khalid Al-Rashidi',   current_date,               'incoming', 'pending',     0.0,  'Lab results pending for EMC compliance. Estimated 48h. Batch tagged — do not ship.', cid, now(), now())
  ON CONFLICT DO NOTHING;

  -- ── Supporting sales records (for revenue trend / pipeline charts) ──
  INSERT INTO sales (product_id, product_name, quantity, unit_price, total_price, customer_name, status, sold_at, company_id, created_at) VALUES
    (p_bolt,   'Steel Hex Bolt M12x80 Grade 8.8',  2000, 4.50,    9000.00,   'Saudi Electricity Company', 'completed', t_base+interval '20d', cid, t_base+interval '20d'),
    (p_nut,    'Stainless Hex Nut M12 DIN 934',    3500, 1.80,    6300.00,   'Al Rajhi Industrial',       'completed', t_base+interval '22d', cid, t_base+interval '22d'),
    (p_gate,   'Gate Valve DN50 PN16 Carbon Steel',  60, 1250.00, 75000.00,  'SABIC Manufacturing',       'completed', t_base+interval '30d', cid, t_base+interval '30d'),
    (p_mccb,   'MCCB 3-Pole 250A Fixed Mount',      100, 890.00,  89000.00,  'Zahran Maintenance Co.',    'completed', t_base+interval '35d', cid, t_base+interval '35d'),
    (p_gear,   'Gear Pump 16cc 250 bar Hydraulic',  150, 620.00,  93000.00,  'Consolidated Contractors',  'completed', t_base+interval '50d', cid, t_base+interval '50d'),
    (p_flange, 'Weld Neck Flange DN80 PN40',        200, 380.00,  76000.00,  'Bakr Group Engineering',    'completed', t_base+interval '55d', cid, t_base+interval '55d'),
    (p_helmet, 'Safety Helmet Class G EN397 White', 600, 45.00,   27000.00,  'Red Sea Housing Services',  'completed', t_base+interval '60d', cid, t_base+interval '60d'),
    (p_bolt,   'Steel Hex Bolt M12x80 Grade 8.8',  4000, 4.50,   18000.00,  'Rawabi Holding Group',      'completed', t_base+interval '65d', cid, t_base+interval '65d'),
    (p_nut,    'Stainless Hex Nut M12 DIN 934',    5000, 1.80,    9000.00,   'Kingdom Contracting Est.',  'completed', t_base+interval '68d', cid, t_base+interval '68d'),
    (p_gate,   'Gate Valve DN50 PN16 Carbon Steel',  90, 1280.00,115200.00,  'Tasnee Petrochemicals',     'completed', t_base+interval '72d', cid, t_base+interval '72d'),
    (p_vfd,    'Variable Frequency Drive 7.5kW',     35, 3200.00,112000.00,  'Saudi Kayan Petrochemical', 'completed', t_base+interval '75d', cid, t_base+interval '75d'),
    (p_bolt,   'Steel Hex Bolt M12x80 Grade 8.8',  6000, 4.60,   27600.00,  'Maaden Mining Co.',         'completed', t_base+interval '80d', cid, t_base+interval '80d'),
    -- Pending and recent
    (p_gate,   'Gate Valve DN50 PN16 Carbon Steel', 180, 1250.00,225000.00,  'Saudi Aramco',              'pending',   t_base+interval '86d', cid, t_base+interval '86d'),
    (p_vfd,    'Variable Frequency Drive 7.5kW',     60, 3150.00,189000.00,  'SABIC Manufacturing',       'pending',   t_base+interval '88d', cid, t_base+interval '88d'),
    (p_bolt,   'Steel Hex Bolt M12x80 Grade 8.8',  1200, 4.50,    5400.00,  'Sipchem Jubail',            'completed', now()-interval '4d',   cid, now()-interval '4d'),
    (p_gate,   'Gate Valve DN50 PN16 Carbon Steel',  30, 1290.00, 38700.00, 'Dar Al-Riyadh Consultants', 'completed', now()-interval '2d',   cid, now()-interval '2d')
  ON CONFLICT DO NOTHING;

  -- ── Supporting scan events (for Scan Activity chart, Most Scanned) ──
  -- Scans for supporting batches spread across recent days
  FOR i IN 1..8 LOOP
    INSERT INTO scan_events (batch_id, scanned_at, device_type, browser, user_agent, company_id)
    VALUES (
      b04,
      now() - ((i * 0.8) || ' days')::interval,
      CASE WHEN i % 2 = 0 THEN 'desktop' ELSE 'mobile' END,
      (ARRAY['Chrome','Safari','Chrome'])[1 + (i % 3)],
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1',
      cid
    );
  END LOOP;

  FOR i IN 1..6 LOOP
    INSERT INTO scan_events (batch_id, scanned_at, device_type, browser, user_agent, company_id)
    VALUES (
      b09,
      now() - ((i * 1.1) || ' days')::interval,
      'mobile', 'Chrome',
      'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 Chrome/122.0.6261.119 Mobile Safari/537.36',
      cid
    );
  END LOOP;

  FOR i IN 1..5 LOOP
    INSERT INTO scan_events (batch_id, scanned_at, device_type, browser, user_agent, company_id)
    VALUES (
      b06,
      now() - ((i * 1.3) || ' days')::interval,
      CASE WHEN i % 2 = 0 THEN 'mobile' ELSE 'desktop' END,
      'Safari',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
      cid
    );
  END LOOP;

  -- ═══════════════════════════════════════════════════════════════
  -- 7. ACTIVITY LOGS (for the Activity Feed on the dashboard)
  -- ═══════════════════════════════════════════════════════════════

  INSERT INTO activity_logs (company_id, actor_user_id, actor_email, action_type, entity_type, entity_id, message, created_at)
  VALUES
    (cid, uid, 'qa@company.sa',        'recall.created',           'recall',           recall_01::text, 'Voluntary recall initiated for Safety Relief Valve batch VSR-05-010. SFDA notification filed.', t3+interval '25d'),
    (cid, uid, 'qa@company.sa',        'capa.created',             'capa',             capa_01::text,   'CAPA opened: Critical hardness non-conformance on Hydraulic Cylinder batch HPC-2025-080.', t2+interval '8d'),
    (cid, uid, 'ops@company.sa',       'production_order.created', 'production_order', batch_01::text,  'Production order created: 250 × Ball Valve 2in 316 SS.', t1),
    (cid, uid, 'qa@company.sa',        'qc_result.added',          'production_order', batch_01::text,  'QC PASS: Ball Valve batch VBC-2IN-316. Certificate CC-2025-0891 issued. Cleared for shipment.', t1+interval '9d'),
    (cid, uid, 'ops@company.sa',       'production_order.created', 'production_order', batch_02::text,  'Production order created: 80 × Hydraulic Cylinder HPC-50-200.', t2),
    (cid, uid, 'qa@company.sa',        'qc_result.added',          'production_order', batch_02::text,  'QC FAIL: Hydraulic Cylinder batch HPC-2025-080. 80 units quarantined. NCR-2025-0041 raised.', t2+interval '8d'),
    (cid, uid, 'qa@company.sa',        'capa.status_changed',      'capa',             capa_01::text,   'CAPA CAPA-2025-0001 advanced to Corrective Action stage. Supplier NCR issued. Replacement lot sourced.', t2+interval '18d'),
    (cid, uid, 'qa@company.sa',        'capa.closed',              'capa',             capa_01::text,   'CAPA CAPA-2025-0001 closed. Verification complete. Replacement lot passed 100% hardness test.', t2+interval '42d'),
    (cid, uid, 'ops@company.sa',       'production_order.created', 'production_order', batch_03::text,  'Production order created: 150 × Safety Relief Valve VSR-05-010.', t3),
    (cid, uid, 'qa@company.sa',        'qc_result.added',          'production_order', batch_03::text,  'QC PASS: Safety Relief Valve batch 2025-Q1-003. All 150 units certified at ambient temperature.', t3+interval '7d'),
    (cid, uid, 'ops@company.sa',       'production_order.created', 'production_order', b12::text,       'Production order created: 3,000 × Steel Hex Bolt M12 Grade 8.8.', t_base+interval '81d'),
    (cid, uid, 'warehouse@company.sa', 'qc_result.added',          'production_order', b13::text,       'QC HOLD: Gate Valve batch. 3/20 sample units show seat pitting. Rework assessment initiated.', now()-interval '1d'),
    (cid, uid, 'qa@company.sa',        'recall.created',           'recall',           recall_02::text, 'Precautionary hold: Bolt batch IFB-2025-Q2-007. Saudi Aramco thread deviation report under investigation.', now()-interval '8d'),
    (cid, uid, 'qa@company.sa',        'capa.created',             'capa',             capa_03::text,   'CAPA opened: Thread form deviation investigation for Bolt batch IFB-2025-Q2-007.', now()-interval '8d'),
    (cid, uid, 'qa@company.sa',        'capa.created',             'capa',             capa_04::text,   'CAPA opened: Supplier documentation gap — missing SFDA import cert for LOT-SS316-0891.', now()-interval '14d')
  ON CONFLICT DO NOTHING;

  RAISE NOTICE '=== Lifecycle Demo Seed Complete ===';
  RAISE NOTICE 'Story 1 (Ball Valve — complete lifecycle): batch_01 = %', batch_01;
  RAISE NOTICE 'Story 2 (Hydraulic Cylinder — QC Fail → CAPA): batch_02 = %', batch_02;
  RAISE NOTICE 'Story 3 (Safety Relief Valve — Recall): batch_03 = %', batch_03;
  RAISE NOTICE 'Active Recall: recall_02 = %', recall_02;
  RAISE NOTICE 'Open CAPAs: capa_03, capa_04';
  RAISE NOTICE 'To view Story 1 Product Journey, navigate to: /trace/%', batch_01;

END;
$$;
