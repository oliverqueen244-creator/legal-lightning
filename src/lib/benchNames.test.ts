import { describe, it, expect } from 'vitest';
import {
  getBenchFullName,
  getBenchShortName,
  getBenchMenuLabel,
  getBenchBadgeLabel,
} from './benchNames';

describe('benchNames', () => {
  describe('getBenchFullName', () => {
    it('returns full name for JODHPUR', () => {
      expect(getBenchFullName('JODHPUR')).toBe('Rajasthan High Court Jodhpur');
    });
    it('returns full name for JAIPUR', () => {
      expect(getBenchFullName('JAIPUR')).toBe('Rajasthan High Court - Jaipur Bench');
    });
    it('handles comma-separated as Both', () => {
      expect(getBenchFullName('JAIPUR,JODHPUR')).toBe('Both Benches');
    });
    it('falls back to Unknown for nullish', () => {
      expect(getBenchFullName(undefined)).toBe('Unknown Bench');
      expect(getBenchFullName(null)).toBe('Unknown Bench');
      expect(getBenchFullName('')).toBe('Unknown Bench');
    });
    it('is case-insensitive', () => {
      expect(getBenchFullName('jodhpur')).toBe('Rajasthan High Court Jodhpur');
    });
  });

  describe('getBenchShortName', () => {
    it.each([
      ['JODHPUR', 'RHC Jodhpur'],
      ['JAIPUR', 'RHC Jaipur Bench'],
      ['BOTH', 'Both Benches'],
    ])('%s -> %s', (input, expected) => {
      expect(getBenchShortName(input)).toBe(expected);
    });
  });

  describe('getBenchBadgeLabel', () => {
    it('returns RHC Jodhpur', () => {
      expect(getBenchBadgeLabel('JODHPUR')).toBe('RHC Jodhpur');
    });
    it('returns Both for combined input', () => {
      expect(getBenchBadgeLabel('JAIPUR,JODHPUR')).toBe('Both');
    });
  });

  describe('getBenchMenuLabel', () => {
    it('returns the full Jaipur label', () => {
      expect(getBenchMenuLabel('JAIPUR')).toBe('Rajasthan High Court - Jaipur Bench');
    });
  });
});
