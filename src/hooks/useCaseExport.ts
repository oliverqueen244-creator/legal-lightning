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
import { resolveCaseType, extractCaseTypeAbbr } from '@/lib/caseTypeMapping';
import type { ExportCase, ExportGroup, ExportData, AdvocateRole, ExportDateMode } from '@/types/export';

interface UseCaseExportOptions {
  dateMode: ExportDateMode; // 'today' (default) or 'range'
  dateRangeStart?: Date;
  dateRangeEnd?: Date;
  targetUserId?: string; // For admin audit access
}

function extractYear(caseNumber: string): number {
  // Pattern: CRL.M.PET. 10766/2025 -> 2025
  const match = caseNumber.match(/\/(\d{4})/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return new Date().getFullYear();
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

function getCaseTypeShort(caseNumber: string): string {
  const abbr = extractCaseTypeAbbr(caseNumber);
  if (abbr) {
    // Use abbreviation directly for short display
    return abbr.replace(/\./g, ' ').trim();
  }
  // Fallback: extract first part before number
  const match = caseNumber.match(/^([A-Za-z.\s]+)/);
  return match ? match[1].trim() : 'Unknown';
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
    court_room_no: string | null;
    judge_names: string | null;
    matched_role: string | null;
    status: string | null;
    date: string;
    case_fingerprint: string | null;
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
      let query = supabase
        .from('daily_court_docket')
        .select(`
          id,
          case_number,
          court_room_no,
          judge_names,
          matched_role,
          status,
          date,
          case_fingerprint
        `)
        .eq('matched_profile_id', userId)
        .not('case_fingerprint', 'is', null)
        .order('date', { ascending: true });
      
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
  
  // Process and group data
  const processedData: ExportData | null = caseData ? (() => {
    // Group by case_fingerprint to find first/last appearance
    const caseMap = new Map<string, {
      fingerprint: string;
      caseNumber: string;
      courtNo: string;
      judgeName: string;
      role: AdvocateRole;
      outcome: string | null;
      dates: string[];
    }>();
    
    for (const row of caseData) {
      const fingerprint = row.case_fingerprint;
      if (!fingerprint) continue;
      
      const existing = caseMap.get(fingerprint);
      if (existing) {
        existing.dates.push(row.date);
        // Update outcome if case is done/disposed
        if (row.status === 'done' || row.status === 'disposed') {
          existing.outcome = row.status === 'done' ? 'Disposed' : 'Completed';
        }
      } else {
        caseMap.set(fingerprint, {
          fingerprint,
          caseNumber: row.case_number || '',
          courtNo: row.court_room_no || 'Unknown',
          judgeName: row.judge_names || 'Unknown',
          role: (row.matched_role === 'petitioner' ? 'Petitioner' : 'Respondent') as AdvocateRole,
          outcome: row.status === 'done' ? 'Disposed' : null,
          dates: [row.date],
        });
      }
    }
    
    // Convert to ExportCase array
    const cases: ExportCase[] = [];
    caseMap.forEach((data, fingerprint) => {
      const sortedDates = data.dates.sort();
      const firstDate = sortedDates[0];
      const lastDate = sortedDates[sortedDates.length - 1];
      
      cases.push({
        id: fingerprint,
        caseNo: data.caseNumber,
        caseType: getCaseTypeShort(data.caseNumber),
        year: extractYear(data.caseNumber),
        advocateRole: data.role,
        outcome: data.outcome,
        dateRange: formatDateRange(firstDate, lastDate),
        lawyerNotes: '', // Will be filled from stored notes
        courtNo: data.courtNo,
        judgeName: data.judgeName,
        caseFingerprint: fingerprint,
      });
    });
    
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
    
    return {
      lawyerName: profile?.full_name || 'Unknown Lawyer',
      exportDate: format(new Date(), 'dd MMM yyyy'),
      groups,
      totalCases: cases.length,
      dateScope,
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
