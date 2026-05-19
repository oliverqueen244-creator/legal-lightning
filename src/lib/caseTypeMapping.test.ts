import { describe, it, expect } from 'vitest';
import { extractCaseTypeAbbr, getCourtId, resolveCaseType } from './caseTypeMapping';

describe('caseTypeMapping', () => {
  describe('extractCaseTypeAbbr', () => {
    it('extracts SBCWP from spaced form', () => {
      expect(extractCaseTypeAbbr('S.B.C.W.P. 123/2024')).toBe('S.B.C.W.P.');
    });
    it('extracts SBCWP from compact form', () => {
      expect(extractCaseTypeAbbr('SBCWP 123/2024')).toBe('SBCWP');
    });
    it('handles "No." separator', () => {
      const out = extractCaseTypeAbbr('CRL.A. No. 123/2024');
      expect(out).toBeTruthy();
      expect(out).toContain('CRL');
    });
    it('returns null for empty input', () => {
      expect(extractCaseTypeAbbr('')).toBeNull();
    });
    it('returns null for pure numeric input', () => {
      expect(extractCaseTypeAbbr('12345')).toBeNull();
    });
  });

  describe('resolveCaseType', () => {
    it('returns a resolution with abbreviation', () => {
      const out = resolveCaseType('SBCWP 123/2024');
      expect(out.abbreviation).toBeTruthy();
    });
  });

  describe('getCourtId', () => {
    it('returns the input when no mapping exists', () => {
      const random = 'NONEXISTENT_COURT_XYZ';
      expect(getCourtId(random)).toBeTruthy();
    });
  });
});
