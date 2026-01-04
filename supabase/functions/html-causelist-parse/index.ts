import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Dynamic batch sizing: aim for ~20 batches, min 25, max 200 per batch
function calculateBatchSize(totalRecords: number): number {
  if (totalRecords <= 50) return totalRecords; // Single batch for small lists
  if (totalRecords <= 200) return 50;
  if (totalRecords <= 500) return 75;
  if (totalRecords <= 1000) return 100;
  if (totalRecords <= 2000) return 125;
  return 150; // Large lists: 150 per batch
}

interface ParsedCase {
  court_no: string;
  case_number: string;
  item_no: number | null;
  petitioner: string | null;
  respondent: string | null;
  petitioner_lawyer: string | null;
  respondent_lawyer: string | null;
  judge_names: string | null;
  stage: string | null;
  next_date: string | null;
}

interface ExtractedNote {
  note_type: string;
  note_text: string;
  court_no?: string;
}

interface PolicyClassification {
  policy_scope: 'GLOBAL' | 'COURT' | 'BENCH' | 'UNKNOWN';
  priority_rule: 'SUPPLEMENTARY_FIRST' | 'MAIN_ONLY' | 'TIME_BOUND' | 'UNSPECIFIED';
  time_condition: 'IF_TIME_PERMITS' | 'FIXED_ORDER' | 'UNKNOWN';
  confidence: number;
  court_no: string | null;
}

interface DerivedPolicy {
  raw_causelist_id: string;
  policy_text: string;
  policy_scope: string;
  priority_rule: string;
  time_condition: string;
  confidence: number;
  court_no: string | null;
  bench: string;
  authority_level: string;
}

interface DocketRecord {
  court_location: string;
  court_room_no: string;
  case_number: string;
  date: string;
  item_no: number | null;
  petitioner: string | null;
  respondent: string | null;
  petitioner_lawyer: string | null;
  respondent_lawyer: string | null;
  judge_names: string | null;
  list_type: string;
  status: string;
  origin: string;
  confidence_source: string;
  structure_confidence: number;
  raw_causelist_id: string;
  source_url: string;
}

interface ParseRequest {
  causelist_id: string;
}

// NOTE patterns for HTML extraction
const NOTE_PATTERNS = [
  { pattern: /NOTE\s*[:\-]\s*([^\n<]+(?:\n(?![A-Z]{2,})[^\n<]+)*)/gi, type: 'NOTE' },
  { pattern: /IMPORTANT\s*[:\-]\s*([^\n<]+(?:\n(?![A-Z]{2,})[^\n<]+)*)/gi, type: 'IMPORTANT' },
  { pattern: /DIRECTION\s*[:\-]\s*([^\n<]+(?:\n(?![A-Z]{2,})[^\n<]+)*)/gi, type: 'DIRECTION' },
  { pattern: /N\.B\.\s*[:\-]?\s*([^\n<]+(?:\n(?![A-Z]{2,})[^\n<]+)*)/gi, type: 'NOTE' },
  { pattern: /SUPPLEMENTARY\s+(?:LIST|CAUSE\s*LIST)[:\-]?\s*([^\n<]+)/gi, type: 'SUPPLEMENTARY_NOTE' },
  { pattern: /(?:subject\s+to|if\s+time\s+permits|time\s+permitting)[^\.]*\./gi, type: 'TIME_CONDITION' },
];

// =============================================================================
// PHASE 1: PARSING FUNCTIONS (In-Memory Only)
// =============================================================================

// Extract notes from HTML content - PURE FUNCTION, NO DB
function extractNotesFromHtml(html: string): ExtractedNote[] {
  const notes: ExtractedNote[] = [];
  const textContent = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ');
  
  for (const { pattern, type } of NOTE_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    const matches = textContent.matchAll(regex);
    for (const match of matches) {
      const noteText = match[1]?.trim() || match[0]?.trim();
      if (noteText && noteText.length > 10 && noteText.length < 2000) {
        const courtMatch = noteText.match(/court\s*(?:no\.?|number)?\s*:?\s*(\d+)/i);
        notes.push({
          note_type: type,
          note_text: noteText,
          court_no: courtMatch?.[1] || undefined,
        });
      }
    }
  }
  
  // Deduplicate notes by text
  const seen = new Set<string>();
  return notes.filter(note => {
    const key = note.note_text.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Court name normalization map
const COURT_NORMALIZATION_MAP: Record<string, string> = {};
for (let i = 1; i <= 30; i++) {
  COURT_NORMALIZATION_MAP[`court no. ${i}`] = String(i);
  COURT_NORMALIZATION_MAP[`court no.${i}`] = String(i);
  COURT_NORMALIZATION_MAP[`court ${i}`] = String(i);
  COURT_NORMALIZATION_MAP[`courtno.${i}`] = String(i);
  COURT_NORMALIZATION_MAP[`courtno ${i}`] = String(i);
}

function normalizeCourtNo(courtText: string): string {
  const lower = courtText.toLowerCase().trim();
  if (COURT_NORMALIZATION_MAP[lower]) {
    return COURT_NORMALIZATION_MAP[lower];
  }
  const match = lower.match(/(\d+)/);
  return match ? match[1] : courtText;
}

// Extract all case rows from HTML - PURE FUNCTION, NO DB
function parseHtmlCauselist(html: string): { cases: ParsedCase[]; courts: string[] } {
  const cases: ParsedCase[] = [];
  const courtsFound = new Set<string>();
  
  const courtBlockPattern = /Court\s*No\.?\s*:?\s*(\d+)/gi;
  const courtMarkers: { index: number; courtNo: string }[] = [];
  
  let match;
  while ((match = courtBlockPattern.exec(html)) !== null) {
    courtMarkers.push({ index: match.index, courtNo: match[1] });
    courtsFound.add(match[1]);
  }
  
  console.log(`[PHASE-1] Found ${courtMarkers.length} court markers: ${[...courtsFound].join(', ')}`);
  
  if (courtMarkers.length === 0) {
    const singleCourtCases = extractCasesFromSection(html, '1');
    cases.push(...singleCourtCases);
  } else {
    for (let i = 0; i < courtMarkers.length; i++) {
      const startIdx = courtMarkers[i].index;
      const endIdx = i < courtMarkers.length - 1 ? courtMarkers[i + 1].index : html.length;
      const courtSection = html.substring(startIdx, endIdx);
      const courtNo = courtMarkers[i].courtNo;
      
      const sectionCases = extractCasesFromSection(courtSection, courtNo);
      cases.push(...sectionCases);
    }
  }
  
  return { cases, courts: [...courtsFound] };
}

// Case number patterns for detecting if a row starts a new case
const CASE_NUMBER_PATTERNS = [
  /\b[A-Z]{1,4}\.?\s*[A-Z]*\.?\s*(?:Criminal|Civil|Writ|Appeal|Misc|Review|Original|Transfer|Tax|Motor|Arbitration|Reference|PIL|Contempt)?\.?\s*\w*\.?\s*\d+\/\d{4}/i,
  /\b(?:S\.?B\.?|D\.?B\.?)\s*(?:Criminal|Civil|Writ)?\s*\w*\.?\s*\d+\/\d{4}/i,
  /\bCRL\.?\s*\w*\.?\s*\d+\/\d{4}/i,
  /\bCW\.?\s*\w*\.?\s*\d+\/\d{4}/i,
  /\b\w+\.\w*\.?\s*\d+\/\d{4}/i,
  /\bIN\s+CR[A-Z]*\.?\s*\d+\/\d{4}/i,
  /\b(?:WP|CP|SA|FA|CA|MA|RA|TA|BA|CRA|SB|DB)\s*\(?\s*\w*\s*\)?\s*\d+\/\d{4}/i,
];

interface PartialCase {
  item_no: number;
  case_number: string;
  raw_rows: string[][];
}

// Configuration for item number detection
const MIN_ITEM_NUMBER = 1;
const MAX_ITEM_NUMBER = 500; // Courts rarely have more than 500 items per court

/**
 * Extract item number from FIRST TWO cells only (positional guard).
 * Only accepts 1-3 digit numbers within reasonable range (range guard).
 * This prevents false matches from case years (2023, 2024) and case identifiers (5400).
 * 
 * @param cells - Array of cell text content
 * @param previousItem - The last known item number (for continuity check)
 * @returns The detected item number, or null if not found
 */
function extractItemNumber(cells: string[], previousItem: number | null = null): number | null {
  // POSITIONAL GUARD: Only check first 2 cells
  const cellsToCheck = Math.min(2, cells.length);
  
  for (let i = 0; i < cellsToCheck; i++) {
    const trimmed = cells[i].trim();
    
    // Only match 1-3 digit numbers (optionally with trailing period)
    // This regex rejects 4+ digit numbers like years (2023) or case numbers (5400)
    const match = trimmed.match(/^(\d{1,3})\.?$/);
    if (!match) continue;
    
    const num = parseInt(match[1], 10);
    
    // RANGE GUARD: Reject numbers outside reasonable serial range
    if (num < MIN_ITEM_NUMBER || num > MAX_ITEM_NUMBER) {
      continue;
    }
    
    // CONTINUITY GUARD: If we have a previous item, check for reasonable jump
    // This prevents random numbers from resetting item state
    if (previousItem !== null && Math.abs(num - previousItem) > 100) {
      // Large jump - likely not a real item number sequence
      continue;
    }
    
    return num;
  }
  
  return null;
}

/**
 * Check if row text contains a case number (indicating start of new case).
 * Scans the combined text of all cells.
 */
function rowHasCaseNumber(cells: string[]): boolean {
  const combinedText = cells.join(' ');
  for (const pattern of CASE_NUMBER_PATTERNS) {
    if (pattern.test(combinedText)) {
      return true;
    }
  }
  return false;
}

/**
 * Extract the case number from row cells.
 */
function extractCaseNumber(cells: string[]): string | null {
  const combinedText = cells.join(' ');
  for (const pattern of CASE_NUMBER_PATTERNS) {
    const match = combinedText.match(pattern);
    if (match) {
      return match[0].trim();
    }
  }
  return null;
}

/**
 * Check if row is a header row that should be skipped.
 */
function isHeaderRow(cells: string[]): boolean {
  const rowText = cells.join(' ').toLowerCase();
  return (
    rowText.includes('sr. no') ||
    rowText.includes('serial') ||
    rowText.includes('s. no') ||
    rowText.includes('sno.') ||
    (rowText.includes('case number') && rowText.includes('advocate')) ||
    (rowText.includes('petitioner') && rowText.includes('respondent') && rowText.includes('advocate'))
  );
}

/**
 * Finalize a partial case into a full ParsedCase by extracting
 * parties, lawyers, and other details from combined row data.
 */
function finalizeParsedCase(partial: PartialCase, courtNo: string): ParsedCase {
  const allCells = partial.raw_rows.flat();
  const combinedText = allCells.join(' ');
  
  const parsedCase: ParsedCase = {
    court_no: courtNo,
    case_number: partial.case_number,
    item_no: partial.item_no,
    petitioner: null,
    respondent: null,
    petitioner_lawyer: null,
    respondent_lawyer: null,
    judge_names: null,
    stage: null,
    next_date: null,
  };
  
  // Extract parties from combined text (vs/v/s/versus patterns)
  for (const cell of allCells) {
    if (cell.toLowerCase().includes(' vs ') || cell.toLowerCase().includes(' v/s ') || 
        cell.toLowerCase().includes(' versus ') || cell.includes(' Vs. ') || cell.includes(' VS ')) {
      const parts = cell.split(/\s+(?:vs\.?|v\/s|versus|VS)\s+/i);
      if (parts.length >= 2) {
        parsedCase.petitioner = parts[0].trim().substring(0, 500) || null;
        parsedCase.respondent = parts[1].trim().substring(0, 500) || null;
      }
      break;
    }
  }
  
  // Extract lawyers from combined rows (patterns like "Name -P" or "Name -R")
  const petLawyers: string[] = [];
  const respLawyers: string[] = [];
  
  for (const cell of allCells) {
    // Petitioner lawyer patterns
    const petLawyerMatches = cell.match(/([A-Z][A-Za-z\s\.]+)\s*[-–]\s*P(?:\b|$)/gi);
    if (petLawyerMatches) {
      petLawyers.push(...petLawyerMatches.map(m => m.replace(/[-–]\s*P$/i, '').trim()));
    }
    
    // Respondent lawyer patterns  
    const respLawyerMatches = cell.match(/([A-Z][A-Za-z\s\.]+)\s*[-–]\s*R(?:\b|$)/gi);
    if (respLawyerMatches) {
      respLawyers.push(...respLawyerMatches.map(m => m.replace(/[-–]\s*R$/i, '').trim()));
    }
  }
  
  if (petLawyers.length > 0) {
    parsedCase.petitioner_lawyer = [...new Set(petLawyers)].join(', ');
  }
  if (respLawyers.length > 0) {
    parsedCase.respondent_lawyer = [...new Set(respLawyers)].join(', ');
  }
  
  // Extract stage from keywords
  const stageKeywords = ['fresh', 'hearing', 'admission', 'final', 'arguments', 'orders', 'misc', 'motion', 'regular'];
  for (const cell of allCells) {
    const cellLower = cell.toLowerCase();
    for (const stage of stageKeywords) {
      if (cellLower.includes(stage)) {
        parsedCase.stage = cell.trim();
        break;
      }
    }
    if (parsedCase.stage) break;
  }
  
  // Extract next date
  const datePattern = /\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/;
  for (const cell of allCells) {
    const dateMatch = cell.match(datePattern);
    if (dateMatch) {
      parsedCase.next_date = dateMatch[0];
      break;
    }
  }
  
  return parsedCase;
}

/**
 * STATEFUL PARSER: Core fix for continuation row handling.
 * 
 * Key insight: Item number is CONTEXT that persists across rows.
 * A case may span multiple <tr> elements.
 * 
 * This parser:
 * 1. Treats item number as state, not a row property
 * 2. Attaches continuation rows to the current case
 * 3. Only starts a new case when a case number is found
 * 4. Never skips rows due to missing item numbers
 */
function extractCasesFromSection(html: string, courtNo: string): ParsedCase[] {
  const cases: ParsedCase[] = [];
  
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  
  // =============================================
  // CRITICAL STATE VARIABLES
  // These persist across rows - this is the fix!
  // =============================================
  let currentItemNumber: number | null = null;
  let currentCase: PartialCase | null = null;
  
  // Collect all rows first
  const rows: string[][] = [];
  let rowMatch;
  
  while ((rowMatch = rowPattern.exec(html)) !== null) {
    const rowContent = rowMatch[1];
    const cells: string[] = [];
    
    let cellMatch;
    while ((cellMatch = cellPattern.exec(rowContent)) !== null) {
      const cellText = cellMatch[1]
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#\d+;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      cells.push(cellText);
    }
    cellPattern.lastIndex = 0;
    
    if (cells.length > 0) {
      rows.push(cells);
    }
  }
  
  console.log(`[PARSER] Court ${courtNo}: Processing ${rows.length} rows`);
  
  // =============================================
  // SEQUENTIAL STATEFUL PROCESSING
  // =============================================
  for (const cells of rows) {
    // Skip rows with too few cells (likely structural/layout)
    if (cells.length < 2) continue;
    
    // Skip obvious header rows
    if (isHeaderRow(cells)) continue;
    
    // -----------------------------------------
    // STEP 1: Detect item number if present
    // This updates our context state
    // Pass currentItemNumber for continuity guard
    // -----------------------------------------
    const maybeItemNo = extractItemNumber(cells, currentItemNumber);
    if (maybeItemNo !== null) {
      currentItemNumber = maybeItemNo;
    }
    
    // -----------------------------------------
    // STEP 2: Skip if no item context yet
    // (These are header/note rows before first item)
    // -----------------------------------------
    if (currentItemNumber === null) {
      continue;
    }
    
    // -----------------------------------------
    // STEP 3: Check if row starts a new case
    // -----------------------------------------
    const hasCaseNumber = rowHasCaseNumber(cells);
    
    if (hasCaseNumber) {
      // Flush previous case if exists
      if (currentCase !== null) {
        cases.push(finalizeParsedCase(currentCase, courtNo));
      }
      
      // Start new case with current item context
      const caseNumber = extractCaseNumber(cells);
      currentCase = {
        item_no: currentItemNumber,
        case_number: caseNumber || 'UNKNOWN',
        raw_rows: [cells],
      };
    } else {
      // -----------------------------------------
      // STEP 4: Continuation row
      // Attach to current case (this is the key fix!)
      // -----------------------------------------
      if (currentCase !== null) {
        currentCase.raw_rows.push(cells);
      }
      // If no current case, this is likely a note/header - skip
    }
  }
  
  // Flush the last case
  if (currentCase !== null) {
    cases.push(finalizeParsedCase(currentCase, courtNo));
  }
  
  // =============================================
  // PARSER INVARIANT: Detect significant gaps
  // =============================================
  if (cases.length > 0) {
    const itemNumbers = cases.map(c => c.item_no).filter((n): n is number => n !== null);
    const maxItem = Math.max(...itemNumbers, 0);
    const uniqueItems = new Set(itemNumbers).size;
    const coverage = maxItem > 0 ? (uniqueItems / maxItem) * 100 : 100;
    
    console.log(`[PARSER] Court ${courtNo}: ${cases.length} cases, ${uniqueItems}/${maxItem} items (${coverage.toFixed(1)}% coverage)`);
    
    // Warn if coverage is below 80%
    if (maxItem > 10 && uniqueItems < maxItem * 0.8) {
      console.warn(`[PARSER-INTEGRITY-WARNING] Court ${courtNo}: GAPS DETECTED! Expected ~${maxItem} items, got ${uniqueItems} unique (${coverage.toFixed(1)}%). Review HTML structure.`);
    }
  }
  
  return cases;
}

function detectBenchFromHtml(html: string): 'JAIPUR' | 'JODHPUR' {
  const htmlLower = html.toLowerCase();
  const jaipurCount = (htmlLower.match(/jaipur/g) || []).length;
  const jodhpurCount = (htmlLower.match(/jodhpur/g) || []).length;
  return jodhpurCount > jaipurCount ? 'JODHPUR' : 'JAIPUR';
}

function extractDateFromHtml(html: string): string {
  const patterns = [
    /(?:dated?|for)\s*:?\s*(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/i,
    /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/,
  ];
  
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[3] && match[3].length === 4) {
      const day = match[1].padStart(2, '0');
      const month = match[2].padStart(2, '0');
      const year = match[3];
      return `${year}-${month}-${day}`;
    }
  }
  
  return new Date().toISOString().split('T')[0];
}

function extractJudgesFromHtml(html: string, courtNo: string): string | null {
  const courtPattern = new RegExp(`Court\\s*No\\.?\\s*:?\\s*${courtNo}[\\s\\S]{0,500}`, 'i');
  const courtSection = html.match(courtPattern);
  
  if (courtSection) {
    const judgePattern = /Hon['']?ble\s+(?:Mr\.?\s+)?Justice\s+([A-Z][A-Za-z\s\.]+)/gi;
    const judges: string[] = [];
    let judgeMatch;
    
    while ((judgeMatch = judgePattern.exec(courtSection[0])) !== null) {
      judges.push(judgeMatch[1].trim());
    }
    
    if (judges.length > 0) {
      return judges.join(', ');
    }
  }
  
  return null;
}

// =============================================================================
// PHASE 2: POLICY DERIVATION (In-Memory Only)
// =============================================================================

function classifyPolicy(noteText: string, noteType: string): PolicyClassification {
  const textLower = noteText.toLowerCase();
  
  let policy_scope: PolicyClassification['policy_scope'] = 'UNKNOWN';
  let priority_rule: PolicyClassification['priority_rule'] = 'UNSPECIFIED';
  let time_condition: PolicyClassification['time_condition'] = 'UNKNOWN';
  let confidence = 0.8;
  let court_no: string | null = null;
  
  // Detect scope
  const courtMatch = noteText.match(/court\s*(?:no\.?|number)?\s*:?\s*(\d+)/i);
  if (courtMatch) {
    policy_scope = 'COURT';
    court_no = courtMatch[1];
    confidence = 0.9;
  } else if (textLower.includes('all courts') || textLower.includes('all benches')) {
    policy_scope = 'GLOBAL';
    confidence = 0.95;
  } else if (textLower.includes('bench') || textLower.includes('hon\'ble') || textLower.includes('justice')) {
    policy_scope = 'BENCH';
    confidence = 0.85;
  }
  
  // Detect priority rule
  if (textLower.includes('supplementary') && (textLower.includes('first') || textLower.includes('priority') || textLower.includes('before'))) {
    priority_rule = 'SUPPLEMENTARY_FIRST';
    confidence = Math.max(confidence, 0.9);
  } else if (textLower.includes('main list only') || textLower.includes('daily list only')) {
    priority_rule = 'MAIN_ONLY';
    confidence = Math.max(confidence, 0.9);
  } else if (textLower.includes('time bound') || textLower.includes('fixed time') || noteText.match(/\d{1,2}[:\.\s]?\d{2}\s*(?:am|pm|AM|PM)/)) {
    priority_rule = 'TIME_BOUND';
    confidence = Math.max(confidence, 0.85);
  }
  
  // Detect time condition
  if (textLower.includes('if time permits') || textLower.includes('time permitting') || textLower.includes('subject to time') || textLower.includes('subject to availability')) {
    time_condition = 'IF_TIME_PERMITS';
    confidence = Math.max(confidence, 0.95);
  } else if (textLower.includes('fixed order') || textLower.includes('serial order') || textLower.includes('strict order')) {
    time_condition = 'FIXED_ORDER';
    confidence = Math.max(confidence, 0.9);
  }
  
  // High confidence for IMPORTANT or DIRECTION types
  if (noteType === 'IMPORTANT' || noteType === 'DIRECTION') {
    confidence = Math.min(confidence + 0.05, 0.99);
  }
  
  return { policy_scope, priority_rule, time_condition, confidence, court_no };
}

function derivePoliciesInMemory(
  notes: ExtractedNote[],
  causelistId: string,
  bench: string
): DerivedPolicy[] {
  return notes.map(note => {
    const classification = classifyPolicy(note.note_text, note.note_type);
    return {
      raw_causelist_id: causelistId,
      policy_text: note.note_text,
      policy_scope: classification.policy_scope,
      priority_rule: classification.priority_rule,
      time_condition: classification.time_condition,
      confidence: classification.confidence,
      court_no: classification.court_no || note.court_no || null,
      bench: bench,
      authority_level: 'JUDICIAL_NOTE',
    };
  });
}

// =============================================================================
// PHASE 3: BATCH PERSISTENCE
// =============================================================================

// deno-lint-ignore no-explicit-any
async function batchUpsertCases(
  supabase: any,
  records: DocketRecord[]
): Promise<{ inserted: number; updated: number; errors: string[] }> {
  let inserted = 0;
  let updated = 0;
  const errors: string[] = [];
  
  const batchSize = calculateBatchSize(records.length);
  const totalBatches = Math.ceil(records.length / batchSize);
  console.log(`[PHASE-3] Dynamic batch size: ${batchSize} (${totalBatches} batches for ${records.length} cases)`);
  
  for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
    const start = batchNum * batchSize;
    const end = Math.min(start + batchSize, records.length);
    const batch = records.slice(start, end);
    
    console.log(`[PHASE-3] Processing batch ${batchNum + 1}/${totalBatches} (${batch.length} cases)`);
    
    try {
      // Use upsert with unique index for efficient batch operations
      // The unique index idx_daily_court_docket_unique_case handles conflicts
      const { data, error } = await supabase
        .from('daily_court_docket')
        .upsert(batch, {
          onConflict: 'court_location,court_room_no,case_number,date',
          ignoreDuplicates: false,
        })
        .select('id');
      
      if (error) {
        // If upsert fails, try simple insert (ignore duplicates)
        console.log(`[PHASE-3] Batch ${batchNum + 1} upsert error: ${error.message}, trying insert...`);
        
        const { data: insertData, error: insertError } = await supabase
          .from('daily_court_docket')
          .insert(batch)
          .select('id');
        
        if (insertError) {
          // Some records may be duplicates - this is expected, count what we got
          if (insertError.message.includes('duplicate') || insertError.message.includes('unique')) {
            console.log(`[PHASE-3] Batch ${batchNum + 1}: duplicates found, records already exist`);
            updated += batch.length; // Count as updates (already exist)
          } else {
            console.error(`[PHASE-3] Batch ${batchNum + 1} insert failed: ${insertError.message}`);
            errors.push(`Batch ${batchNum + 1}: ${insertError.message}`);
          }
        } else {
          inserted += insertData?.length || 0;
          console.log(`[PHASE-3] Batch ${batchNum + 1} inserted: ${insertData?.length || 0}`);
        }
      } else {
        inserted += data?.length || batch.length;
        console.log(`[PHASE-3] Batch ${batchNum + 1} upserted: ${data?.length || batch.length} records`);
      }
    } catch (batchError) {
      const errorMsg = batchError instanceof Error ? batchError.message : 'Unknown error';
      console.error(`[PHASE-3] Batch ${batchNum + 1} exception:`, errorMsg);
      errors.push(`Batch ${batchNum + 1}: ${errorMsg}`);
    }
  }
  
  return { inserted, updated, errors };
}

// deno-lint-ignore no-explicit-any
async function batchInsertPolicies(
  supabase: any,
  policies: DerivedPolicy[]
): Promise<{ inserted: number; errors: string[] }> {
  let inserted = 0;
  const errors: string[] = [];
  
  if (policies.length === 0) return { inserted, errors };
  
  const batchSize = calculateBatchSize(policies.length);
  const totalBatches = Math.ceil(policies.length / batchSize);
  
  for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
    const start = batchNum * batchSize;
    const end = Math.min(start + batchSize, policies.length);
    const batch = policies.slice(start, end);
    
    console.log(`[PHASE-3] Inserting policy batch ${batchNum + 1}/${totalBatches} (${batch.length} policies)`);
    
    try {
      const { data, error } = await supabase
        .from('daily_execution_policies')
        .insert(batch)
        .select('id');
      
      if (error) {
        console.error(`[PHASE-3] Policy batch ${batchNum + 1} error:`, error.message);
        errors.push(`Policy batch ${batchNum + 1}: ${error.message}`);
      } else {
        inserted += data?.length || batch.length;
        console.log(`[PHASE-3] Policy batch ${batchNum + 1} success: ${data?.length || batch.length} policies`);
      }
    } catch (batchError) {
      const errorMsg = batchError instanceof Error ? batchError.message : 'Unknown error';
      errors.push(`Policy batch ${batchNum + 1}: ${errorMsg}`);
    }
  }
  
  return { inserted, errors };
}

// deno-lint-ignore no-explicit-any
async function batchInsertNotes(
  supabase: any,
  notes: ExtractedNote[],
  causelistId: string
): Promise<{ inserted: number; errors: string[] }> {
  let inserted = 0;
  const errors: string[] = [];
  
  if (notes.length === 0) return { inserted, errors };
  
  const notesToInsert = notes.map(note => ({
    raw_causelist_id: causelistId,
    note_type: note.note_type,
    note_text: note.note_text,
  }));
  
  try {
    const { data, error } = await supabase
      .from('cause_list_notes')
      .insert(notesToInsert)
      .select('id');
    
    if (error) {
      errors.push(`Notes insert: ${error.message}`);
    } else {
      inserted = data?.length || notesToInsert.length;
    }
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : 'Unknown error';
    errors.push(`Notes insert: ${errorMsg}`);
  }
  
  return { inserted, errors };
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { causelist_id }: ParseRequest = await req.json();
    
    if (!causelist_id) {
      return new Response(
        JSON.stringify({ error: 'causelist_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[HTML-CAUSELIST-PARSE] Starting 4-phase processing for: ${causelist_id}`);

    // Fetch causelist
    const { data: causelist, error: fetchError } = await supabase
      .from('raw_causelists')
      .select('*')
      .eq('id', causelist_id)
      .single();

    if (fetchError || !causelist) {
      console.error('[HTML-CAUSELIST-PARSE] Failed to fetch causelist:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Causelist not found', details: fetchError }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let htmlContent = causelist.text_content;
    
    if (!htmlContent && causelist.storage_path) {
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('causelist-pdfs')
        .download(causelist.storage_path);
      
      if (downloadError) {
        console.error('[HTML-CAUSELIST-PARSE] Failed to download file:', downloadError);
        return new Response(
          JSON.stringify({ error: 'Failed to download HTML file' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      htmlContent = await fileData.text();
    }

    if (!htmlContent) {
      return new Response(
        JSON.stringify({ error: 'No HTML content available' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const bench = causelist.bench || detectBenchFromHtml(htmlContent);
    const listDate = causelist.list_date || extractDateFromHtml(htmlContent);

    // =========================================================================
    // PHASE 1: PARSE EVERYTHING IN MEMORY
    // =========================================================================
    console.log('[PHASE-1] Parsing HTML content in memory...');
    const phase1Start = Date.now();
    
    const { cases, courts } = parseHtmlCauselist(htmlContent);
    const extractedNotes = extractNotesFromHtml(htmlContent);
    
    console.log(`[PHASE-1] Complete: ${cases.length} cases, ${courts.length} courts, ${extractedNotes.length} notes (${Date.now() - phase1Start}ms)`);

    if (cases.length === 0) {
      await supabase
        .from('raw_causelists')
        .update({ status: 'parsed_empty' })
        .eq('id', causelist_id);
      
      return new Response(
        JSON.stringify({ success: true, cases_found: 0, cases_inserted: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =========================================================================
    // PHASE 2: DERIVE POLICIES IN MEMORY
    // =========================================================================
    console.log('[PHASE-2] Deriving execution policies in memory...');
    const phase2Start = Date.now();
    
    const derivedPolicies = derivePoliciesInMemory(extractedNotes, causelist_id, bench);
    
    // Fetch court metadata for judge name lookups
    const { data: courtMetadata } = await supabase
      .from('court_metadata')
      .select('court_no, sitting_judges')
      .eq('bench', bench);
    
    const judgesByCourtNo = new Map<string, string>();
    if (courtMetadata) {
      for (const cm of courtMetadata) {
        judgesByCourtNo.set(cm.court_no, cm.sitting_judges);
      }
    }
    console.log(`[PHASE-2] Loaded ${judgesByCourtNo.size} court->judge mappings from metadata`);
    
    // Prepare docket records
    const docketRecords: DocketRecord[] = cases.map(caseData => {
      const courtNo = normalizeCourtNo(caseData.court_no);
      // Try: parsed judge_names -> extract from HTML -> court_metadata lookup
      const judgeNames = caseData.judge_names 
        || extractJudgesFromHtml(htmlContent, courtNo)
        || judgesByCourtNo.get(courtNo)
        || null;
      
      return {
        court_location: bench,
        court_room_no: courtNo,
        case_number: caseData.case_number,
        date: listDate,
        item_no: caseData.item_no,
        petitioner: caseData.petitioner,
        respondent: caseData.respondent,
        petitioner_lawyer: caseData.petitioner_lawyer,
        respondent_lawyer: caseData.respondent_lawyer,
        judge_names: judgeNames,
        list_type: 'DAILY',
        status: 'pending',
        origin: 'HTML_FULL_CAUSELIST',
        confidence_source: 'court_structure',
        structure_confidence: 0.9,
        raw_causelist_id: causelist_id,
        source_url: `html:${causelist_id}`,
      };
    });
    
    console.log(`[PHASE-2] Complete: ${derivedPolicies.length} policies derived (${Date.now() - phase2Start}ms)`);

    // =========================================================================
    // PHASE 3: BATCH PERSISTENCE
    // =========================================================================
    console.log('[PHASE-3] Starting batch persistence...');
    const phase3Start = Date.now();
    
    // Insert notes first (small batch)
    const notesResult = await batchInsertNotes(supabase, extractedNotes, causelist_id);
    console.log(`[PHASE-3] Notes: ${notesResult.inserted} inserted`);
    
    // Insert policies
    const policiesResult = await batchInsertPolicies(supabase, derivedPolicies);
    console.log(`[PHASE-3] Policies: ${policiesResult.inserted} inserted`);
    
    // Insert/upsert cases in batches
    const casesResult = await batchUpsertCases(supabase, docketRecords);
    console.log(`[PHASE-3] Cases: ${casesResult.inserted} inserted, ${casesResult.updated} updated`);
    
    // Update causelist status
    await supabase
      .from('raw_causelists')
      .update({ 
        status: 'parsed_complete',
        input_format: 'HTML',
        source_granularity: 'FULL_CAUSELIST',
        structure_confidence: 0.9,
      })
      .eq('id', causelist_id);
    
    console.log(`[PHASE-3] Complete (${Date.now() - phase3Start}ms)`);

    // =========================================================================
    // PHASE 4: TRIGGER LIKELIHOOD DERIVATION
    // =========================================================================
    console.log('[PHASE-4] Triggering hearing likelihood derivation...');
    const phase4Start = Date.now();
    
    // Only trigger if we have policies OR successfully inserted cases
    if (policiesResult.inserted > 0 || casesResult.inserted > 0 || casesResult.updated > 0) {
      try {
        await supabase.functions.invoke('derive-hearing-likelihood', {
          body: { causelist_id, date: listDate, bench }
        });
        console.log(`[PHASE-4] Likelihood derivation triggered`);
      } catch (e) {
        console.log('[PHASE-4] Likelihood derivation deferred (will run async)');
      }
      
      // Trigger alias matching
      try {
        await supabase.functions.invoke('match-docket-aliases', {
          body: { causelist_id, date: listDate, bench }
        });
        console.log(`[PHASE-4] Alias matching triggered`);
      } catch (e) {
        console.log('[PHASE-4] Alias matching deferred');
      }
    }
    
    console.log(`[PHASE-4] Complete (${Date.now() - phase4Start}ms)`);

    const totalTime = Date.now() - startTime;
    console.log(`[HTML-CAUSELIST-PARSE] All phases complete in ${totalTime}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        phases: {
          parse: `${cases.length} cases, ${extractedNotes.length} notes`,
          policies: `${derivedPolicies.length} derived`,
          persist: `${casesResult.inserted} inserted, ${casesResult.updated} updated`,
          likelihood: policiesResult.inserted > 0 ? 'triggered' : 'skipped (no policies)',
        },
        cases_found: cases.length,
        cases_inserted: casesResult.inserted,
        cases_updated: casesResult.updated,
        courts_processed: courts.length,
        notes_extracted: extractedNotes.length,
        policies_created: policiesResult.inserted,
        processing_time_ms: totalTime,
        errors: [...casesResult.errors, ...policiesResult.errors, ...notesResult.errors].slice(0, 10),
        bench,
        list_date: listDate,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[HTML-CAUSELIST-PARSE] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
