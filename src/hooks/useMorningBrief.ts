import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { CaseDocumentExtended } from '@/types/documents';

export interface ReadinessScore {
  total: number;
  breakdown: {
    documents_present: { score: number; max: number; details: string };
    approved_by_senior: { score: number; max: number; details: string };
    arguments_present: { score: number; max: number; details: string };
    recently_updated: { score: number; max: number; details: string };
  };
  level: 'safe' | 'review' | 'senior_required';
  levelLabel: string;
}

export interface MorningBriefCase {
  id: string;
  case_number: string;
  court_location: string;
  court_room_no: string;
  item_no: number;
  date: string;
  petitioner: string | null;
  respondent: string | null;
  status: string;
  judge_names: string | null;
  matched_as: 'petitioner' | 'respondent' | null;
  case_fingerprint: string | null;
  
  // Computed fields
  readiness: ReadinessScore;
  hasHistory: boolean;
  previousAppearances: number;
  
  // Post-court capture indicator
  lastHearingCaptured: boolean;
  lastCaptureNote?: string;
  
  // Risk flags
  risks: {
    missing_documents: boolean;
    pending_review: boolean;
    low_readiness: boolean;
    late_listed: boolean;
  };
  
  // Suggestion
  suggestion: 'attend' | 'delegate' | 'monitor';
  suggestionReason: string;
  
  // Related data
  documents: CaseDocumentExtended[];
  argumentCount: number;
}

export interface MorningBrief {
  generated_at: string;
  total_cases: number;
  cases: MorningBriefCase[];
  summary: {
    attend_count: number;
    delegate_count: number;
    monitor_count: number;
    high_risk_count: number;
  };
}

// Calculate readiness score for a case
function calculateReadiness(
  documents: CaseDocumentExtended[],
  argumentCount: number,
  lastUpdated: string | null
): ReadinessScore {
  const breakdown: ReadinessScore['breakdown'] = {
    documents_present: { score: 0, max: 40, details: '' },
    approved_by_senior: { score: 0, max: 30, details: '' },
    arguments_present: { score: 0, max: 20, details: '' },
    recently_updated: { score: 0, max: 10, details: '' },
  };

  // Check documents present
  const requiredTypes = ['PETITION', 'REPLY'];
  const presentTypes = documents.filter((d) => 
    d.document_type && requiredTypes.includes(d.document_type)
  );
  if (presentTypes.length >= 2) {
    breakdown.documents_present.score = 40;
    breakdown.documents_present.details = 'All required documents present';
  } else if (presentTypes.length >= 1) {
    breakdown.documents_present.score = 20;
    breakdown.documents_present.details = 'Some documents missing';
  } else if (documents.length > 0) {
    breakdown.documents_present.score = 10;
    breakdown.documents_present.details = 'Only supporting documents';
  } else {
    breakdown.documents_present.details = 'No documents uploaded';
  }

  // Check approved by senior
  const approvedDocs = documents.filter((d) => d.review_status === 'approved');
  if (approvedDocs.length === documents.length && documents.length > 0) {
    breakdown.approved_by_senior.score = 30;
    breakdown.approved_by_senior.details = 'All documents approved';
  } else if (approvedDocs.length > 0) {
    breakdown.approved_by_senior.score = 15;
    breakdown.approved_by_senior.details = `${approvedDocs.length}/${documents.length} approved`;
  } else {
    breakdown.approved_by_senior.details = 'No documents approved yet';
  }

  // Check arguments present
  if (argumentCount >= 3) {
    breakdown.arguments_present.score = 20;
    breakdown.arguments_present.details = `${argumentCount} arguments prepared`;
  } else if (argumentCount > 0) {
    breakdown.arguments_present.score = 10;
    breakdown.arguments_present.details = `Only ${argumentCount} argument(s)`;
  } else {
    breakdown.arguments_present.details = 'No arguments prepared';
  }

  // Check recently updated
  if (lastUpdated) {
    const hoursSinceUpdate = (Date.now() - new Date(lastUpdated).getTime()) / (1000 * 60 * 60);
    if (hoursSinceUpdate <= 24) {
      breakdown.recently_updated.score = 10;
      breakdown.recently_updated.details = 'Updated within 24 hours';
    } else if (hoursSinceUpdate <= 48) {
      breakdown.recently_updated.score = 5;
      breakdown.recently_updated.details = 'Updated within 48 hours';
    } else {
      breakdown.recently_updated.details = 'Not recently updated';
    }
  } else {
    breakdown.recently_updated.details = 'No update timestamp';
  }

  const total = Object.values(breakdown).reduce((sum, b) => sum + b.score, 0);
  
  let level: ReadinessScore['level'];
  let levelLabel: string;
  
  if (total >= 70) {
    level = 'safe';
    levelLabel = 'Safe to delegate';
  } else if (total >= 40) {
    level = 'review';
    levelLabel = 'Review once';
  } else {
    level = 'senior_required';
    levelLabel = 'Senior presence advised';
  }

  return { total, breakdown, level, levelLabel };
}

// PHASE 2.1: Morning Brief Stale Time
const MORNING_BRIEF_STALE_TIME = 60_000; // 60 seconds

// PHASE 2.1: Batch fetch helper to avoid N+1 queries
interface BatchedCaseData {
  documents: Map<string, CaseDocumentExtended[]>;
  argumentCounts: Map<string, number>;
  previousAppearances: Map<string, number>;
  postCourtNotes: Map<string, { what_happened?: string; next_direction?: string }>;
}

async function fetchBatchedCaseData(
  docketIds: string[],
  fingerprints: (string | null)[]
): Promise<BatchedCaseData> {
  const validFingerprints = fingerprints.filter((f): f is string => !!f);
  const today = new Date().toISOString().split('T')[0];

  // PHASE 2.1: Batch all queries in parallel - single request per type
  const [docsResult, argsResult, historyResult, capturesResult] = await Promise.all([
    // Batch documents query
    supabase
      .from('case_documents')
      .select('*')
      .in('docket_id', docketIds),
    
    // Batch argument counts - using RPC or filtering
    supabase
      .from('case_arguments')
      .select('docket_id')
      .in('docket_id', docketIds),
    
    // Batch history counts by fingerprint
    validFingerprints.length > 0
      ? supabase
          .from('daily_court_docket')
          .select('case_fingerprint')
          .in('case_fingerprint', validFingerprints)
          .lt('date', today)
      : Promise.resolve({ data: [] }),
    
    // Batch post-court notes
    validFingerprints.length > 0
      ? supabase
          .from('post_court_notes')
          .select('case_fingerprint, what_happened, next_direction, hearing_date')
          .in('case_fingerprint', validFingerprints)
          .lt('hearing_date', today)
          .order('hearing_date', { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  // Build lookup maps
  const documents = new Map<string, CaseDocumentExtended[]>();
  const argumentCounts = new Map<string, number>();
  const previousAppearances = new Map<string, number>();
  const postCourtNotes = new Map<string, { what_happened?: string; next_direction?: string }>();

  // Process documents
  (docsResult.data || []).forEach((d: any) => {
    if (!d.docket_id) return;
    const doc: CaseDocumentExtended = {
      id: d.id,
      docket_id: d.docket_id || '',
      file_url: d.file_url || '',
      doc_type: d.doc_type,
      uploaded_at: d.uploaded_at || new Date().toISOString(),
      document_type: d.document_type || null,
      version: d.version || 1,
      is_primary: d.is_primary || false,
      pending_review: d.pending_review ?? true,
      language: d.language || 'UNKNOWN',
      format: d.format || 'TYPED',
      legibility: d.legibility || 'CLEAR',
      uploaded_by: d.uploaded_by || null,
      review_status: d.review_status || 'pending',
      reviewed_by: d.reviewed_by || null,
      reviewed_at: d.reviewed_at || null,
    };
    const existing = documents.get(d.docket_id) || [];
    existing.push(doc);
    documents.set(d.docket_id, existing);
  });

  // Process argument counts
  const argsByDocket = new Map<string, number>();
  (argsResult.data || []).forEach((a: any) => {
    if (!a.docket_id) return;
    argsByDocket.set(a.docket_id, (argsByDocket.get(a.docket_id) || 0) + 1);
  });
  argsByDocket.forEach((count, id) => argumentCounts.set(id, count));

  // Process history counts
  const historyByFingerprint = new Map<string, number>();
  ((historyResult as any).data || []).forEach((h: any) => {
    if (!h.case_fingerprint) return;
    historyByFingerprint.set(
      h.case_fingerprint,
      (historyByFingerprint.get(h.case_fingerprint) || 0) + 1
    );
  });
  historyByFingerprint.forEach((count, fp) => previousAppearances.set(fp, count));

  // Process post-court notes (most recent per fingerprint)
  const seenFingerprints = new Set<string>();
  ((capturesResult as any).data || []).forEach((n: any) => {
    if (!n.case_fingerprint || seenFingerprints.has(n.case_fingerprint)) return;
    seenFingerprints.add(n.case_fingerprint);
    postCourtNotes.set(n.case_fingerprint, {
      what_happened: n.what_happened,
      next_direction: n.next_direction,
    });
  });

  return { documents, argumentCounts, previousAppearances, postCourtNotes };
}

// Main Morning Brief hook - PHASE 2.1: N+1 FIX
export function useMorningBrief() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['morning-brief', user?.id],
    queryFn: async (): Promise<MorningBrief> => {
      if (!user) throw new Error('Not authenticated');

      const today = new Date().toISOString().split('T')[0];

      // Get user's aliases for matching
      const { data: aliases } = await supabase
        .from('lawyer_aliases')
        .select('alias_name')
        .eq('profile_id', user.id);

      const aliasNames = aliases?.map((a) => a.alias_name.toLowerCase()) || [];

      // Fetch today's docket for the user
      const { data: docketItems, error: docketError } = await supabase
        .from('daily_court_docket')
        .select('*')
        .eq('date', today)
        .eq('matched_profile_id', user.id)
        .order('item_no', { ascending: true });

      if (docketError) throw docketError;

      // If no matched cases, try to find by aliases
      let cases = docketItems || [];
      if (cases.length === 0 && aliasNames.length > 0) {
        const { data: allTodayCases } = await supabase
          .from('daily_court_docket')
          .select('*')
          .eq('date', today);

        cases = (allTodayCases || []).filter((c) => {
          const petLawyer = c.petitioner_lawyer?.toLowerCase() || '';
          const resLawyer = c.respondent_lawyer?.toLowerCase() || '';
          return aliasNames.some(
            (alias) => petLawyer.includes(alias) || resLawyer.includes(alias)
          );
        });
      }

      // PHASE 2.1: Batch fetch all related data in 1-2 requests instead of N+1
      const docketIds = cases.map(c => c.id);
      const fingerprints = cases.map(c => (c as any).case_fingerprint);
      
      const batchedData = await fetchBatchedCaseData(docketIds, fingerprints);

      // Process cases with batched data
      const briefCases: MorningBriefCase[] = cases.map((docket) => {
        const fingerprint = (docket as any).case_fingerprint;
        const documents = batchedData.documents.get(docket.id) || [];
        const argCount = batchedData.argumentCounts.get(docket.id) || 0;
        const previousAppearances = fingerprint 
          ? batchedData.previousAppearances.get(fingerprint) || 0 
          : 0;
        const postCourtNote = fingerprint 
          ? batchedData.postCourtNotes.get(fingerprint) 
          : undefined;
        
        const lastHearingCaptured = !!postCourtNote;
        const lastCaptureNote = postCourtNote?.next_direction || postCourtNote?.what_happened;

        // Determine matched_as
        const petLawyer = docket.petitioner_lawyer?.toLowerCase() || '';
        const resLawyer = docket.respondent_lawyer?.toLowerCase() || '';
        let matched_as: 'petitioner' | 'respondent' | null = null;
        if (aliasNames.some((a) => petLawyer.includes(a))) matched_as = 'petitioner';
        else if (aliasNames.some((a) => resLawyer.includes(a))) matched_as = 'respondent';

        // Calculate readiness
        const lastDocUpdate = documents.length > 0 
          ? documents.reduce((latest, d) => 
              new Date(d.uploaded_at) > new Date(latest) ? d.uploaded_at : latest,
              documents[0].uploaded_at
            )
          : null;
        const readiness = calculateReadiness(documents, argCount, lastDocUpdate);

        // Calculate risks
        const risks = {
          missing_documents: documents.length === 0,
          pending_review: documents.some((d) => d.review_status === 'pending'),
          low_readiness: readiness.total < 40,
          late_listed: docket.item_no > 20,
        };

        // Determine suggestion
        let suggestion: 'attend' | 'delegate' | 'monitor';
        let suggestionReason: string;

        if (risks.missing_documents || risks.low_readiness) {
          suggestion = 'attend';
          suggestionReason = risks.missing_documents 
            ? 'No documents uploaded - personal attention needed'
            : 'Low preparation level - senior guidance recommended';
        } else if (risks.pending_review) {
          suggestion = 'attend';
          suggestionReason = 'Documents pending review - verify before hearing';
        } else if (readiness.level === 'safe' && !risks.late_listed) {
          suggestion = 'delegate';
          suggestionReason = 'Well prepared case - safe for delegation';
        } else if (risks.late_listed) {
          suggestion = 'monitor';
          suggestionReason = 'Late in list - may be adjourned, monitor board';
        } else {
          suggestion = 'monitor';
          suggestionReason = 'Moderate preparation - keep track of progress';
        }

        return {
          id: docket.id,
          case_number: docket.case_number || 'Unknown',
          court_location: docket.court_location || 'Unknown',
          court_room_no: docket.court_room_no || '',
          item_no: docket.item_no || 0,
          date: docket.date,
          petitioner: docket.petitioner,
          respondent: docket.respondent,
          status: docket.status || 'pending',
          judge_names: docket.judge_names,
          matched_as,
          case_fingerprint: fingerprint,
          readiness,
          hasHistory: previousAppearances > 0,
          previousAppearances,
          lastHearingCaptured,
          lastCaptureNote,
          risks,
          suggestion,
          suggestionReason,
          documents,
          argumentCount: argCount,
        };
      });

      // Sort: high risk first, then by item number
      briefCases.sort((a, b) => {
        const aRiskScore = Object.values(a.risks).filter(Boolean).length;
        const bRiskScore = Object.values(b.risks).filter(Boolean).length;
        if (aRiskScore !== bRiskScore) return bRiskScore - aRiskScore;
        return a.item_no - b.item_no;
      });

      return {
        generated_at: new Date().toISOString(),
        total_cases: briefCases.length,
        cases: briefCases,
        summary: {
          attend_count: briefCases.filter((c) => c.suggestion === 'attend').length,
          delegate_count: briefCases.filter((c) => c.suggestion === 'delegate').length,
          monitor_count: briefCases.filter((c) => c.suggestion === 'monitor').length,
          high_risk_count: briefCases.filter((c) => 
            c.risks.missing_documents || c.risks.low_readiness
          ).length,
        },
      };
    },
    enabled: !!user,
    // PHASE 0.3 & 2.1: Stale time to reduce refetch noise
    staleTime: MORNING_BRIEF_STALE_TIME,
  });
}
