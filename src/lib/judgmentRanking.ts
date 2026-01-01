/**
 * Reference Judgment Ranking Engine
 * 
 * Provides deterministic, explainable scoring for reference judgments
 * with clear priority signals and reasons.
 */

export interface PrioritySignal {
  signal: string;
  label: string;
  weight: number;
  matched: boolean;
  description: string;
}

export interface RankedJudgment {
  id: string;
  title: string;
  url: string;
  court?: string;
  judge?: string;
  date?: string;
  snippet?: string;
  
  // Ranking data
  score: number;
  signals: PrioritySignal[];
  matchedSignals: string[];
  
  // Source tracking
  source: 'saved' | 'live-search';
  searchVector?: string;
  
  // Confidence
  isAiInferred: boolean;
  lastChecked?: string;
}

// Priority signal weights
export const SIGNAL_WEIGHTS = {
  SAME_JUDGE: 50,
  ADVOCATE_APPEARED: 45,
  SAME_COURT: 30,
  SAME_CASE_TYPE: 25,
  SAME_SECTIONS: 20,
  RECENT_JUDGMENT: 10,
  HIGHER_COURT: 15,
  DOCUMENT_SIMILARITY: 10,
} as const;

// Signal definitions with labels and descriptions
export const SIGNAL_DEFINITIONS: Record<string, { label: string; description: string }> = {
  SAME_JUDGE: { 
    label: 'Same Judge', 
    description: 'This judgment was delivered by the same judge hearing your case' 
  },
  ADVOCATE_APPEARED: { 
    label: 'Advocate Match', 
    description: 'The advocate on this case has appeared in this judgment' 
  },
  SAME_COURT: { 
    label: 'Same Court', 
    description: 'Judgment from the same court' 
  },
  SAME_CASE_TYPE: { 
    label: 'Same Case Type', 
    description: 'Similar type of case (writ, appeal, criminal, etc.)' 
  },
  SAME_SECTIONS: { 
    label: 'Section Match', 
    description: 'Involves the same acts or sections' 
  },
  RECENT_JUDGMENT: { 
    label: 'Recent', 
    description: 'Delivered within the last 2 years' 
  },
  HIGHER_COURT: { 
    label: 'Higher Court', 
    description: 'From a superior court (Supreme Court)' 
  },
  DOCUMENT_SIMILARITY: { 
    label: 'Content Match', 
    description: 'Similar content based on document analysis' 
  },
};

interface RankingContext {
  judgeName?: string | null;
  court?: string | null;
  caseType?: string | null;
  category?: string | null;
  advocateNames?: string[];
  sections?: string[];
}

// Normalize names for comparison
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/hon'?ble\.?/gi, '')
    .replace(/justice\.?/gi, '')
    .replace(/j\.?$/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Check if two names match (fuzzy)
function namesMatch(name1: string, name2: string): boolean {
  const n1 = normalizeName(name1);
  const n2 = normalizeName(name2);
  
  // Exact match
  if (n1 === n2) return true;
  
  // Partial match (one contains the other)
  if (n1.includes(n2) || n2.includes(n1)) return true;
  
  // Split and check surname match
  const parts1 = n1.split(' ');
  const parts2 = n2.split(' ');
  
  // Check if surnames match
  const surname1 = parts1[parts1.length - 1];
  const surname2 = parts2[parts2.length - 1];
  
  if (surname1.length > 3 && surname2.length > 3 && surname1 === surname2) {
    return true;
  }
  
  return false;
}

// Check if court names match
function courtsMatch(court1?: string, court2?: string): boolean {
  if (!court1 || !court2) return false;
  
  const c1 = court1.toLowerCase();
  const c2 = court2.toLowerCase();
  
  // Exact match
  if (c1 === c2) return true;
  
  // Check for common court names
  const courtKeywords = ['rajasthan', 'jaipur', 'jodhpur', 'supreme', 'delhi', 'bombay', 'calcutta', 'madras'];
  
  for (const keyword of courtKeywords) {
    if (c1.includes(keyword) && c2.includes(keyword)) {
      return true;
    }
  }
  
  return false;
}

// Check if a judgment is recent (within 2 years)
function isRecent(dateStr?: string): boolean {
  if (!dateStr) return false;
  
  try {
    const date = new Date(dateStr);
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    
    return date >= twoYearsAgo;
  } catch {
    return false;
  }
}

// Check if judgment is from Supreme Court
function isHigherCourt(court?: string): boolean {
  if (!court) return false;
  return court.toLowerCase().includes('supreme');
}

// Calculate priority signals for a judgment
export function calculateSignals(
  judgment: {
    title: string;
    url: string;
    court?: string;
    judge?: string | string[];
    date?: string;
    snippet?: string;
    lawyerNames?: string[];
  },
  context: RankingContext
): PrioritySignal[] {
  const signals: PrioritySignal[] = [];
  
  // 1. Same Judge
  let judgeMatched = false;
  if (context.judgeName) {
    const judgeNames = Array.isArray(judgment.judge) ? judgment.judge : [judgment.judge].filter(Boolean);
    
    for (const jn of judgeNames) {
      if (jn && namesMatch(context.judgeName, jn)) {
        judgeMatched = true;
        break;
      }
    }
    
    // Also check in title/snippet for judge name
    if (!judgeMatched) {
      const titleAndSnippet = `${judgment.title} ${judgment.snippet || ''}`;
      const contextJudge = normalizeName(context.judgeName);
      if (titleAndSnippet.toLowerCase().includes(contextJudge)) {
        judgeMatched = true;
      }
    }
  }
  
  signals.push({
    signal: 'SAME_JUDGE',
    label: SIGNAL_DEFINITIONS.SAME_JUDGE.label,
    weight: SIGNAL_WEIGHTS.SAME_JUDGE,
    matched: judgeMatched,
    description: SIGNAL_DEFINITIONS.SAME_JUDGE.description,
  });
  
  // 2. Advocate Appeared
  let advocateMatched = false;
  if (context.advocateNames && context.advocateNames.length > 0) {
    const judgmentLawyers = judgment.lawyerNames || [];
    const titleAndSnippet = `${judgment.title} ${judgment.snippet || ''}`.toLowerCase();
    
    for (const advocate of context.advocateNames) {
      const normalizedAdvocate = normalizeName(advocate);
      
      // Check in lawyer names
      for (const lawyer of judgmentLawyers) {
        if (namesMatch(advocate, lawyer)) {
          advocateMatched = true;
          break;
        }
      }
      
      // Check in title/snippet
      if (!advocateMatched && titleAndSnippet.includes(normalizedAdvocate)) {
        advocateMatched = true;
      }
      
      if (advocateMatched) break;
    }
  }
  
  signals.push({
    signal: 'ADVOCATE_APPEARED',
    label: SIGNAL_DEFINITIONS.ADVOCATE_APPEARED.label,
    weight: SIGNAL_WEIGHTS.ADVOCATE_APPEARED,
    matched: advocateMatched,
    description: SIGNAL_DEFINITIONS.ADVOCATE_APPEARED.description,
  });
  
  // 3. Same Court
  const courtMatched = courtsMatch(judgment.court, context.court || undefined);
  signals.push({
    signal: 'SAME_COURT',
    label: SIGNAL_DEFINITIONS.SAME_COURT.label,
    weight: SIGNAL_WEIGHTS.SAME_COURT,
    matched: courtMatched,
    description: SIGNAL_DEFINITIONS.SAME_COURT.description,
  });
  
  // 4. Same Case Type
  let caseTypeMatched = false;
  if (context.caseType || context.category) {
    const titleLower = judgment.title.toLowerCase();
    const caseTypeLower = (context.caseType || '').toLowerCase();
    const categoryLower = (context.category || '').toLowerCase();
    
    if (caseTypeLower && titleLower.includes(caseTypeLower)) {
      caseTypeMatched = true;
    }
    
    // Check category-specific keywords
    if (!caseTypeMatched && categoryLower) {
      const categoryKeywords: Record<string, string[]> = {
        'criminal': ['criminal', 'bail', 'fir', 'accused', 'cr.p.c'],
        'civil-writ': ['writ', 'article 226', 'certiorari', 'mandamus'],
        'appeal': ['appeal', 'appellant'],
        'mact': ['motor accident', 'compensation', 'mact'],
        'family': ['divorce', 'maintenance', 'matrimonial'],
      };
      
      const keywords = categoryKeywords[categoryLower] || [];
      caseTypeMatched = keywords.some(kw => titleLower.includes(kw));
    }
  }
  
  signals.push({
    signal: 'SAME_CASE_TYPE',
    label: SIGNAL_DEFINITIONS.SAME_CASE_TYPE.label,
    weight: SIGNAL_WEIGHTS.SAME_CASE_TYPE,
    matched: caseTypeMatched,
    description: SIGNAL_DEFINITIONS.SAME_CASE_TYPE.description,
  });
  
  // 5. Recent Judgment
  const recent = isRecent(judgment.date);
  signals.push({
    signal: 'RECENT_JUDGMENT',
    label: SIGNAL_DEFINITIONS.RECENT_JUDGMENT.label,
    weight: SIGNAL_WEIGHTS.RECENT_JUDGMENT,
    matched: recent,
    description: SIGNAL_DEFINITIONS.RECENT_JUDGMENT.description,
  });
  
  // 6. Higher Court
  const higherCourt = isHigherCourt(judgment.court);
  signals.push({
    signal: 'HIGHER_COURT',
    label: SIGNAL_DEFINITIONS.HIGHER_COURT.label,
    weight: SIGNAL_WEIGHTS.HIGHER_COURT,
    matched: higherCourt,
    description: SIGNAL_DEFINITIONS.HIGHER_COURT.description,
  });
  
  return signals;
}

// Calculate total score from signals
export function calculateScore(signals: PrioritySignal[]): number {
  return signals.reduce((total, signal) => {
    return total + (signal.matched ? signal.weight : 0);
  }, 0);
}

// Rank and sort judgments
export function rankJudgments(
  judgments: Array<{
    id?: string;
    title: string;
    url: string;
    court?: string;
    judge?: string | string[];
    date?: string;
    snippet?: string;
    lawyerNames?: string[];
    source?: 'saved' | 'live-search';
    searchVector?: string;
  }>,
  context: RankingContext
): RankedJudgment[] {
  const ranked: RankedJudgment[] = judgments.map((judgment, index) => {
    const signals = calculateSignals(judgment, context);
    const score = calculateScore(signals);
    const matchedSignals = signals.filter(s => s.matched).map(s => s.signal);
    
    return {
      id: judgment.id || `judgment-${index}`,
      title: judgment.title,
      url: judgment.url,
      court: judgment.court,
      judge: Array.isArray(judgment.judge) ? judgment.judge.join(', ') : judgment.judge,
      date: judgment.date,
      snippet: judgment.snippet,
      score,
      signals,
      matchedSignals,
      source: judgment.source || 'live-search',
      searchVector: judgment.searchVector,
      isAiInferred: matchedSignals.length === 0, // No deterministic signals matched
      lastChecked: new Date().toISOString(),
    };
  });
  
  // Sort by score (descending), then by date (most recent first)
  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    
    // If scores equal, prefer more recent
    if (a.date && b.date) {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    }
    
    return 0;
  });
  
  return ranked;
}

// Get signal badge variant based on importance
export function getSignalVariant(signal: string): 'default' | 'secondary' | 'outline' {
  switch (signal) {
    case 'SAME_JUDGE':
    case 'ADVOCATE_APPEARED':
      return 'default';
    case 'SAME_COURT':
    case 'SAME_CASE_TYPE':
      return 'secondary';
    default:
      return 'outline';
  }
}
