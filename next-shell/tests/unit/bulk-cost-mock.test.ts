import { describe, expect, it } from 'vitest';
import {
  DEMO_LINES,
  DEMO_QUOTES,
  DEMO_VENDOR,
  getDemoLinesForSupplier,
} from '@/features/bulk-cost/bulk-cost.mock';

describe('Bulk Cost mock data', () => {
  it('keeps Grainger as the manager baseline quote', () => {
    expect(DEMO_QUOTES[0].vendor).toEqual(DEMO_VENDOR);
    expect(DEMO_LINES).toHaveLength(20);
    expect(new Set(DEMO_LINES.map((line) => line.vendorCode))).toEqual(new Set([DEMO_VENDOR.code]));
    expect(new Set(DEMO_LINES.map((line) => line.vendorName))).toEqual(new Set([DEMO_VENDOR.name]));
    expect(DEMO_LINES.reduce((sum, line) => sum + line.qty, 0)).toBe(45);
    expect(DEMO_LINES.reduce((sum, line) => sum + line.amount, 0)).toBeCloseTo(10650.08, 2);
    expect(DEMO_LINES.reduce((sum, line) => sum + (line.shippingWeightPerEach ?? 0) * line.qty, 0)).toBeCloseTo(194.43675, 6);
    expect(new Set(DEMO_LINES.map((line) => line.orderTerm))).toEqual(new Set(['Ex-work']));
  });

  it('adds separate quote mocks beyond the Grainger baseline', () => {
    expect(DEMO_QUOTES.length).toBeGreaterThan(8);
    for (const quote of DEMO_QUOTES) {
      const lines = getDemoLinesForSupplier(quote.vendor.code);
      expect(lines.length).toBe(quote.lines.length);
      expect(new Set(lines.map((line) => line.vendorCode))).toEqual(new Set([quote.vendor.code]));
    }
  });

  it('covers formula-critical order terms, ship modes, and locations across quote mocks', () => {
    const allLines = DEMO_QUOTES.flatMap((quote) => quote.lines);
    const orderTerms = new Set(allLines.map((line) => line.orderTerm));
    const shipModes = new Set(allLines.map((line) => line.shipModeNo));
    const locations = new Set(allLines.map((line) => line.location));

    expect(Array.from(orderTerms)).toEqual(expect.arrayContaining([
      'Ex-work',
      'Exwork',
      'FCA',
      'FAS',
      'FOB',
      'CIF',
      'DDP',
      'DAP',
      'CPT',
      'EX-FACTORY-Thailand',
      'QTEC PICK UP',
    ]));
    expect(shipModes).toEqual(new Set([1, 2, 3, 4, 5, 6]));
    expect(Array.from(locations)).toEqual(expect.arrayContaining([
      'California',
      'US',
      'SG',
      'TH',
      'UK',
      'DE',
      'JP',
      'CN',
    ]));
  });
});
