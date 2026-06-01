export interface QualityInspection {
  id: string;
  user_id: string;
  batch_id: string;
  inspector_id: string;
  inspection_date: string;
  inspection_type: 'incoming' | 'in_process' | 'final' | 'random';
  status: 'pending' | 'passed' | 'failed' | 'conditional';
  overall_score: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface QualityDefect {
  id: string;
  inspection_id: string;
  defect_type: string;
  severity: 'minor' | 'major' | 'critical';
  quantity: number;
  description: string | null;
  corrective_action: string | null;
  resolved: boolean;
  resolved_at: string | null;
  created_at: string;
}

export interface QualityMetrics {
  total_inspections: number;
  passed_count:      number;
  pass_rate: number;
  defects_this_month: number;
  average_score: number;
  inspections_by_type: Record<string, number>;
  defects_by_severity: Record<string, number>;
}

// Omit DB-managed fields; user_id is set automatically via DEFAULT auth.uid()
export type InspectionFormData = Omit<QualityInspection, 'id' | 'user_id' | 'created_at' | 'updated_at'>;
export type DefectFormData = Omit<QualityDefect, 'id' | 'created_at'>;
