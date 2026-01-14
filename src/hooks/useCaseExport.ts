/**
 * useCaseExport Hook
 * 
 * Fetches and prepares case data for lawyer profile exports.
 * Enforces role-based access (SENIOR, JUNIOR own profile; ADMIN audit access).
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, parseISO } from 'date-fns';
import { resolveCaseType, extractCaseTypeAbbr } from '@/lib/caseTypeMapping';
import type { ExportCase, ExportGroup, ExportData, AdvocateRole } from '@/types/export';

interface UseCaseExportOptions {
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

export function useCaseExport(options: UseCaseExportOptions = {}) {
  const { user, role, isAuthenticated } = useAuth();
  const { dateRangeStart, dateRangeEnd, targetUserId } = options;
  
  // Determine which user's data to fetch
  const userId = targetUserId || user?.id;
  
  // Permission check: SENIOR/JUNIOR own profile, ADMIN can view any
  const canExport = isAuthenticated && (
    (role === 'SENIOR' && userId === user?.id) ||
    (role === 'JUNIOR' && userId === user?.id) ||
    (role === 'ADMIN')
  );
  
  // Fetch cases with all appearances grouped by case_fingerprint
  const { data: caseData, isLoading, error, refetch } = useQuery({
    queryKey: ['case-export', userId, dateRangeStart?.toISOString(), dateRangeEnd?.toISOString()],
    queryFn: async () => {
      if (!userId || !canExport) {
        throw new Error('Unauthorized: Export not permitted');
      }
      
      // Build query to get all matched cases for this user
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
      
      if (dateRangeStart) {
        query = query.gte('date', format(dateRangeStart, 'yyyy-MM-dd'));
      }
      if (dateRangeEnd) {
        query = query.lte('date', format(dateRangeEnd, 'yyyy-MM-dd'));
      }
      
      const { data, error: fetchError } = await query;
      
      if (fetchError) {
        throw fetchError;
      }
      
      return data || [];
    },
    enabled: !!userId && canExport,
    staleTime: 5 * 60 * 1000, // 5 minutes
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
        lawyerNotes: '', // Empty by default - user fills in
        courtNo: data.courtNo,
        judgeName: data.judgeName,
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
    
    return {
      lawyerName: profile?.full_name || 'Unknown Lawyer',
      exportDate: format(new Date(), 'dd MMM yyyy'),
      groups,
      totalCases: cases.length,
    };
  })() : null;
  
  return {
    data: processedData,
    isLoading,
    error,
    refetch,
    canExport,
    hasData: (processedData?.totalCases || 0) > 0,
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
