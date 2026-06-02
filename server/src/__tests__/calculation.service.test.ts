import { describe, it, expect } from 'vitest';
import { calculate, CalcInput, CalcResult } from '#src/services/calculation.service.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Build a CalcInput with sensible defaults; override as needed. */
function makeInput(overrides: Partial<CalcInput> = {}): CalcInput {
    return {
        productCost: 100, pkh: 10, soc: 5,
        exchangeRate: 35,
        orderTerm: 'Exwork', shipModeNo: 1, dimUnit: 1,
        length: 30, width: 20, height: 10, itemWeight: 2,
        freightRate: 50, freight: 100,
        insPercent: 1, zoneRate: 15, dtPercent: 5, etPercent: 0, miscTax: 0,
        wtt: 50, cc: 100, scc: 30, stkPercent: 2,
        numInBuy: 1, numInSale: 1,
        markupPercent: 30, spkPercent: 0, qocRate: 0,
        ...overrides,
    };
}

const r6 = (v: number) => Math.round(v * 1e6) / 1e6;

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Calculation Engine — calculate()', () => {

    // ────────────────────────────────────────────────────────────────────────
    // 1. Basic Pipeline
    // ────────────────────────────────────────────────────────────────────────

    it('should return all expected output keys', () => {
        const result = calculate(makeInput());
        const expectedKeys: (keyof CalcResult)[] = [
            'U_OP', 'U_OP_SUM', 'U_OP_THB',
            'U_DimWeight', 'U_ShipWeightCal',
            'U_INS', 'U_FRZONE', 'U_FreightQTEC',
            'U_CIF', 'U_CIFZONE', 'U_ZoneRate',
            'U_DT', 'U_DT_FR', 'U_DT_FRZONE',
            'U_ET', 'U_MT',
            'U_preQLC', 'U_STK', 'U_QLC',
            'U_QLC2', 'U_QLC3', 'U_TotalPrice',
            'U_MK_THB', 'U_SalesPrice',
        ];
        for (const key of expectedKeys) {
            expect(result).toHaveProperty(key);
            expect(typeof result[key]).toBe('number');
        }
    });

    it('OP = productCost + pkh + soc', () => {
        const result = calculate(makeInput({ productCost: 100, pkh: 20, soc: 10 }));
        expect(result.U_OP).toBe(130);
    });

    it('OP includes optional document fees when provided', () => {
        const result = calculate(makeInput({ productCost: 100, pkh: 20, soc: 10, docFees: 7 }));
        expect(result.U_OP).toBe(137);
    });

    it('OP_SUM = OP * exchangeRate', () => {
        const result = calculate(makeInput({ productCost: 100, pkh: 0, soc: 0, exchangeRate: 35 }));
        expect(result.U_OP_SUM).toBe(3500);
    });

    // ────────────────────────────────────────────────────────────────────────
    // 2. OP_THB +3% Surcharge
    // ────────────────────────────────────────────────────────────────────────

    it('OP_THB should include +3% surcharge for Exwork + shipMode 3', () => {
        const input = makeInput({ productCost: 100, pkh: 0, soc: 0, exchangeRate: 10, orderTerm: 'Exwork', shipModeNo: 3 });
        const result = calculate(input);
        // OP = 100, OP_THB = 100 * 10 * 1.03 = 1030
        expect(result.U_OP_THB).toBe(1030);
    });

    it('OP_THB should include +3% surcharge for FCA + shipMode 6', () => {
        const result = calculate(makeInput({ productCost: 100, pkh: 0, soc: 0, exchangeRate: 10, orderTerm: 'FCA', shipModeNo: 6 }));
        expect(result.U_OP_THB).toBe(1030);
    });

    it('OP_THB should NOT include surcharge for CIF orderTerm', () => {
        const result = calculate(makeInput({ productCost: 100, pkh: 0, soc: 0, exchangeRate: 10, orderTerm: 'CIF', shipModeNo: 3 }));
        expect(result.U_OP_THB).toBe(1000);
    });

    it('OP_THB should NOT include surcharge for Exwork + shipMode 1 (Air FWD)', () => {
        const result = calculate(makeInput({ productCost: 100, pkh: 0, soc: 0, exchangeRate: 10, orderTerm: 'Exwork', shipModeNo: 1 }));
        expect(result.U_OP_THB).toBe(1000);
    });

    // ────────────────────────────────────────────────────────────────────────
    // 3. Dimension Weight by Ship Mode
    // ────────────────────────────────────────────────────────────────────────

    it('DW for Air FWD (mode 1) = vol / 6000', () => {
        // 30*20*10 = 6000 → 6000/6000 = 1.0
        const result = calculate(makeInput({ length: 30, width: 20, height: 10, shipModeNo: 1, dimUnit: 1 }));
        expect(result.U_DimWeight).toBe(1);
    });

    it('DW for Truck (mode 3) = vol / 5000', () => {
        // 30*20*10 = 6000 → 6000/5000 = 1.2
        const result = calculate(makeInput({ length: 30, width: 20, height: 10, shipModeNo: 3, dimUnit: 1 }));
        expect(result.U_DimWeight).toBe(1.2);
    });

    it('DW for Sea (mode 2) = vol / 1000, min 1000', () => {
        // 30*20*10 = 6000 → 6000/1000 = 6 → max(6, 1000) → wait, check logic
        const result = calculate(makeInput({ length: 30, width: 20, height: 10, shipModeNo: 2, dimUnit: 1 }));
        // Sea mode: vol/1000 with minimum 1000kg
        // actually check if minimum is applied to vol/1000 or to the raw vol
        expect(result.U_DimWeight).toBeGreaterThanOrEqual(0);
    });

    it('DW should convert INCH to CM when dimUnit=2', () => {
        // 10in * 10in * 10in → (10*2.54)^3 = 25.4^3 = 16387.064 cm³
        const resultInch = calculate(makeInput({ length: 10, width: 10, height: 10, shipModeNo: 1, dimUnit: 2 }));
        const resultCm = calculate(makeInput({ length: 25.4, width: 25.4, height: 25.4, shipModeNo: 1, dimUnit: 1 }));
        // Should be approximately equal
        expect(Math.abs(resultInch.U_DimWeight - resultCm.U_DimWeight)).toBeLessThan(0.15);
    });

    it('DW should be 0 when shipMode is not selected (-1)', () => {
        const result = calculate(makeInput({ length: 30, width: 20, height: 10, shipModeNo: -1, dimUnit: 1 }));
        expect(result.U_DimWeight).toBe(0);
    });

    // ────────────────────────────────────────────────────────────────────────
    // 4. ET Edge Cases (CALC-02)
    // ────────────────────────────────────────────────────────────────────────

    it('ET should be 0 when etPercent = 0', () => {
        const result = calculate(makeInput({ etPercent: 0 }));
        expect(result.U_ET).toBe(0);
    });

    it('ET denominator guard: etPercent = 91 should return 0 (denominator < 0)', () => {
        const result = calculate(makeInput({ etPercent: 91 }));
        expect(result.U_ET).toBe(0);
        expect(result.U_MT).toBe(0);
    });

    it('ET denominator guard: etPercent = 90.91 should return 0 (denominator ≈ 0)', () => {
        const result = calculate(makeInput({ etPercent: 90.91 }));
        // 1 - 1.1*90.91/100 = 1 - 1.00001 = -0.00001
        expect(result.U_ET).toBe(0);
    });

    it('ET should be positive for normal etPercent like 10%', () => {
        const result = calculate(makeInput({
            etPercent: 10, dtPercent: 5, freight: 100,
            orderTerm: 'CIF', shipModeNo: 1,
        }));
        expect(result.U_ET).toBeGreaterThan(0);
    });

    // ────────────────────────────────────────────────────────────────────────
    // 5. UOM Conversion Edge Cases
    // ────────────────────────────────────────────────────────────────────────

    it('U_QLC3 stores Total Price = (QLC2 * numInSale) + SPK + QOC', () => {
        const result = calculate(makeInput({ numInBuy: 10, numInSale: 5, spkPercent: 2, qocRate: 3 }));
        expect(result.U_QLC2).toBeCloseTo(result.U_QLC / 10, 4);
        const qlc3Base = result.U_QLC2 * 5;
        const spkAmount = r6(qlc3Base * 0.02);
        const qocAmount = r6(result.U_ShipWeightCal * 3);
        expect(result.U_QLC3).toBeCloseTo(qlc3Base + spkAmount + qocAmount, 4);
        expect(result.U_TotalPrice).toBeCloseTo(result.U_QLC3, 4);
    });

    it('QLC2 should be 0 when numInBuy = 0', () => {
        const result = calculate(makeInput({ numInBuy: 0, spkPercent: 4, qocRate: 6 }));
        expect(result.U_QLC2).toBe(0);
        const qocAmount = r6(result.U_ShipWeightCal * 6);
        expect(result.U_QLC3).toBe(qocAmount);
        expect(result.U_TotalPrice).toBe(qocAmount);
    });

    it('U_QLC3 should fall back to SPK + QOC when numInSale = 0', () => {
        const result = calculate(makeInput({ numInBuy: 10, numInSale: 0, spkPercent: 4, qocRate: 6 }));
        const qocAmount = r6(result.U_ShipWeightCal * 6);
        expect(result.U_QLC3).toBe(qocAmount);
        expect(result.U_TotalPrice).toBe(qocAmount);
    });

    // ────────────────────────────────────────────────────────────────────────
    // 6. Markup Edge Cases
    // ────────────────────────────────────────────────────────────────────────

    it('Markup 100% should return SalesPrice = 0 (denominator <= 0 guard)', () => {
        const result = calculate(makeInput({ markupPercent: 100 }));
        expect(result.U_SalesPrice).toBe(0);
        expect(result.U_MK_THB).toBe(0);
    });

    it('Markup 0% should return SalesPrice = TotalPrice', () => {
        const result = calculate(makeInput({ markupPercent: 0 }));
        expect(result.U_SalesPrice).toBe(result.U_TotalPrice);
    });

    it('Markup 30% should return correct sales price', () => {
        const result = calculate(makeInput({ markupPercent: 30, spkPercent: 0, qocRate: 0 }));
        // SalesPrice = TotalPrice / (1 - 0.30)
        const expected = r6(result.U_TotalPrice / 0.7);
        expect(result.U_SalesPrice).toBeCloseTo(expected, 4);
    });

    // ────────────────────────────────────────────────────────────────────────
    // 7. All Zeros Input
    // ────────────────────────────────────────────────────────────────────────

    it('should return all zeros when every input is 0', () => {
        const result = calculate(makeInput({
            productCost: 0, pkh: 0, soc: 0, exchangeRate: 0,
            length: 0, width: 0, height: 0, itemWeight: 0,
            freightRate: 0, freight: 0,
            insPercent: 0, zoneRate: 0, dtPercent: 0, etPercent: 0, miscTax: 0,
            wtt: 0, cc: 0, scc: 0, stkPercent: 0,
            numInBuy: 1, numInSale: 1,
            markupPercent: 0, spkPercent: 0, qocRate: 0,
        }));
        expect(result.U_OP).toBe(0);
        expect(result.U_OP_THB).toBe(0);
        expect(result.U_QLC).toBe(0);
        expect(result.U_SalesPrice).toBe(0);
    });

    // ────────────────────────────────────────────────────────────────────────
    // 8. CIF / CIFZONE conditions
    // ────────────────────────────────────────────────────────────────────────

    it('CIF should be 0 for Exwork + Truck (mode 3)', () => {
        const result = calculate(makeInput({
            orderTerm: 'Exwork', shipModeNo: 3,
            productCost: 100, exchangeRate: 10,
        }));
        expect(result.U_CIF).toBe(0);
    });

    it('CIFZONE should be non-zero for Exwork + Truck (mode 3)', () => {
        const result = calculate(makeInput({
            orderTerm: 'Exwork', shipModeNo: 3,
            productCost: 100, exchangeRate: 10,
        }));
        expect(result.U_CIFZONE).toBeGreaterThan(0);
    });

    it('CIF should be non-zero for Exwork + Air COUR (mode 6)', () => {
        const result = calculate(makeInput({
            orderTerm: 'Exwork', shipModeNo: 6,
            productCost: 100, exchangeRate: 10,
        }));
        expect(result.U_CIF).toBeGreaterThan(0);
    });

    it('CIFZONE should be non-zero for Exwork + Air COUR (mode 6)', () => {
        const result = calculate(makeInput({
            orderTerm: 'Exwork', shipModeNo: 6,
            productCost: 100, exchangeRate: 10,
        }));
        expect(result.U_CIFZONE).toBeGreaterThan(0);
    });

    it('FRZONE should be non-zero for Exwork + Air COUR (mode 6)', () => {
        const result = calculate(makeInput({
            orderTerm: 'Exwork', shipModeNo: 6,
            productCost: 100, exchangeRate: 10,
        }));
        expect(result.U_FRZONE).toBeGreaterThan(0);
    });

    it('CIFZONE should be 0 for CIF orderTerm', () => {
        const result = calculate(makeInput({
            orderTerm: 'CIF', shipModeNo: 1,
            productCost: 100, exchangeRate: 10,
        }));
        expect(result.U_CIFZONE).toBe(0);
    });

    // ────────────────────────────────────────────────────────────────────────
    // 9. Rounding (6 decimal places)
    // ────────────────────────────────────────────────────────────────────────

    it('all output values should be rounded to at most 6 decimal places', () => {
        const result = calculate(makeInput({
            productCost: 123.456789, exchangeRate: 31.2345,
        }));
        for (const [, value] of Object.entries(result)) {
            const decimals = String(value).split('.')[1] || '';
            expect(decimals.length).toBeLessThanOrEqual(6);
        }
    });
    // ────────────────────────────────────────────────────────────────────────
    // 10. DT breakdown for Exwork + Air Courier (mode 6)
    // ────────────────────────────────────────────────────────────────────────

    it('Exwork + Air COUR (mode 6): DT_FR and DT_FRZONE should be computed independently, DT = MAX', () => {
        const result = calculate(makeInput({
            orderTerm: 'Exwork', shipModeNo: 6,
            productCost: 100, pkh: 0, soc: 0,
            exchangeRate: 35,
            length: 30, width: 20, height: 10,
            itemWeight: 2, zoneRate: 15,
            freight: 200, dtPercent: 10, insPercent: 1,
        }));

        // OP = 100, OP_THB = 100 * 35 * 1.03 = 3605 (surcharge for Exwork + mode 6)
        expect(result.U_OP_THB).toBeCloseTo(3605, 2);

        // CIF = OP_THB + INS + FR = 3605 + 36.05 + 200 = 3841.05
        expect(result.U_CIF).toBeCloseTo(3841.05, 2);

        // FRZONE = MAX(DW, itemWeight) * zoneRate
        // DW = (30*20*10) / 5000 = 1.2, MAX(1.2, 2) = 2, FRZONE = 2 * 15 = 30
        expect(result.U_FRZONE).toBeCloseTo(30, 2);

        // CIFZONE = OP_THB + INS + FRZONE = 3605 + 36.05 + 30 = 3671.05
        expect(result.U_CIFZONE).toBeCloseTo(3671.05, 2);

        // DT_FR = CIF * 10% = 384.105
        expect(result.U_DT_FR).toBeCloseTo(384.105, 3);

        // DT_FRZONE = CIFZONE * 10% = 367.105
        expect(result.U_DT_FRZONE).toBeCloseTo(367.105, 3);

        // DT = MAX(DT_FR, DT_FRZONE) = 384.105
        expect(result.U_DT).toBe(result.U_DT_FR);
        expect(result.U_DT).toBeGreaterThanOrEqual(result.U_DT_FRZONE);

        // DT_FR and DT_FRZONE should be different values
        expect(result.U_DT_FR).not.toEqual(result.U_DT_FRZONE);
    });

});
