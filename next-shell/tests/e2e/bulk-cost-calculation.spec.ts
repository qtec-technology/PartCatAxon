/**
 * Bulk Cost Calculation — Playwright E2E Tests
 *
 * Tests the calculation engine via API (POST /api/bulk-cost/calculate)
 * using 20 Grainger items from Example_Cal_Cost.xlsx.
 *
 * API Response Structure:
 *   { success: true, data: { lines: [{ lineKey, finalResult: { op1, op2, ... } }] } }
 */
import { test, expect } from '@playwright/test';
import { EXCEL_COSTS, EXCEL_LINES, EXCEL_EXPECTED } from './fixtures/excel-test-data';

const API_BASE = 'http://localhost:3010';
const TOLERANCE = 5.0; // THB — allows for weight precision rounding differences

function closeTo(actual: number, expected: number, tol = TOLERANCE): boolean {
  return Math.abs(actual - expected) <= tol;
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 1: API-Level Calculation Accuracy Tests
// ─────────────────────────────────────────────────────────────────────────────

test.describe('API — Full 20-item batch calculation', () => {
  let lines: any[];

  test.beforeAll(async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/bulk-cost/calculate`, {
      data: { costs: EXCEL_COSTS, lines: EXCEL_LINES },
    });
    expect(response.ok(), `API returned ${response.status()}`).toBeTruthy();
    const body = await response.json();
    lines = body.data.lines;
  });

  test('should return 20 calculated lines', () => {
    expect(lines).toHaveLength(20);
  });

  test('each line should have finalResult with key fields', () => {
    for (const line of lines) {
      expect(line.finalResult).toBeDefined();
      expect(line.finalResult.op1).toBeDefined();
      expect(line.finalResult.op2).toBeDefined();
      expect(line.finalResult.qlc).toBeDefined();
      expect(line.finalResult.roundUp).toBeDefined();
    }
  });

  // Per-line accuracy: OP1, OP2, Duty, QLC, Sale Price
  for (const expected of EXCEL_EXPECTED) {
    test(`Line ${expected.no} (qty=${expected.qty}) — calculation pipeline`, () => {
      const apiLine = lines.find((l: any) => l.lineKey === expected.lineKey);
      expect(apiLine, `Line ${expected.no} (${expected.lineKey}) not found`).toBeDefined();

      const r = apiLine.finalResult;

      console.log(
        `Line ${expected.no}: OP1=${r.op1} (exp ${expected.op1}), ` +
        `OP2=${r.op2} (exp ${expected.op2}), ` +
        `Duty=${r.selectedDuty} (exp ${expected.selectedDuty}), ` +
        `QLC=${r.qlc} (exp ${expected.qlc}), ` +
        `Sale=${r.roundUp} (exp ${expected.salePrice})`
      );

      expect(closeTo(r.op1, expected.op1),
        `Line ${expected.no} OP1: got ${r.op1}, expected ${expected.op1}, diff=${Math.abs(r.op1 - expected.op1).toFixed(2)}`
      ).toBeTruthy();

      expect(closeTo(r.op2, expected.op2),
        `Line ${expected.no} OP2: got ${r.op2}, expected ${expected.op2}, diff=${Math.abs(r.op2 - expected.op2).toFixed(2)}`
      ).toBeTruthy();

      expect(closeTo(r.selectedDuty, expected.selectedDuty),
        `Line ${expected.no} Duty: got ${r.selectedDuty}, expected ${expected.selectedDuty}, diff=${Math.abs(r.selectedDuty - expected.selectedDuty).toFixed(2)}`
      ).toBeTruthy();

      expect(closeTo(r.qlc, expected.qlc),
        `Line ${expected.no} QLC: got ${r.qlc}, expected ${expected.qlc}, diff=${Math.abs(r.qlc - expected.qlc).toFixed(2)}`
      ).toBeTruthy();

      expect(closeTo(r.roundUp, expected.salePrice),
        `Line ${expected.no} Sale: got ${r.roundUp}, expected ${expected.salePrice}, diff=${Math.abs(r.roundUp - expected.salePrice).toFixed(2)}`
      ).toBeTruthy();
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 2: Cost Allocation Integrity
// ─────────────────────────────────────────────────────────────────────────────

test.describe('API — Cost allocation integrity', () => {
  let lines: any[];

  test.beforeAll(async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/bulk-cost/calculate`, {
      data: { costs: EXCEL_COSTS, lines: EXCEL_LINES },
    });
    const body = await response.json();
    lines = body.data.lines;
  });

  test('EXWORK CASE = 1.03 for Exwork + Air Courier (mode 6)', () => {
    const line1 = lines.find((l: any) => l.lineKey === 'EXCEL-001');
    expect(line1.finalResult.exworkCase).toBeCloseTo(1.03, 2);
  });

  test('Item 13 should have 0% duty (importDutyPercent=0)', () => {
    const line13 = lines.find((l: any) => l.lineKey === 'EXCEL-013');
    expect(line13.finalResult.selectedDuty).toBe(0);
  });

  test('OP2 = OP1 × exworkCase for each line', () => {
    for (const apiLine of lines) {
      const r = apiLine.finalResult;
      expect(closeTo(r.op2, r.op1 * r.exworkCase, 0.1),
        `Line ${apiLine.lineKey}: OP2=${r.op2} ≠ OP1(${r.op1})×exwork(${r.exworkCase})=${r.op1 * r.exworkCase}`
      ).toBeTruthy();
    }
  });

  test('Allocated costs sum = total input', () => {
    const totalPKH = lines.reduce((s: number, l: any) => s + l.pkhPerItem, 0);
    const totalSOC = lines.reduce((s: number, l: any) => s + l.socPerItem, 0);
    const totalFR = lines.reduce((s: number, l: any) => s + l.freightPerItem, 0);
    const totalCC = lines.reduce((s: number, l: any) => s + l.ccPerItem, 0);
    const totalTT = lines.reduce((s: number, l: any) => s + l.wireTTPerItem, 0);

    console.log(`Alloc PKH=${totalPKH}, SOC=${totalSOC}, FR=${totalFR}, CC=${totalCC}, TT=${totalTT}`);

    expect(closeTo(totalPKH, 75, 0.01), `PKH: ${totalPKH} ≠ 75`).toBeTruthy();
    expect(closeTo(totalSOC, 125, 0.01), `SOC: ${totalSOC} ≠ 125`).toBeTruthy();
    expect(closeTo(totalFR, 40000, 0.01), `FR: ${totalFR} ≠ 40000`).toBeTruthy();
    expect(closeTo(totalCC, 8000, 0.01), `CC: ${totalCC} ≠ 8000`).toBeTruthy();
    expect(closeTo(totalTT, 1500, 0.01), `TT: ${totalTT} ≠ 1500`).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 3: Formula & Sequence Validation
// ─────────────────────────────────────────────────────────────────────────────

test.describe('API — Formula sequence validation', () => {
  let lines: any[];

  test.beforeAll(async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/bulk-cost/calculate`, {
      data: { costs: EXCEL_COSTS, lines: EXCEL_LINES },
    });
    const body = await response.json();
    lines = body.data.lines;
  });

  test('INS = OP2 × insPercent / 100', () => {
    for (const apiLine of lines) {
      const r = apiLine.finalResult;
      const expectedINS = r.op2 * r.insPercent / 100;
      expect(closeTo(r.ins, expectedINS, 0.01),
        `Line ${apiLine.lineKey}: INS(${r.ins}) ≠ OP2(${r.op2})×${r.insPercent}%=${expectedINS}`
      ).toBeTruthy();
    }
  });

  test('CIF_QTEC = OP2 + INS + FR_QTEC', () => {
    for (const apiLine of lines) {
      const r = apiLine.finalResult;
      const expectedCIF = r.op2 + r.ins + r.frQTEC;
      expect(closeTo(r.cifQTEC, expectedCIF, 0.01),
        `Line ${apiLine.lineKey}: CIF(${r.cifQTEC}) ≠ OP2+INS+FR=${expectedCIF}`
      ).toBeTruthy();
    }
  });

  test('selectedDuty = MAX(dtQTEC, dtZone)', () => {
    for (const apiLine of lines) {
      const r = apiLine.finalResult;
      const expectedMax = Math.max(r.dtQTEC, r.dtZone);
      expect(closeTo(r.selectedDuty, expectedMax, 0.01),
        `Line ${apiLine.lineKey}: duty(${r.selectedDuty}) ≠ MAX(${r.dtQTEC},${r.dtZone})=${expectedMax}`
      ).toBeTruthy();
    }
  });

  test('QLC pipeline: preQLC → stk → qlc → totalQLC → roundUp', () => {
    for (const apiLine of lines) {
      const r = apiLine.finalResult;
      // QLC should be CEILING(preQLC + stk, 0.01)
      const expectedQLC = Math.ceil((r.preQLC + r.stk) * 100) / 100;
      expect(closeTo(r.qlc, expectedQLC, 0.02),
        `Line ${apiLine.lineKey}: QLC(${r.qlc}) ≠ ceil(preQLC+stk)=${expectedQLC}`
      ).toBeTruthy();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 4: UI Workflow Tests
// ─────────────────────────────────────────────────────────────────────────────

test.describe('UI — Bulk Cost page navigation', () => {
  test('should load /bulk-cost page', async ({ page }) => {
    await page.goto('/bulk-cost');
    await expect(
      page.locator('[class*="bulk-cost"], [data-testid*="bulk-cost"]').first()
    ).toBeVisible({ timeout: 15000 });
  });

  test('should display sidebar with navigation tabs', async ({ page }) => {
    await page.goto('/bulk-cost');
    const sidebar = page.locator('[class*="sidebar"], nav, [role="tablist"]').first();
    await expect(sidebar).toBeVisible({ timeout: 10000 });
  });

  test('should open workspace with supplier query params', async ({ page }) => {
    await page.goto('/bulk-cost?tab=new&supplier=V-GRA-001&supplierName=Grainger');
    await page.waitForTimeout(3000);
    const workspace = page.locator(
      '[class*="workspace"], [class*="cost-workspace"], [class*="editor"]'
    ).first();
    await expect(workspace).toBeVisible({ timeout: 15000 });
  });
});
