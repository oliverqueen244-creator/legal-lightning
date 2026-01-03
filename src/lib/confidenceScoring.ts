/**
 * PARSER CONFIDENCE SCORING ENGINE
 * 
 * Deterministic scoring algorithm for evaluating causelist parsing reliability.
 * NO AI/ML - purely rule-based calculations.
 * 
 * Score Components:
 * - Ingestion Integrity (0-40): Download success, format stability
 * - Parsing Stability (0-30): Text extraction, structure recognition
 * - Matching Reliability (0-20): Lawyer alias matching success
 * - Historical Consistency (0-10): Deviation from 7-day averages
 */

export interface ConfidenceInputs {
  // Current run metrics
  totalCasesDetected: number;
  totalCasesParsed: number;
  totalCasesMatched: number;
  
  // Error counts from admin_error_events
  ingestionErrors: number;
  parsingErrors: number;
  matchingErrors: number;
  
  // Historical averages (7-day)
  avgCasesDetected?: number;
  avgCasesParsed?: number;
  avgCasesMatched?: number;
  avgConfidenceScore?: number;
}

export interface ConfidenceResult {
  score: number; // 0-100
  level: 'excellent' | 'good' | 'degraded' | 'risky' | 'unsafe';
  reasons: string[];
  warningIssued: boolean;
  
  // Component scores
  ingestionIntegrityScore: number;
  parsingStabilityScore: number;
  matchingReliabilityScore: number;
  historicalConsistencyScore: number;
}

/**
 * Calculate ingestion integrity score (0-40)
 * Measures: successful download, format recognition, completeness
 */
function calculateIngestionIntegrity(inputs: ConfidenceInputs): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 40;
  
  // Deduct for ingestion errors
  if (inputs.ingestionErrors > 0) {
    const deduction = Math.min(inputs.ingestionErrors * 8, 30);
    score -= deduction;
    if (inputs.ingestionErrors >= 3) {
      reasons.push('HIGH_INGESTION_ERRORS');
    }
  }
  
  // Deduct if no cases detected (complete failure)
  if (inputs.totalCasesDetected === 0) {
    score -= 40;
    reasons.push('ZERO_MATCH');
  }
  
  return { score: Math.max(0, score), reasons };
}

/**
 * Calculate parsing stability score (0-30)
 * Measures: text extraction success, structure recognition
 */
function calculateParsingStability(inputs: ConfidenceInputs): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 30;
  
  // Deduct for parsing errors
  if (inputs.parsingErrors > 0) {
    const deduction = Math.min(inputs.parsingErrors * 5, 20);
    score -= deduction;
    if (inputs.parsingErrors >= 5) {
      reasons.push('HIGH_PARSE_ERROR_RATE');
    }
  }
  
  // Deduct if not all detected cases were parsed
  if (inputs.totalCasesDetected > 0) {
    const parseRate = inputs.totalCasesParsed / inputs.totalCasesDetected;
    if (parseRate < 0.9) {
      const deduction = Math.round((1 - parseRate) * 20);
      score -= deduction;
      reasons.push('PARTIAL_PARSE');
    }
  }
  
  return { score: Math.max(0, score), reasons };
}

/**
 * Calculate matching reliability score (0-20)
 * Measures: alias matching success rate
 */
function calculateMatchingReliability(inputs: ConfidenceInputs): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 20;
  
  // Deduct for matching errors
  if (inputs.matchingErrors > 0) {
    const deduction = Math.min(inputs.matchingErrors * 4, 15);
    score -= deduction;
    if (inputs.matchingErrors >= 5) {
      reasons.push('HIGH_MATCHING_ERRORS');
    }
  }
  
  // Deduct based on match rate
  if (inputs.totalCasesParsed > 0) {
    const matchRate = inputs.totalCasesMatched / inputs.totalCasesParsed;
    if (matchRate < 0.5) {
      score -= 10;
      // Only flag zero match if literally no matches
      if (inputs.totalCasesMatched === 0) {
        reasons.push('ZERO_MATCH');
      }
    } else if (matchRate < 0.8) {
      score -= 5;
    }
  }
  
  return { score: Math.max(0, score), reasons };
}

/**
 * Calculate historical consistency score (0-10)
 * Measures: deviation from 7-day averages
 */
function calculateHistoricalConsistency(inputs: ConfidenceInputs): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 10;
  
  // If no historical data, give benefit of the doubt
  if (!inputs.avgCasesDetected || !inputs.avgCasesParsed) {
    return { score: 8, reasons };
  }
  
  // Check for unusual drops
  if (inputs.avgCasesDetected > 0) {
    const detectionRatio = inputs.totalCasesDetected / inputs.avgCasesDetected;
    if (detectionRatio < 0.5) {
      score -= 5;
      reasons.push('UNUSUAL_DROP');
    } else if (detectionRatio < 0.7) {
      score -= 3;
    }
  }
  
  if (inputs.avgCasesParsed > 0) {
    const parseRatio = inputs.totalCasesParsed / inputs.avgCasesParsed;
    if (parseRatio < 0.5) {
      score -= 5;
      reasons.push('UNUSUAL_DROP');
    } else if (parseRatio < 0.7) {
      score -= 2;
    }
  }
  
  // Remove duplicate reasons
  const uniqueReasons = [...new Set(reasons)];
  
  return { score: Math.max(0, score), reasons: uniqueReasons };
}

/**
 * Determine confidence level from score
 */
function getConfidenceLevel(score: number): ConfidenceResult['level'] {
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'good';
  if (score >= 60) return 'degraded';
  if (score >= 40) return 'risky';
  return 'unsafe';
}

/**
 * Main scoring function
 * Combines all component scores into final confidence result
 */
export function calculateConfidenceScore(inputs: ConfidenceInputs): ConfidenceResult {
  // Calculate component scores
  const ingestion = calculateIngestionIntegrity(inputs);
  const parsing = calculateParsingStability(inputs);
  const matching = calculateMatchingReliability(inputs);
  const historical = calculateHistoricalConsistency(inputs);
  
  // Sum up total score
  const totalScore = ingestion.score + parsing.score + matching.score + historical.score;
  
  // Normalize to 0-100 (already in range)
  const normalizedScore = Math.min(100, Math.max(0, totalScore));
  
  // Combine all reasons (deduplicated)
  const allReasons = [...new Set([
    ...ingestion.reasons,
    ...parsing.reasons,
    ...matching.reasons,
    ...historical.reasons,
  ])];
  
  // Determine level
  const level = getConfidenceLevel(normalizedScore);
  
  // Issue warning if below 60
  const warningIssued = normalizedScore < 60;
  
  return {
    score: normalizedScore,
    level,
    reasons: allReasons,
    warningIssued,
    ingestionIntegrityScore: ingestion.score,
    parsingStabilityScore: parsing.score,
    matchingReliabilityScore: matching.score,
    historicalConsistencyScore: historical.score,
  };
}

/**
 * Get human-readable description for confidence level
 */
export function getConfidenceLevelDescription(level: ConfidenceResult['level']): string {
  switch (level) {
    case 'excellent':
      return 'All systems operating normally';
    case 'good':
      return 'Minor issues detected, data reliable';
    case 'degraded':
      return 'Some parsing issues, verify critical data';
    case 'risky':
      return 'Significant issues, data may be incomplete';
    case 'unsafe':
      return 'Major failures, data unreliable';
  }
}

/**
 * Get color class for confidence level
 */
export function getConfidenceLevelColor(level: ConfidenceResult['level']): string {
  switch (level) {
    case 'excellent':
      return 'text-green-600 bg-green-500/10';
    case 'good':
      return 'text-emerald-600 bg-emerald-500/10';
    case 'degraded':
      return 'text-yellow-600 bg-yellow-500/10';
    case 'risky':
      return 'text-orange-600 bg-orange-500/10';
    case 'unsafe':
      return 'text-red-600 bg-red-500/10';
  }
}
