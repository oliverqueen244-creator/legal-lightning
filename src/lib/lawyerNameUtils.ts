/**
 * Utility functions for normalizing lawyer names
 * Strips common prefixes/titles for better matching in causelists
 */

// Common prefixes and titles to remove for matching
const LAWYER_PREFIXES = [
  // English variants
  'ADV\\.?',
  'ADVOCATE',
  'ADVT\\.?',
  'ADVC\\.?',
  'MR\\.?',
  'MRS\\.?',
  'MS\\.?',
  'MISS',
  'DR\\.?',
  'PROF\\.?',
  'SHRI',
  'SMT\\.?',
  'KUMARI',
  'KU\\.?',
  // Hindi transliterations
  'ADHIVAKTA',
  'VAKIL',
  'SENIOR ADV\\.?',
  'SR\\.? ADV\\.?',
  'JUNIOR ADV\\.?',
  'JR\\.? ADV\\.?',
  // Common abbreviations
  'LD\\.?',
  'LEARNED',
];

// Build regex pattern for prefix removal
const PREFIX_PATTERN = new RegExp(
  `^(${LAWYER_PREFIXES.join('|')})\\s+`,
  'i'
);

// Pattern to match multiple prefixes at the start
const MULTI_PREFIX_PATTERN = new RegExp(
  `^((${LAWYER_PREFIXES.join('|')})\\s*)+`,
  'i'
);

/**
 * Normalizes a lawyer name by:
 * 1. Converting to uppercase
 * 2. Removing common prefixes (Adv., Mr., etc.)
 * 3. Normalizing whitespace
 * 4. Removing extra punctuation
 */
export function normalizeLawyerName(name: string): string {
  if (!name) return '';
  
  let normalized = name.trim().toUpperCase();
  
  // Remove all prefixes (there might be multiple like "ADV. MR.")
  normalized = normalized.replace(MULTI_PREFIX_PATTERN, '');
  
  // Normalize whitespace (multiple spaces to single)
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  // Remove trailing punctuation
  normalized = normalized.replace(/[.,;:]+$/, '').trim();
  
  return normalized;
}

/**
 * Creates a search-friendly version of the name
 * Returns both the original and normalized version for flexible matching
 */
export function createSearchableNames(name: string): {
  original: string;
  normalized: string;
  forMatching: string;
} {
  const original = name.trim();
  const normalized = normalizeLawyerName(name);
  
  // For matching, we create a pattern-friendly version
  // that handles common variations
  const forMatching = normalized
    .replace(/\./g, '\\.?')  // Make dots optional
    .replace(/\s+/g, '\\s+'); // Flexible whitespace
  
  return { original, normalized, forMatching };
}

/**
 * Checks if a name has a common lawyer prefix
 */
export function hasLawyerPrefix(name: string): boolean {
  if (!name) return false;
  return MULTI_PREFIX_PATTERN.test(name.trim());
}

/**
 * Extracts just the core name without any titles
 * This is what should be stored as the primary matching alias
 */
export function extractCoreName(name: string): string {
  return normalizeLawyerName(name);
}

/**
 * Generates common alias variations from a name
 * Useful for auto-suggesting aliases during onboarding
 */
export function generateAliasVariations(fullName: string): string[] {
  const coreName = normalizeLawyerName(fullName);
  if (!coreName) return [];
  
  const parts = coreName.split(' ').filter(p => p.length > 0);
  if (parts.length === 0) return [];
  
  const variations: string[] = [];
  const lastName = parts[parts.length - 1];
  
  // Core name (no prefix)
  variations.push(coreName);
  
  // With Adv. prefix
  variations.push(`ADV. ${coreName}`);
  
  // Initials + Last name: "A.K. SHARMA"
  if (parts.length > 1) {
    const initials = parts.slice(0, -1).map(p => p[0] + '.').join('');
    variations.push(`${initials} ${lastName}`);
  }
  
  // First initial + Last name: "A. SHARMA"
  if (parts.length > 1) {
    variations.push(`${parts[0][0]}. ${lastName}`);
  }
  
  // Just last name (for common usage)
  if (lastName.length > 3) {
    variations.push(lastName);
  }
  
  // Remove duplicates and return
  return [...new Set(variations)];
}
