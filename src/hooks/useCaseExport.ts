/**
 * useCaseExport Hook
 * 
 * Fetches and prepares case data for lawyer profile exports.
 * Enforces role-based access (SENIOR, JUNIOR own profile; ADMIN audit access).
 * 
 * DEFAULT: Export only TODAY's cases (same date logic as Today tab)
 * OPTIONAL: Export by custom date range when explicitly selected
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, parseISO, startOfDay } from 'date-fns';
import type { ExportCase, ExportGroup, ExportData, AdvocateRole, ExportDateMode, ListingStatus } from '@/types/export';

interface UseCaseExportOptions {
  dateMode: ExportDateMode; // 'today' (default) or 'range'
  dateRangeStart?: Date;
  dateRangeEnd?: Date;
  targetUserId?: string; // For admin audit access
}


function formatDateRange(firstDate: string, lastDate: string): string {
  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'dd MMM yyyy');
    } catch {
      return dateStr;
    }
  };
  
  if (firstDate === lastDate) {
    return formatDate(firstDate);
  }
  return `${formatDate(firstDate)} → ${formatDate(lastDate)}`;
}


export function useCaseExport(options: UseCaseExportOptions) {
  const { user, role, isAuthenticated } = useAuth();
  const { dateMode, dateRangeStart, dateRangeEnd, targetUserId } = options;
  
  // Determine which user's data to fetch
  const userId = targetUserId || user?.id;
  
  // Permission check: SENIOR/JUNIOR own profile, ADMIN can view any
  const canExport = isAuthenticated && (
    (role === 'SENIOR' && userId === user?.id) ||
    (role === 'JUNIOR' && userId === user?.id) ||
    (role === 'ADMIN')
  );
  
  // Calculate effective dates based on mode
  const today = format(startOfDay(new Date()), 'yyyy-MM-dd');
  const effectiveStart = dateMode === 'today' ? today : (dateRangeStart ? format(dateRangeStart, 'yyyy-MM-dd') : undefined);
  const effectiveEnd = dateMode === 'today' ? today : (dateRangeEnd ? format(dateRangeEnd, 'yyyy-MM-dd') : undefined);
  
  // Validate range mode has both dates
  const isValidRange = dateMode === 'today' || (dateRangeStart && dateRangeEnd);
  
  // Fetch cases with all appearances grouped by case_fingerprint
  type DocketRow = {
    id: string;
    case_number: string | null;
    item_no: number | null;
    court_room_no: string | null;
    judge_names: string | null;
    matched_role: string | null;
    status: string | null;
    date: string;
    case_fingerprint: string | null;
    petitioner: string | null;
    respondent: string | null;
    petitioner_lawyer: string | null;
    respondent_lawyer: string | null;
    list_type: string | null; // For Late Listed detection
  };
  
  const { data: caseData, isLoading, error, refetch } = useQuery<DocketRow[]>({
    queryKey: ['case-export', userId, dateMode, effectiveStart, effectiveEnd],
    queryFn: async (): Promise<DocketRow[]> => {
      if (!userId || !canExport) {
        throw new Error('Unauthorized: Export not permitted');
      }
      
      if (dateMode === 'range' && (!dateRangeStart || !dateRangeEnd)) {
        throw new Error('Invalid date range');
      }
      
      // Build query to get matched cases for this user within date scope
      // Include petitioner/respondent for party names and lawyer fields for opposing counsel
      let query = supabase
        .from('daily_court_docket')
        .select(`
          id,
          case_number,
          item_no,
          court_room_no,
          judge_names,
          matched_role,
          status,
          date,
          case_fingerprint,
          petitioner,
          respondent,
          petitioner_lawyer,
          respondent_lawyer,
          list_type
        `)
        .eq('matched_profile_id', userId)
        .not('case_fingerprint', 'is', null)
        .order('court_room_no', { ascending: true })
        .order('item_no', { ascending: true });
      
      // Apply date filters based on mode
      if (dateMode === 'today') {
        query = query.eq('date', today);
      } else if (effectiveStart && effectiveEnd) {
        query = query.gte('date', effectiveStart).lte('date', effectiveEnd);
      }
      
      const { data, error: fetchError } = await query;
      
      if (fetchError) {
        throw fetchError;
      }
      
      return (data || []) as DocketRow[];
    },
    enabled: Boolean(userId && canExport && isValidRange),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
  
  // Fetch lawyer profile for name
  const { data: profile } = useQuery({
    queryKey: ['export-profile', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', userId)
        .single();
      return data;
    },
    enabled: !!userId,
  });
  
  // Normalize opposing counsel: name, "State Counsel / PP", or "—"
  function normalizeOpposingCounsel(counsel: string | null, respondentName: string | null): string {
    if (counsel?.trim()) {
      return counsel.trim();
    }
    // Check if this is a government matter (common patterns)
    const respondent = (respondentName || '').toLowerCase();
    const isGovernmentMatter = 
      respondent.includes('state of') ||
      respondent.includes('union of india') ||
      respondent.includes('government') ||
      respondent.includes('govt.') ||
      respondent.includes('collector') ||
      respondent.includes('commissioner');
    
    if (isGovernmentMatter) {
      return 'State Counsel / PP';
    }
    return '—';
  }
  
  // Process and group data
  const processedData: ExportData | null = caseData ? (() => {
    // Group by case_fingerprint to find first/last appearance
    const caseMap = new Map<string, {
      fingerprint: string;
      caseNumber: string;
      itemNo: number | null;
      courtNo: string;
      judgeName: string;
      role: AdvocateRole;
      outcome: string | null;
      dates: string[];
      petitioner: string | null;
      respondent: string | null;
      opposingCounsel: string;
      listingStatus: ListingStatus;
    }>();
    
    for (const row of caseData) {
      const fingerprint = row.case_fingerprint;
      if (!fingerprint) continue;
      
      // Determine opposing counsel based on user's role
      // If user is Petitioner, opposing counsel = respondent_lawyer
      // If user is Respondent, opposing counsel = petitioner_lawyer
      const userRole = row.matched_role;
      const rawOpposingCounsel = userRole === 'petitioner' 
        ? row.respondent_lawyer 
        : row.petitioner_lawyer;
      
      // Normalize opposing counsel (never null/blank)
      const opposingCounsel = normalizeOpposingCounsel(rawOpposingCounsel, row.respondent);
      
      // Determine listing status (Late Listed = SUPPLEMENTARY list type)
      const listingStatus: ListingStatus = row.list_type === 'SUPPLEMENTARY' ? 'Late Listed' : 'Normal';
      
      const existing = caseMap.get(fingerprint);
      if (existing) {
        existing.dates.push(row.date);
        // Update outcome if case is done/disposed
        if (row.status === 'done' || row.status === 'disposed') {
          existing.outcome = row.status === 'done' ? 'Disposed' : 'Completed';
        }
        // Keep first non-null party names
        if (!existing.petitioner && row.petitioner) {
          existing.petitioner = row.petitioner;
        }
        if (!existing.respondent && row.respondent) {
          existing.respondent = row.respondent;
        }
        // Update opposing counsel if we now have a better one
        if (existing.opposingCounsel === '—' && opposingCounsel !== '—') {
          existing.opposingCounsel = opposingCounsel;
        }
        // Update listing status if any appearance is Late Listed
        if (listingStatus === 'Late Listed') {
          existing.listingStatus = 'Late Listed';
        }
      } else {
        caseMap.set(fingerprint, {
          fingerprint,
          caseNumber: row.case_number || '',
          itemNo: row.item_no,
          courtNo: row.court_room_no || 'Unknown',
          judgeName: row.judge_names || 'Unknown',
          role: (row.matched_role === 'petitioner' ? 'Petitioner' : 'Respondent') as AdvocateRole,
          outcome: row.status === 'done' ? 'Disposed' : null,
          dates: [row.date],
          petitioner: row.petitioner,
          respondent: row.respondent,
          opposingCounsel: opposingCounsel,
          listingStatus: listingStatus,
        });
      }
    }
    
    // Convert to ExportCase array
    const cases: ExportCase[] = [];
    caseMap.forEach((caseData, fingerprint) => {
      const sortedDates = caseData.dates.sort();
      const firstDate = sortedDates[0];
      const lastDate = sortedDates[sortedDates.length - 1];
      
      cases.push({
        id: fingerprint,
        caseNo: caseData.caseNumber,
        itemNo: caseData.itemNo,
        advocateRole: caseData.role,
        outcome: caseData.outcome,
        dateRange: formatDateRange(firstDate, lastDate),
        petitioner: caseData.petitioner,
        respondent: caseData.respondent,
        opposingCounsel: caseData.opposingCounsel,
        listingStatus: caseData.listingStatus,
        lawyerNotes: '', // Will be filled from stored notes (future-compatible)
        courtNo: caseData.courtNo,
        judgeName: caseData.judgeName,
        caseFingerprint: fingerprint,
      });
    });
    
    // Sort cases by item number within each group
    cases.sort((a, b) => (a.itemNo || 0) - (b.itemNo || 0));
    
    // Group by court_no + judge_name
    const groupMap = new Map<string, ExportGroup>();
    for (const caseItem of cases) {
      const key = `${caseItem.courtNo}||${caseItem.judgeName}`;
      const existing = groupMap.get(key);
      if (existing) {
        existing.cases.push(caseItem);
      } else {
        groupMap.set(key, {
          courtNo: caseItem.courtNo,
          judgeName: caseItem.judgeName,
          cases: [caseItem],
        });
      }
    }
    
    const groups = Array.from(groupMap.values());
    
    // Determine date scope for footer
    const dateScope = dateMode === 'today' 
      ? { mode: dateMode as ExportDateMode }
      : { 
          mode: dateMode as ExportDateMode, 
          start: effectiveStart, 
          end: effectiveEnd 
        };
    
    // Determine if multi-date export (for conditional Date Range column)
    const isMultiDate = dateMode === 'range' && effectiveStart !== effectiveEnd;
    
    return {
      lawyerName: profile?.full_name || 'Unknown Lawyer',
      exportDate: format(new Date(), 'dd MMM yyyy'),
      groups,
      totalCases: cases.length,
      dateScope,
      isMultiDate,
    };
  })() : null;
  
  // Get all case fingerprints for notes lookup
  const caseFingerprints = processedData?.groups.flatMap(g => g.cases.map(c => c.caseFingerprint)) || [];
  
  return {
    data: processedData,
    isLoading,
    error,
    refetch,
    canExport,
    hasData: (processedData?.totalCases || 0) > 0,
    caseFingerprints,
    isValidRange,
    effectiveStart,
    effectiveEnd,
  };
}

// Permission check hook for use in UI
export function useCanExportCases() {
  const { user, role, isAuthenticated } = useAuth();
  
  // CLERK and other roles cannot export
  const forbidden = role === 'CLERK' || role === undefined;
  
  return {
    canExport: isAuthenticated && !forbidden && (role === 'SENIOR' || role === 'JUNIOR' || role === 'ADMIN'),
    reason: forbidden ? 'Export is not available for your role' : null,
    isAdmin: role === 'ADMIN',
    userId: user?.id,
  };
}
