/**
 * Bench Name Formatting Utilities
 * 
 * Official terminology:
 * - JODHPUR → "Rajasthan High Court Jodhpur"
 * - JAIPUR → "Rajasthan High Court - Jaipur Bench"
 */

export type BenchCode = 'JAIPUR' | 'JODHPUR' | 'BOTH' | string;

/**
 * Get the full official name for a bench code
 */
export function getBenchFullName(bench: BenchCode | undefined | null): string {
  if (!bench) return 'Unknown Bench';
  
  const upperBench = bench.toUpperCase();
  
  switch (upperBench) {
    case 'JODHPUR':
      return 'Rajasthan High Court Jodhpur';
    case 'JAIPUR':
      return 'Rajasthan High Court - Jaipur Bench';
    case 'BOTH':
      return 'Both Benches';
    default:
      // Handle comma-separated values
      if (upperBench.includes(',')) {
        return 'Both Benches';
      }
      return bench;
  }
}

/**
 * Get a shorter display name for UI contexts with limited space
 */
export function getBenchShortName(bench: BenchCode | undefined | null): string {
  if (!bench) return 'Unknown';
  
  const upperBench = bench.toUpperCase();
  
  switch (upperBench) {
    case 'JODHPUR':
      return 'RHC Jodhpur';
    case 'JAIPUR':
      return 'RHC Jaipur Bench';
    case 'BOTH':
      return 'Both Benches';
    default:
      if (upperBench.includes(',')) {
        return 'Both Benches';
      }
      return bench;
  }
}

/**
 * Get menu item label for bench selection
 */
export function getBenchMenuLabel(bench: BenchCode): string {
  switch (bench.toUpperCase()) {
    case 'JODHPUR':
      return 'Rajasthan High Court Jodhpur';
    case 'JAIPUR':
      return 'Rajasthan High Court - Jaipur Bench';
    case 'BOTH':
      return 'Both Benches';
    default:
      return bench;
  }
}

/**
 * Get badge label for compact display
 */
export function getBenchBadgeLabel(bench: BenchCode | undefined | null): string {
  if (!bench) return 'Unknown';
  
  const upperBench = bench.toUpperCase();
  
  switch (upperBench) {
    case 'JODHPUR':
      return 'RHC Jodhpur';
    case 'JAIPUR':
      return 'RHC Jaipur';
    case 'BOTH':
      return 'Both';
    default:
      if (upperBench.includes(',')) {
        return 'Both';
      }
      return bench;
  }
}
