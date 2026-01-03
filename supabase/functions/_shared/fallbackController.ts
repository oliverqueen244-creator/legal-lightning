/**
 * Self-Healing Parser Fallback Controller for Edge Functions
 * 
 * SAFETY RULES (NON-NEGOTIABLE):
 * - NEVER invent or infer missing court data
 * - NEVER overwrite primary parse results
 * - NEVER use AI or probabilistic parsing
 * - Fallbacks improve STRUCTURE only, not CONTENT
 * - Always preserve auditability
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export type FallbackLevel = 
  | 'primary'
  | 'fallback_1_lenient'
  | 'fallback_2_section'
  | 'fallback_3_historical';

export interface FallbackTriggerCondition {
  confidenceScore: number;
  ingestionErrorCount: number;
  totalCasesParsed: number;
  isWeekday: boolean;
}

export interface FallbackResult {
  level: FallbackLevel;
  text: string;
  sectionsDetected?: number;
  applied: boolean;
  reason: string;
}

// Known anchors for section-based parsing
const SECTION_ANCHORS = [
  'COURT NO',
  'COURT NO.',
  'COURT ROOM',
  'ITEM NO',
  'ITEM NO.',
  "HON'BLE",
  'HONBLE',
  'VERSUS',
  'VS',
  'V/S',
  'APPEARANCE',
  'ADVOCATE',
  'COUNSEL',
  'PETITIONER',
  'RESPONDENT',
];

/**
 * Check if fallback is disabled for a bench
 */
export async function isFallbackDisabled(benchCode: string): Promise<boolean> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) return false;
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { data } = await supabase.rpc('is_fallback_disabled', { p_bench_code: benchCode });
    return !!data;
  } catch {
    return false;
  }
}

/**
 * Log fallback attempt to database
 */
export async function logFallbackAttempt(params: {
  batchId: string;
  benchCode: string;
  fallbackLevel: FallbackLevel;
  triggeredReason: string;
  casesBefore: number;
  casesAfter: number;
  confidenceBefore: number;
  confidenceAfter: number;
  parseDurationMs?: number;
}): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) return;
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    await supabase.rpc('log_fallback_attempt', {
      p_batch_id: params.batchId,
      p_bench_code: params.benchCode,
      p_fallback_level: params.fallbackLevel,
      p_triggered_reason: params.triggeredReason,
      p_cases_before: params.casesBefore,
      p_cases_after: params.casesAfter,
      p_confidence_before: params.confidenceBefore,
      p_confidence_after: params.confidenceAfter,
      p_parse_duration_ms: params.parseDurationMs ?? null,
    });
  } catch (error) {
    // CRITICAL: Never block processing - log silently
    console.warn('[FALLBACK] Failed to log attempt:', error);
  }
}

/**
 * Determine if fallback should be triggered
 */
export function shouldTriggerFallback(condition: FallbackTriggerCondition): {
  shouldTrigger: boolean;
  reason: string;
} {
  // Condition 1: Low confidence score
  if (condition.confidenceScore < 60) {
    return {
      shouldTrigger: true,
      reason: `CONFIDENCE_LOW:${condition.confidenceScore}`,
    };
  }

  // Condition 2: Ingestion errors present
  if (condition.ingestionErrorCount > 0) {
    return {
      shouldTrigger: true,
      reason: `INGESTION_ERRORS:${condition.ingestionErrorCount}`,
    };
  }

  // Condition 3: Zero cases parsed on a weekday
  if (condition.totalCasesParsed === 0 && condition.isWeekday) {
    return {
      shouldTrigger: true,
      reason: 'ZERO_CASES_WEEKDAY',
    };
  }

  return { shouldTrigger: false, reason: 'NONE' };
}

/**
 * FALLBACK LEVEL 1: LENIENT MODE
 * 
 * - Relax whitespace and newline sensitivity
 * - Ignore duplicate delimiters
 * - Preserve all token boundaries
 * - No reordering
 */
export function applyLenientMode(text: string): FallbackResult {
  if (!text || typeof text !== 'string') {
    return { level: 'fallback_1_lenient', text: '', applied: false, reason: 'EMPTY_INPUT' };
  }

  let normalized = text;

  // Normalize multiple spaces to single space
  normalized = normalized.replace(/  +/g, ' ');

  // Normalize multiple newlines to double newline (preserve paragraph breaks)
  normalized = normalized.replace(/\n{3,}/g, '\n\n');

  // Remove duplicate delimiters
  normalized = normalized.replace(/-{2,}/g, '-');
  normalized = normalized.replace(/={2,}/g, '=');
  normalized = normalized.replace(/_{2,}/g, '_');

  // Normalize tabs to spaces
  normalized = normalized.replace(/\t+/g, ' ');

  // Trim leading/trailing whitespace from each line
  normalized = normalized
    .split('\n')
    .map(line => line.trim())
    .join('\n');

  // Normalize common OCR artifacts
  normalized = normalized.replace(/\|/g, 'I');
  normalized = normalized.replace(/0(?=[A-Z])/g, 'O');

  const applied = normalized !== text;

  return {
    level: 'fallback_1_lenient',
    text: normalized,
    applied,
    reason: applied ? 'WHITESPACE_NORMALIZED' : 'NO_CHANGE',
  };
}

// Helper to escape regex special characters
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * FALLBACK LEVEL 2: SECTION-BASED PARSE
 */
export function applySectionBasedParse(text: string): FallbackResult {
  if (!text || typeof text !== 'string') {
    return { level: 'fallback_2_section', text: '', applied: false, reason: 'EMPTY_INPUT' };
  }

  // Find all anchor positions
  const anchorPositions: Array<{ anchor: string; position: number }> = [];

  for (const anchor of SECTION_ANCHORS) {
    const regex = new RegExp(`\\b${escapeRegex(anchor)}\\b`, 'gi');
    let match;
    while ((match = regex.exec(text)) !== null) {
      anchorPositions.push({ anchor, position: match.index });
    }
  }

  // Sort by position
  anchorPositions.sort((a, b) => a.position - b.position);

  if (anchorPositions.length === 0) {
    return {
      level: 'fallback_2_section',
      text,
      applied: false,
      reason: 'NO_ANCHORS_FOUND',
    };
  }

  // Insert clear section markers
  let markedText = '';
  let lastPos = 0;

  for (const { position } of anchorPositions) {
    markedText += text.slice(lastPos, position);
    markedText += '\n§§§\n';
    lastPos = position;
  }
  markedText += text.slice(lastPos);

  markedText = markedText.replace(/(\n§§§\n)+/g, '\n§§§\n');

  return {
    level: 'fallback_2_section',
    text: markedText,
    sectionsDetected: anchorPositions.length,
    applied: true,
    reason: `SECTIONS_MARKED:${anchorPositions.length}`,
  };
}

/**
 * FALLBACK LEVEL 3: HISTORICAL ADAPTER (Placeholder)
 */
export function applyHistoricalAdapter(
  text: string,
  _benchCode: string,
  historicalConfig?: {
    delimiterPattern?: string;
    structureSimilarity?: number;
  }
): FallbackResult {
  if (!text || typeof text !== 'string') {
    return { level: 'fallback_3_historical', text: '', applied: false, reason: 'EMPTY_INPUT' };
  }

  if (!historicalConfig) {
    return {
      level: 'fallback_3_historical',
      text,
      applied: false,
      reason: 'NO_HISTORICAL_CONFIG',
    };
  }

  if ((historicalConfig.structureSimilarity || 0) < 0.7) {
    return {
      level: 'fallback_3_historical',
      text,
      applied: false,
      reason: 'SIMILARITY_BELOW_THRESHOLD',
    };
  }

  let normalized = text;
  if (historicalConfig.delimiterPattern) {
    try {
      const regex = new RegExp(historicalConfig.delimiterPattern, 'g');
      normalized = normalized.replace(regex, '\n');
    } catch {
      // Invalid regex, skip
    }
  }

  const applied = normalized !== text;

  return {
    level: 'fallback_3_historical',
    text: normalized,
    applied,
    reason: applied ? 'HISTORICAL_PATTERN_APPLIED' : 'NO_CHANGE',
  };
}

/**
 * Run fallback sequence and return best result
 */
export function runFallbackSequence(
  text: string,
  benchCode: string
): {
  bestResult: FallbackResult;
  allResults: FallbackResult[];
  finalLevel: FallbackLevel;
} {
  const results: FallbackResult[] = [];

  // Level 1
  const level1 = applyLenientMode(text);
  results.push(level1);

  // Level 2
  const textForL2 = level1.applied ? level1.text : text;
  const level2 = applySectionBasedParse(textForL2);
  results.push(level2);

  // Level 3
  const textForL3 = level2.applied ? level2.text : textForL2;
  const level3 = applyHistoricalAdapter(textForL3, benchCode);
  results.push(level3);

  // Find best applied result
  const appliedResults = results.filter(r => r.applied);
  const bestResult = appliedResults.length > 0
    ? appliedResults[appliedResults.length - 1]
    : { level: 'primary' as FallbackLevel, text, applied: false, reason: 'NO_FALLBACK_APPLIED' };

  return {
    bestResult,
    allResults: results,
    finalLevel: bestResult.level,
  };
}

/**
 * Check if this is a weekday (court days)
 */
export function isWeekday(): boolean {
  const day = new Date().getDay();
  return day >= 1 && day <= 5; // Monday = 1, Friday = 5
}
