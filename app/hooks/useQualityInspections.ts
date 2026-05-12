// app/hooks/useQualityInspections.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { QualityInspection, QualityDefect, QualityMetrics, InspectionFormData, DefectFormData } from '../types/quality';

export function useQualityInspections() {
  const [inspections, setInspections] = useState<QualityInspection[]>([]);
  const [defects, setDefects] = useState<QualityDefect[]>([]);
  const [metrics, setMetrics] = useState<QualityMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInspections = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('quality_inspections')
        .select('*')
        .order('inspection_date', { ascending: false });

      if (fetchError) throw fetchError;
      setInspections(data || []);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : (err as { message?: string })?.message ?? 'Failed to fetch inspections';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDefects = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('quality_defects')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setDefects(data || []);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : (err as { message?: string })?.message ?? 'Failed to fetch defects';
      setError(message);
    }
  }, []);

  const fetchMetrics = useCallback(async () => {
    try {
      const { data } = await supabase.from('quality_inspections').select('*');
      const allInspections = data || [];

      const passed = allInspections.filter((i) => i.status === 'passed').length;

      setMetrics({
        total_inspections: allInspections.length,
        pass_rate: allInspections.length > 0 ? (passed / allInspections.length) * 100 : 0,
        defects_this_month: 0,
        average_score: 0,
        inspections_by_type: {},
        defects_by_severity: {},
      });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : (err as { message?: string })?.message ?? 'Failed to fetch metrics';
      setError(message);
    }
  }, []);

  const createInspection = async (data: InspectionFormData): Promise<QualityInspection | null> => {
    const { data: newInspection, error } = await supabase
      .from('quality_inspections')
      .insert([data])
      .select()
      .single();

    if (error) {
      setError(error.message);
      return null;
    }

    setInspections((prev) => [newInspection, ...prev]);
    fetchMetrics();
    return newInspection;
  };

  const updateInspection = async (id: string, data: Partial<InspectionFormData>): Promise<boolean> => {
    const { error } = await supabase
      .from('quality_inspections')
      .update(data)
      .eq('id', id);

    if (error) {
      setError(error.message);
      return false;
    }

    setInspections((prev) =>
      prev.map((i) => (i.id === id ? { ...i, ...data } : i))
    );
    fetchMetrics();
    return true;
  };

  const deleteInspection = async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from('quality_inspections')
      .delete()
      .eq('id', id);

    if (error) {
      setError(error.message);
      return false;
    }

    setInspections((prev) => prev.filter((i) => i.id !== id));
    fetchMetrics();
    return true;
  };

  const createDefect = async (data: DefectFormData): Promise<QualityDefect | null> => {
    const { data: newDefect, error } = await supabase
      .from('quality_defects')
      .insert([data])
      .select()
      .single();

    if (error) {
      setError(error.message);
      return null;
    }

    setDefects((prev) => [newDefect, ...prev]);
    fetchMetrics();
    return newDefect;
  };

  const resolveDefect = async (id: string, corrective_action: string): Promise<boolean> => {
    const { error } = await supabase
      .from('quality_defects')
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
        corrective_action,
      })
      .eq('id', id);

    if (error) {
      setError(error.message);
      return false;
    }

    setDefects((prev) =>
      prev.map((d) =>
        d.id === id
          ? { ...d, resolved: true, resolved_at: new Date().toISOString(), corrective_action }
          : d
      )
    );
    fetchMetrics();
    return true;
  };

  useEffect(() => {
    Promise.all([
      supabase.from('quality_inspections').select('*').order('inspection_date', { ascending: false }),
      supabase.from('quality_defects').select('*').order('created_at', { ascending: false }),
      supabase.from('quality_inspections').select('*'),
    ]).then(([{ data: inspData, error: inspErr }, { data: defData }, { data: allInsp }]) => {
      if (inspErr) setError(inspErr.message);
      setInspections(inspData ?? []);
      setDefects(defData ?? []);
      const all = allInsp ?? [];
      const passed = all.filter((i: { status: string }) => i.status === 'passed').length;
      setMetrics({
        total_inspections: all.length,
        pass_rate: all.length > 0 ? (passed / all.length) * 100 : 0,
        defects_this_month: 0,
        average_score: 0,
        inspections_by_type: {},
        defects_by_severity: {},
      });
      setLoading(false);
    });
  }, []);

  return {
    inspections,
    defects,
    metrics,
    loading,
    error,
    createInspection,
    updateInspection,
    deleteInspection,
    createDefect,
    resolveDefect,
    refresh: () => {
      fetchInspections();
      fetchDefects();
      fetchMetrics();
    },
  };
}