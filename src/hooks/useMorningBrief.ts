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

// Main Morning Brief hook
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

      // For each case, fetch documents, arguments, and history
      const briefCases: MorningBriefCase[] = await Promise.all(
        cases.map(async (docket) => {
          // Fetch documents
          const { data: docs } = await supabase
            .from('case_documents')
            .select('*')
            .eq('docket_id', docket.id);

          const documents: CaseDocumentExtended[] = (docs || []).map((d) => ({
            id: d.id,
            docket_id: d.docket_id || '',
            file_url: d.file_url || '',
            doc_type: d.doc_type,
            uploaded_at: d.uploaded_at || new Date().toISOString(),
            document_type: (d as any).document_type || null,
            version: (d as any).version || 1,
            is_primary: (d as any).is_primary || false,
            pending_review: (d as any).pending_review ?? true,
            language: (d as any).language || 'UNKNOWN',
            format: (d as any).format || 'TYPED',
            legibility: (d as any).legibility || 'CLEAR',
            uploaded_by: (d as any).uploaded_by || null,
            review_status: (d as any).review_status || 'pending',
            reviewed_by: (d as any).reviewed_by || null,
            reviewed_at: (d as any).reviewed_at || null,
          }));

          // Fetch argument count
          const { count: argCount } = await supabase
            .from('case_arguments')
            .select('*', { count: 'exact', head: true })
            .eq('docket_id', docket.id);

          // Check history and post-court captures
          const fingerprint = (docket as any).case_fingerprint;
          let previousAppearances = 0;
          let lastHearingCaptured = false;
          let lastCaptureNote: string | undefined;
          
          if (fingerprint) {
            const { count } = await supabase
              .from('daily_court_docket')
              .select('*', { count: 'exact', head: true })
              .eq('case_fingerprint', fingerprint)
              .lt('date', today);
            previousAppearances = count || 0;
            
            // Check for recent post-court capture (yesterday or before)
            const { data: recentCapture } = await supabase
              .from('post_court_notes')
              .select('what_happened, next_direction')
              .eq('case_fingerprint', fingerprint)
              .lt('hearing_date', today)
              .order('hearing_date', { ascending: false })
              .limit(1)
              .maybeSingle();
            
            if (recentCapture) {
              lastHearingCaptured = true;
              lastCaptureNote = recentCapture.next_direction || recentCapture.what_happened || undefined;
            }
          }

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
          const readiness = calculateReadiness(documents, argCount || 0, lastDocUpdate);

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
            argumentCount: argCount || 0,
          };
        })
      );

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
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
