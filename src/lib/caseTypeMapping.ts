/**
 * Case Type Normalization System
 * 
 * Three-layer fallback:
 * 1. Deterministic mapping (primary, authoritative)
 * 2. AI expansion (secondary, with confidence score)
 * 3. Safety fallback (if uncertain)
 */

// Deterministic case type abbreviation mappings (authoritative)
export const CASE_TYPE_MAPPINGS: Record<string, { fullName: string; category: string }> = {
  // Criminal Cases
  'CRL.M.C': { fullName: 'Criminal Miscellaneous Case', category: 'criminal' },
  'CRL.MC': { fullName: 'Criminal Miscellaneous Case', category: 'criminal' },
  'CRL.A': { fullName: 'Criminal Appeal', category: 'criminal' },
  'CRL.REV': { fullName: 'Criminal Revision', category: 'criminal' },
  'CRL.R': { fullName: 'Criminal Revision', category: 'criminal' },
  'BAIL': { fullName: 'Bail Application', category: 'criminal' },
  'S.B.CRL.MISC': { fullName: 'Single Bench Criminal Miscellaneous', category: 'criminal' },
  'SB.CRL.MISC': { fullName: 'Single Bench Criminal Miscellaneous', category: 'criminal' },
  'D.B.CRL.MISC': { fullName: 'Division Bench Criminal Miscellaneous', category: 'criminal' },
  'DB.CRL.A': { fullName: 'Division Bench Criminal Appeal', category: 'criminal' },
  'CRL.W.P': { fullName: 'Criminal Writ Petition', category: 'criminal' },
  
  // Civil Writ Petitions
  'SBCWP': { fullName: 'Single Bench Civil Writ Petition', category: 'civil-writ' },
  'S.B.C.W.P': { fullName: 'Single Bench Civil Writ Petition', category: 'civil-writ' },
  'S.B.CWP': { fullName: 'Single Bench Civil Writ Petition', category: 'civil-writ' },
  'DBCWP': { fullName: 'Division Bench Civil Writ Petition', category: 'civil-writ' },
  'D.B.C.W.P': { fullName: 'Division Bench Civil Writ Petition', category: 'civil-writ' },
  'D.B.CWP': { fullName: 'Division Bench Civil Writ Petition', category: 'civil-writ' },
  'CWP': { fullName: 'Civil Writ Petition', category: 'civil-writ' },
  'W.P': { fullName: 'Writ Petition', category: 'civil-writ' },
  'W.P.(C)': { fullName: 'Writ Petition Civil', category: 'civil-writ' },
  
  // Special Appeals
  'DBSA': { fullName: 'Division Bench Special Appeal', category: 'appeal' },
  'D.B.S.A': { fullName: 'Division Bench Special Appeal', category: 'appeal' },
  'D.B.SA': { fullName: 'Division Bench Special Appeal', category: 'appeal' },
  'S.A': { fullName: 'Special Appeal', category: 'appeal' },
  'SA': { fullName: 'Special Appeal', category: 'appeal' },
  'ITA': { fullName: 'Income Tax Appeal', category: 'appeal' },
  
  // Second Appeals & First Appeals
  'S.A.W': { fullName: 'Second Appeal (Writ)', category: 'appeal' },
  'SAW': { fullName: 'Second Appeal (Writ)', category: 'appeal' },
  'FA': { fullName: 'First Appeal', category: 'appeal' },
  'RSA': { fullName: 'Regular Second Appeal', category: 'appeal' },
  'R.S.A': { fullName: 'Regular Second Appeal', category: 'appeal' },
  'MFA': { fullName: 'Miscellaneous First Appeal', category: 'appeal' },
  'M.F.A': { fullName: 'Miscellaneous First Appeal', category: 'appeal' },
  'RFA': { fullName: 'Regular First Appeal', category: 'appeal' },
  'R.F.A': { fullName: 'Regular First Appeal', category: 'appeal' },
  
  // Civil Suits & Miscellaneous
  'CS': { fullName: 'Civil Suit', category: 'civil' },
  'CMA': { fullName: 'Civil Miscellaneous Appeal', category: 'civil' },
  'C.M.A': { fullName: 'Civil Miscellaneous Appeal', category: 'civil' },
  'CMI': { fullName: 'Civil Miscellaneous', category: 'civil' },
  'REV': { fullName: 'Civil Revision', category: 'civil' },
  'CRR': { fullName: 'Civil Revision', category: 'civil' },
  'EX': { fullName: 'Execution', category: 'civil' },
  
  // Motor Accident Claims
  'MACT': { fullName: 'Motor Accident Claims Tribunal', category: 'mact' },
  'MAC': { fullName: 'Motor Accident Claim', category: 'mact' },
  'MACP': { fullName: 'Motor Accident Claim Petition', category: 'mact' },
  
  // Labour & Industrial
  'LPA': { fullName: 'Letters Patent Appeal', category: 'labour' },
  'L.P.A': { fullName: 'Letters Patent Appeal', category: 'labour' },
  'WPLAB': { fullName: 'Writ Petition Labour', category: 'labour' },
  'WP(L)': { fullName: 'Writ Petition Labour', category: 'labour' },
  
  // Family & Matrimonial
  'MAT': { fullName: 'Matrimonial Case', category: 'family' },
  'HMA': { fullName: 'Hindu Marriage Act Case', category: 'family' },
  'GW': { fullName: 'Guardianship and Wards', category: 'family' },
  
  // Service Matters
  'STA': { fullName: 'Service Transfer Application', category: 'service' },
  'OA': { fullName: 'Original Application (Service)', category: 'service' },
  
  // Arbitration
  'ARB': { fullName: 'Arbitration', category: 'arbitration' },
  'ARB.P': { fullName: 'Arbitration Petition', category: 'arbitration' },
  'ARBP': { fullName: 'Arbitration Petition', category: 'arbitration' },
  
  // Company & Insolvency
  'CP': { fullName: 'Company Petition', category: 'company' },
  'IB': { fullName: 'Insolvency and Bankruptcy', category: 'company' },
  'IBCP': { fullName: 'Insolvency and Bankruptcy Code Petition', category: 'company' },
  
  // Tax & Revenue
  'TA': { fullName: 'Tax Appeal', category: 'tax' },
  'REF': { fullName: 'Reference Application', category: 'tax' },
  
  // PIL
  'PIL': { fullName: 'Public Interest Litigation', category: 'pil' },
  'DB PIL': { fullName: 'Division Bench Public Interest Litigation', category: 'pil' },
};

// Normalize case abbreviation for lookup
function normalizeAbbreviation(abbr: string): string {
  return abbr
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/\./g, '.')
    .trim();
}

// Extract case type abbreviation from case number
export function extractCaseTypeAbbr(caseNumber: string): string | null {
  if (!caseNumber) return null;
  
  // Common patterns for extracting case type
  // Pattern 1: S.B.C.W.P. 123/2024
  // Pattern 2: SBCWP 123/2024
  // Pattern 3: CRL.A. No. 123/2024
  
  const patterns = [
    /^([A-Z][A-Z.\s]+(?:No\.?)?)\s*\d+/i,
    /^((?:[A-Z]+\.?)+)\s*(?:No\.?)?\s*\d+/i,
    /^([A-Z.\s]+?)\s*(?:No\.?)?\d+/i,
  ];
  
  for (const pattern of patterns) {
    const match = caseNumber.match(pattern);
    if (match) {
      const extracted = match[1]
        .replace(/No\.?$/i, '')
        .replace(/\s+/g, '')
        .trim();
      if (extracted.length > 1) {
        return extracted;
      }
    }
  }
  
  return null;
}

export interface CaseTypeResolution {
  abbreviation: string;
  fullName: string;
  category: string;
  confidence: number; // 0-1
  source: 'deterministic' | 'ai-inferred' | 'unknown';
  isUncertain: boolean;
}

// Resolve case type with deterministic lookup
export function resolveCaseType(caseNumber: string): CaseTypeResolution {
  const abbr = extractCaseTypeAbbr(caseNumber);
  
  if (!abbr) {
    return {
      abbreviation: 'UNKNOWN',
      fullName: 'Unknown Case Type',
      category: 'unknown',
      confidence: 0,
      source: 'unknown',
      isUncertain: true,
    };
  }
  
  // Try exact match first
  const normalizedAbbr = normalizeAbbreviation(abbr);
  const exactMatch = CASE_TYPE_MAPPINGS[normalizedAbbr];
  
  if (exactMatch) {
    return {
      abbreviation: abbr,
      fullName: exactMatch.fullName,
      category: exactMatch.category,
      confidence: 1.0,
      source: 'deterministic',
      isUncertain: false,
    };
  }
  
  // Try without dots
  const withoutDots = normalizedAbbr.replace(/\./g, '');
  for (const [key, value] of Object.entries(CASE_TYPE_MAPPINGS)) {
    if (key.replace(/\./g, '') === withoutDots) {
      return {
        abbreviation: abbr,
        fullName: value.fullName,
        category: value.category,
        confidence: 0.95,
        source: 'deterministic',
        isUncertain: false,
      };
    }
  }
  
  // Try partial match
  for (const [key, value] of Object.entries(CASE_TYPE_MAPPINGS)) {
    const keyNormalized = key.replace(/\./g, '');
    if (withoutDots.includes(keyNormalized) || keyNormalized.includes(withoutDots)) {
      return {
        abbreviation: abbr,
        fullName: value.fullName + ' (Probable)',
        category: value.category,
        confidence: 0.7,
        source: 'deterministic',
        isUncertain: true,
      };
    }
  }
  
  // No match found - return as unknown for AI fallback
  return {
    abbreviation: abbr,
    fullName: abbr, // Use abbreviation as-is
    category: 'unknown',
    confidence: 0.3,
    source: 'unknown',
    isUncertain: true,
  };
}

// Get searchable terms for a case type category
export function getCategorySearchTerms(category: string): string[] {
  const categoryTerms: Record<string, string[]> = {
    'criminal': ['criminal', 'bail', 'quashing', 'FIR', 'arrest', 'anticipatory bail'],
    'civil-writ': ['writ', 'fundamental rights', 'Article 226', 'certiorari', 'mandamus'],
    'appeal': ['appeal', 'revision', 'review'],
    'civil': ['civil suit', 'injunction', 'specific performance', 'contract'],
    'mact': ['motor accident', 'compensation', 'insurance', 'Road accident'],
    'labour': ['labour', 'workman', 'industrial dispute', 'termination', 'reinstatement'],
    'family': ['divorce', 'maintenance', 'custody', 'matrimonial'],
    'service': ['service matter', 'government employee', 'pension', 'promotion'],
    'arbitration': ['arbitration', 'arbitral award', 'Section 34', 'Section 11'],
    'company': ['company', 'insolvency', 'liquidation', 'NCLT'],
    'tax': ['income tax', 'GST', 'customs', 'tax assessment'],
    'pil': ['public interest', 'PIL', 'locus standi'],
  };
  
  return categoryTerms[category] || [];
}

// Court ID mapping for Indian Kanoon search
export const COURT_ID_MAPPINGS: Record<string, string> = {
  'JAIPUR': 'rajasthan',
  'JODHPUR': 'rajasthan',
  'Rajasthan High Court': 'rajasthan',
  'Rajasthan High Court - Jaipur': 'rajasthan',
  'Rajasthan High Court - Jodhpur': 'rajasthan',
  'Supreme Court of India': 'supremecourt',
  'Supreme Court': 'supremecourt',
  'Delhi High Court': 'delhi',
  'Delhi': 'delhi',
  'Bombay High Court': 'bombay',
  'Mumbai': 'bombay',
  'Calcutta High Court': 'calcutta',
  'Kolkata': 'calcutta',
  'Madras High Court': 'madras',
  'Chennai': 'madras',
  'Karnataka High Court': 'karnataka',
  'Bangalore': 'karnataka',
  'Gujarat High Court': 'gujarat',
  'Ahmedabad': 'gujarat',
  'Allahabad High Court': 'allahabad',
  'Punjab and Haryana High Court': 'punjab',
  'Chandigarh': 'punjab',
};

export function getCourtId(court: string): string {
  if (!court) return '';
  
  // Exact match
  if (COURT_ID_MAPPINGS[court]) {
    return COURT_ID_MAPPINGS[court];
  }
  
  // Partial match
  for (const [key, value] of Object.entries(COURT_ID_MAPPINGS)) {
    if (court.toLowerCase().includes(key.toLowerCase()) || 
        key.toLowerCase().includes(court.toLowerCase())) {
      return value;
    }
  }
  
  // Fallback: use normalized court name
  return court.toLowerCase().replace(/\s+/g, '');
}
