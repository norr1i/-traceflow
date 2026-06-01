import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';
import {
  QualityInspection, QualityDefect, QualityMetrics,
  InspectionFormData, DefectFormData,
} from '../types/quality';

export const QC_PAGE_SIZE = 50;

// ---------------------------------------------------------------------------
// Derives page-local metrics when the RPC result is unavailable.
// Only used as an intermediate value before the RPC resolves.
// ---------------------------------------------------------------------------
function deriveLocalMetrics(
  inspections: QualityInspection[],
  defects:     QualityDefect[],
): QualityMetrics {
  const total   = inspections.length;
  const passed  = inspections.filter(i => i.status === 'passed').length;
  const now     = new Date();
  const mStart  = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const inspections_by_type: Record<string, number> = {};
  for (const i of inspections) {
    inspections_by_type[i.inspection_type] = (inspections_by_type[i.inspection_type] ?? 0) + 1;
  }
  const defects_by_severity: Record<string, number> = {};
  for (const d of defects) {
    defects_by_severity[d.severity] = (defects_by_severity[d.severity] ?? 0) + 1;
  }

  return {
    total_inspections: total,
    passed_count:      passed,
    pass_rate:         total > 0 ? (passed / total) * 100 : 0,
    average_score:     total > 0
      ? Math.round(inspections.reduce((s, i) => s + (i.overall_score ?? 0), 0) / total)
      : 0,
    defects_this_month: defects.filter(d => d.created_at >= mStart).length,
    inspections_by_type,
    defects_by_severity,
  };
}

function extractMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  return (err as { message?: string })?.message ?? fallback;
}

// Shape returned by the get_qc_aggregate_stats RPC
type QcAggRpc = {
  total_inspections:  number;
  passed_count:       number;
  average_score:      number;
  pass_rate:          number;
  defects_this_month: number;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useQualityInspections() {
  const { companyId } = useAuth();

  const [inspections, setInspections] = useState<QualityInspection[]>([]);
  const [defects,     setDefects]     = useState<QualityDefect[]>([]);
  const [metrics,     setMetrics]     = useState<QualityMetrics | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [page,        setPageState]   = useState(1);
  const [totalCount,  setTotalCount]  = useState(0);

  const totalPages = Math.max(1, Math.ceil(totalCount / QC_PAGE_SIZE));

  // ── Core load: one paginated inspections query + one defects query
  //    + one lightweight RPC for full-company aggregate metrics.
  const load = useCallback(async (pageNum: number) => {
    if (!companyId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const offset = (pageNum - 1) * QC_PAGE_SIZE;

      // Phase 1 — paginated inspections with total count
      const { data: inspData, count, error: inspErr } = await supabase
        .from('quality_inspections')
        .select('*', { count: 'exact' })
        .eq('company_id', companyId)
        .order('inspection_date', { ascending: false })
        .range(offset, offset + QC_PAGE_SIZE - 1);

      if (inspErr) throw inspErr;
      const insp: QualityInspection[] = inspData ?? [];
      setInspections(insp);
      setTotalCount(count ?? 0);

      // Phase 2 — defects for this page's inspection IDs only
      let defs: QualityDefect[] = [];
      const ids = insp.map(i => i.id);
      if (ids.length > 0) {
        const { data: defData, error: defErr } = await supabase
          .from('quality_defects')
          .select('*')
          .in('inspection_id', ids)
          .order('created_at', { ascending: false });

        if (defErr) throw defErr;
        defs = defData ?? [];
      }
      setDefects(defs);

      // Phase 3 — full-company aggregate metrics via RPC
      // Falls back to page-local derivation if the RPC is not yet deployed.
      const { data: agg, error: aggErr } = await supabase
        .rpc('get_qc_aggregate_stats', { p_company_id: companyId });

      if (!aggErr && agg) {
        const r = agg as QcAggRpc;
        setMetrics({
          total_inspections:  r.total_inspections  ?? count ?? insp.length,
          passed_count:       r.passed_count        ?? 0,
          pass_rate:          r.pass_rate            ?? 0,
          average_score:      r.average_score        ?? 0,
          defects_this_month: r.defects_this_month   ?? 0,
          inspections_by_type: {},
          defects_by_severity: {},
        });
      } else {
        // RPC not yet deployed — derive from page data as a temporary fallback
        setMetrics(deriveLocalMetrics(insp, defs));
      }
    } catch (err) {
      setError(extractMessage(err, 'Failed to load QC data'));
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  // Navigate to a specific page and reload
  const goToPage = useCallback((p: number) => {
    setPageState(p);
    load(p);
  }, [load]);

  // Initial load on mount / companyId change
  useEffect(() => { load(1); setPageState(1); }, [load]);

  // ── Mutations: after a write, reload page 1 so the new record is visible ──

  const createInspection = async (data: InspectionFormData): Promise<QualityInspection | null> => {
    if (!companyId) return null;
    const { data: newInspection, error: err } = await supabase
      .from('quality_inspections')
      .insert([{ ...data, company_id: companyId }])
      .select()
      .single();

    if (err) { setError(err.message); return null; }
    setPageState(1);
    await load(1);
    return newInspection;
  };

  const updateInspection = async (id: string, data: Partial<InspectionFormData>): Promise<boolean> => {
    if (!companyId) return false;
    const { error: err } = await supabase
      .from('quality_inspections')
      .update(data)
      .eq('id', id)
      .eq('company_id', companyId);

    if (err) { setError(err.message); return false; }
    await load(page);
    return true;
  };

  const deleteInspection = async (id: string): Promise<boolean> => {
    if (!companyId) return false;
    const { error: err } = await supabase
      .from('quality_inspections')
      .delete()
      .eq('id', id)
      .eq('company_id', companyId);

    if (err) { setError(err.message); return false; }
    // If deleting the last item on the current page, go to the previous page
    const nextPage = inspections.length === 1 && page > 1 ? page - 1 : page;
    setPageState(nextPage);
    await load(nextPage);
    return true;
  };

  const createDefect = async (data: DefectFormData): Promise<QualityDefect | null> => {
    const { data: newDefect, error: err } = await supabase
      .from('quality_defects')
      .insert([data])
      .select()
      .single();

    if (err) { setError(err.message); return null; }
    setDefects(prev => [newDefect, ...prev]);
    return newDefect;
  };

  const resolveDefect = async (id: string, corrective_action: string): Promise<boolean> => {
    const { error: err } = await supabase
      .from('quality_defects')
      .update({ resolved: true, resolved_at: new Date().toISOString(), corrective_action })
      .eq('id', id);

    if (err) { setError(err.message); return false; }
    setDefects(prev => prev.map(d =>
      d.id === id ? { ...d, resolved: true, resolved_at: new Date().toISOString(), corrective_action } : d
    ));
    return true;
  };

  return {
    inspections,
    defects,
    metrics,
    loading,
    error,
    page,
    totalCount,
    totalPages,
    goToPage,
    createInspection,
    updateInspection,
    deleteInspection,
    createDefect,
    resolveDefect,
    refresh: () => load(page),
  };
}
