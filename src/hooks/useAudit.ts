import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type AuditScope = 'release' | 'feature' | 'full-system';
export type AuditStatus = 'pass' | 'conditional' | 'fail';
export type GoDecision = 'go' | 'conditional_go' | 'no_go';
export type AuditDimension = 
  | 'user_experience'
  | 'role_permissions'
  | 'product_coherence'
  | 'system_failure'
  | 'operator_readiness'
  | 'business_liability';
export type FindingSeverity = 'low' | 'medium' | 'high' | 'critical';
export type FindingStatus = 'open' | 'acknowledged' | 'fixed';
export type RiskType = 'ux' | 'trust' | 'operational' | 'legal' | 'scale';

export interface AuditRun {
  id: string;
  audit_name: string;
  audit_scope: AuditScope;
  conducted_by: string;
  started_at: string;
  completed_at: string | null;
  overall_status: AuditStatus | null;
  go_decision: GoDecision | null;
  go_justification: string | null;
  notes: string | null;
  created_at: string;
}

export interface AuditFinding {
  id: string;
  audit_run_id: string;
  dimension: AuditDimension;
  area: string;
  issue: string;
  severity: FindingSeverity;
  recommendation: string | null;
  status: FindingStatus;
  verified_feature: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditRisk {
  id: string;
  audit_run_id: string;
  risk_type: RiskType;
  description: string;
  impact: string;
  mitigation: string | null;
  severity: FindingSeverity;
  created_at: string;
}

export function useAuditRuns() {
  return useQuery({
    queryKey: ['audit-runs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_runs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as AuditRun[];
    },
  });
}

export function useAuditRun(id: string | undefined) {
  return useQuery({
    queryKey: ['audit-run', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('audit_runs')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as AuditRun;
    },
    enabled: !!id,
  });
}

export function useAuditFindings(auditRunId: string | undefined) {
  return useQuery({
    queryKey: ['audit-findings', auditRunId],
    queryFn: async () => {
      if (!auditRunId) return [];
      const { data, error } = await supabase
        .from('audit_findings')
        .select('*')
        .eq('audit_run_id', auditRunId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as AuditFinding[];
    },
    enabled: !!auditRunId,
  });
}

export function useAuditRisks(auditRunId: string | undefined) {
  return useQuery({
    queryKey: ['audit-risks', auditRunId],
    queryFn: async () => {
      if (!auditRunId) return [];
      const { data, error } = await supabase
        .from('audit_risks')
        .select('*')
        .eq('audit_run_id', auditRunId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as AuditRisk[];
    },
    enabled: !!auditRunId,
  });
}

export function useCreateAuditRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      audit_name: string;
      audit_scope: AuditScope;
      conducted_by: string;
    }) => {
      const { data: result, error } = await supabase
        .from('audit_runs')
        .insert({
          audit_name: data.audit_name,
          audit_scope: data.audit_scope,
          conducted_by: data.conducted_by,
        })
        .select()
        .single();

      if (error) throw error;
      return result as AuditRun;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit-runs'] });
      toast.success('Audit run started');
    },
    onError: (error) => {
      toast.error('Failed to create audit run: ' + error.message);
    },
  });
}

export function useUpdateAuditRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      updates: Partial<Omit<AuditRun, 'id' | 'created_at'>>;
    }) => {
      const { data: result, error } = await supabase
        .from('audit_runs')
        .update(data.updates)
        .eq('id', data.id)
        .select()
        .single();

      if (error) throw error;
      return result as AuditRun;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['audit-runs'] });
      queryClient.invalidateQueries({ queryKey: ['audit-run', data.id] });
    },
    onError: (error) => {
      toast.error('Failed to update audit run: ' + error.message);
    },
  });
}

export function useCreateAuditFinding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      audit_run_id: string;
      dimension: AuditDimension;
      area: string;
      issue: string;
      severity: FindingSeverity;
      recommendation?: string;
      verified_feature?: string;
    }) => {
      const { data: result, error } = await supabase
        .from('audit_findings')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result as AuditFinding;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['audit-findings', data.audit_run_id] });
      toast.success('Finding logged');
    },
    onError: (error) => {
      toast.error('Failed to log finding: ' + error.message);
    },
  });
}

export function useUpdateAuditFinding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      audit_run_id: string;
      updates: Partial<Omit<AuditFinding, 'id' | 'created_at' | 'audit_run_id'>>;
    }) => {
      const { data: result, error } = await supabase
        .from('audit_findings')
        .update(data.updates)
        .eq('id', data.id)
        .select()
        .single();

      if (error) throw error;
      return { result: result as AuditFinding, audit_run_id: data.audit_run_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['audit-findings', data.audit_run_id] });
    },
    onError: (error) => {
      toast.error('Failed to update finding: ' + error.message);
    },
  });
}

export function useDeleteAuditFinding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { id: string; audit_run_id: string }) => {
      const { error } = await supabase
        .from('audit_findings')
        .delete()
        .eq('id', data.id);

      if (error) throw error;
      return data.audit_run_id;
    },
    onSuccess: (audit_run_id) => {
      queryClient.invalidateQueries({ queryKey: ['audit-findings', audit_run_id] });
      toast.success('Finding deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete finding: ' + error.message);
    },
  });
}

export function useCreateAuditRisk() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      audit_run_id: string;
      risk_type: RiskType;
      description: string;
      impact: string;
      severity: FindingSeverity;
      mitigation?: string;
    }) => {
      const { data: result, error } = await supabase
        .from('audit_risks')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result as AuditRisk;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['audit-risks', data.audit_run_id] });
      toast.success('Risk logged');
    },
    onError: (error) => {
      toast.error('Failed to log risk: ' + error.message);
    },
  });
}

export function useDeleteAuditRisk() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { id: string; audit_run_id: string }) => {
      const { error } = await supabase
        .from('audit_risks')
        .delete()
        .eq('id', data.id);

      if (error) throw error;
      return data.audit_run_id;
    },
    onSuccess: (audit_run_id) => {
      queryClient.invalidateQueries({ queryKey: ['audit-risks', audit_run_id] });
      toast.success('Risk deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete risk: ' + error.message);
    },
  });
}

export function useDeleteAuditRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('audit_runs')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit-runs'] });
      toast.success('Audit run deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete audit run: ' + error.message);
    },
  });
}
