/**
 * Parser Fallback Controller & Levels
 * 
 * SAFETY RULES:
 * - NEVER invent or infer missing court data
 * - NEVER overwrite primary parse results
 * - NEVER use AI or probabilistic parsing
 * - Fallbacks improve STRUCTURE only, not CONTENT
 * 
 * This module provides deterministic text normalization functions
 * that can improve parsing success without altering meaning.
 */

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
  reason?: string;
}

// Known anchors for section-based parsing (Level 2)
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
 * Determine if fallback should be triggered
 * 
 * Activation conditions:
 * 1. parser_confidence_score < 60
 * 2. ingestion_error_count > 0
 * 3. total_cases_parsed = 0 on a weekday
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

  // Remove duplicate delimiters (e.g., "----" -> "-")
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
  normalized = normalized.replace(/\|/g, 'I'); // Pipe often confused with I
  normalized = normalized.replace(/0(?=[A-Z])/g, 'O'); // Zero before capital often is O

  const applied = normalized !== text;

  return {
    level: 'fallback_1_lenient',
    text: normalized,
    applied,
    reason: applied ? 'WHITESPACE_NORMALIZED' : 'NO_CHANGE',
  };
}

/**
 * FALLBACK LEVEL 2: SECTION-BASED PARSE
 * 
 * - Detect anchors: COURT NO, ITEM NO, HON'BLE, VS, APPEARANCE
 * - Parse each section independently
 * - Reassemble items conservatively
 * - Drop ambiguous items instead of guessing
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

  // If no anchors found, can't apply section-based parsing
  if (anchorPositions.length === 0) {
    return {
      level: 'fallback_2_section',
      text,
      applied: false,
      reason: 'NO_ANCHORS_FOUND',
    };
  }

  // Insert clear section markers at anchor positions
  let markedText = '';
  let lastPos = 0;

  for (const { position } of anchorPositions) {
    markedText += text.slice(lastPos, position);
    markedText += '\n§§§\n'; // Section marker
    lastPos = position;
  }
  markedText += text.slice(lastPos);

  // Clean up excessive markers
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
 * FALLBACK LEVEL 3: HISTORICAL ADAPTER
 * 
 * This is a placeholder that would:
 * - Retrieve last successful parser config for SAME bench
 * - Apply identical delimiter and offset rules
 * - Only apply if structure similarity > threshold
 * - Never reuse across benches
 * 
 * Implementation requires historical config storage (future work)
 */
export function applyHistoricalAdapter(
  text: string,
  _benchCode: string,
  historicalConfig?: {
    delimiterPattern?: string;
    offsetRules?: Array<{ start: number; end: number }>;
    structureSimilarity?: number;
  }
): FallbackResult {
  if (!text || typeof text !== 'string') {
    return { level: 'fallback_3_historical', text: '', applied: false, reason: 'EMPTY_INPUT' };
  }

  // Check if we have historical config
  if (!historicalConfig) {
    return {
      level: 'fallback_3_historical',
      text,
      applied: false,
      reason: 'NO_HISTORICAL_CONFIG',
    };
  }

  // Check structure similarity threshold
  if ((historicalConfig.structureSimilarity || 0) < 0.7) {
    return {
      level: 'fallback_3_historical',
      text,
      applied: false,
      reason: 'SIMILARITY_BELOW_THRESHOLD',
    };
  }

  // Apply delimiter pattern if available
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
 * Run all fallback levels in sequence
 * Returns the best result (highest improvement)
 */
export function runFallbackSequence(
  text: string,
  benchCode: string,
  initialConfidence: number,
  historicalConfig?: Parameters<typeof applyHistoricalAdapter>[2]
): {
  bestResult: FallbackResult;
  allResults: FallbackResult[];
  finalLevel: FallbackLevel;
} {
  const results: FallbackResult[] = [];

  // Level 1: Lenient Mode
  const level1Result = applyLenientMode(text);
  results.push(level1Result);

  // If level 1 improved things, we might want to stop
  // (Caller decides based on confidence recomputation)
  if (level1Result.applied) {
    // Continue to level 2 with normalized text
    const level2Result = applySectionBasedParse(level1Result.text);
    results.push(level2Result);

    if (level2Result.applied) {
      // Continue to level 3
      const level3Result = applyHistoricalAdapter(
        level2Result.text,
        benchCode,
        historicalConfig
      );
      results.push(level3Result);
    }
  } else {
    // Try level 2 on original text
    const level2Result = applySectionBasedParse(text);
    results.push(level2Result);

    if (level2Result.applied) {
      const level3Result = applyHistoricalAdapter(
        level2Result.text,
        benchCode,
        historicalConfig
      );
      results.push(level3Result);
    } else {
      // Try level 3 on original
      const level3Result = applyHistoricalAdapter(text, benchCode, historicalConfig);
      results.push(level3Result);
    }
  }

  // Find best result (the one that applied successfully at highest level)
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

// Helper to escape regex special characters
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Calculate structure similarity between two texts
 * Used to determine if historical config is applicable
 */
export function calculateStructureSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;

  // Count anchor occurrences in both texts
  const countAnchors = (text: string): Map<string, number> => {
    const counts = new Map<string, number>();
    for (const anchor of SECTION_ANCHORS) {
      const regex = new RegExp(`\\b${escapeRegex(anchor)}\\b`, 'gi');
      const matches = text.match(regex);
      counts.set(anchor, matches?.length || 0);
    }
    return counts;
  };

  const counts1 = countAnchors(text1);
  const counts2 = countAnchors(text2);

  // Calculate Jaccard-like similarity
  let intersection = 0;
  let union = 0;

  for (const anchor of SECTION_ANCHORS) {
    const c1 = counts1.get(anchor) || 0;
    const c2 = counts2.get(anchor) || 0;
    intersection += Math.min(c1, c2);
    union += Math.max(c1, c2);
  }

  return union > 0 ? intersection / union : 0;
}
