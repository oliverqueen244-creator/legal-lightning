import { describe, it, expect } from 'vitest';
import { abstractBenchCode } from './errorReporting';

describe('abstractBenchCode', () => {
  it('maps JODHPUR to RJ-JODH', () => {
    expect(abstractBenchCode('JODHPUR')).toBe('RJ-JODH');
  });

  it('maps JAIPUR to RJ-JAIP', () => {
    expect(abstractBenchCode('JAIPUR')).toBe('RJ-JAIP');
  });

  it('includes court number when provided', () => {
    expect(abstractBenchCode('JODHPUR', '12')).toBe('RJ-JODH-12');
  });

  it('returns undefined when bench is missing', () => {
    expect(abstractBenchCode()).toBeUndefined();
    expect(abstractBenchCode('')).toBeUndefined();
  });

  it('does not leak the raw bench string', () => {
    const result = abstractBenchCode('JODHPUR', '7');
    expect(result).not.toContain('JODHPUR');
  });
});
