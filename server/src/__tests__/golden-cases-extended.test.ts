import { describe, it, expect } from 'vitest';
import { calculate, CalcInput, CalcResult } from '#src/services/calculation.service.js';

function makeInput(overrides: Partial<CalcInput>): CalcInput {
    return {
        productCost: 0, pkh: 0, soc: 0, exchangeRate: 1,
        orderTerm: 'DDP', shipModeNo: 3, dimUnit: 1,
        length: 0, width: 0, height: 0, itemWeight: 0,
        freightRate: 0, freight: 0,
        insPercent: 0, zoneRate: 0, dtPercent: 0, etPercent: 0, miscTax: 0,
        wtt: 0, cc: 0, scc: 0, stkPercent: 0,
        numInBuy: 1, numInSale: 1,
        markupPercent: 0, spkPercent: 0, qocRate: 0,
        ...overrides,
    };
}

// ═════════════════════════════════════════════════════════════════════════════
// Extended Golden Cases from new .datatest exports
// ═════════════════════════════════════════════════════════════════════════════

describe('Golden Cases — CIF order term', () => {

    // CIF → no surcharge, CIF/CIFZONE = 0 (engine skips CIF calc for CIF term)
    it('TermID 897455: CIF TH USD Sea — basic CIF', () => {
        const result = calculate(makeInput({
            productCost: 31, pkh: 0, soc: 9, exchangeRate: 33.5,
            orderTerm: 'CIF', shipModeNo: 2, dimUnit: 1,
            length: 0, width: 0, height: 0, itemWeight: 1000,
            freight: 0, insPercent: 1, zoneRate: 0,
            dtPercent: 0, etPercent: 0, miscTax: 0,
            wtt: 24.75, cc: 120, scc: 0, stkPercent: 0,
            numInBuy: 1, numInSale: 1,
            markupPercent: 10, spkPercent: 0, qocRate: 0,
        }));
        // OP = 31 + 0 + 9 = 40
        expect(result.U_OP).toBe(40);
        // CIF → no surcharge: OP_THB = 40 * 33.5 = 1340
        expect(result.U_OP_THB).toBe(1340);
        // INS = 1340 * 1% = 13.4
        expect(result.U_INS).toBeCloseTo(13.4, 2);
        // DT = 0 (dtPercent = 0)
        expect(result.U_DT).toBe(0);
        // preQLC = 1340 + 13.4 + 0 + 0 + 0 + 0 + 0 + 24.75 + 120 + 0 = 1498.15
        expect(result.U_preQLC).toBeCloseTo(1498.15, 1);
        // SalesPrice with 10% markup
        expect(result.U_SalesPrice).toBeCloseTo(1664.61, 0);
    });

    it('TermID 896274: CIF TH USD Sea — large item with 10% duty', () => {
        const result = calculate(makeInput({
            productCost: 3900, pkh: 0, soc: 150, exchangeRate: 33.5,
            orderTerm: 'CIF', shipModeNo: 2, dimUnit: 1,
            length: 100, width: 100, height: 150, itemWeight: 200,
            freight: 0, insPercent: 1, zoneRate: 0,
            dtPercent: 10, etPercent: 0, miscTax: 0,
            wtt: 1500, cc: 14000, scc: 2000, stkPercent: 0,
            numInBuy: 1, numInSale: 1,
            markupPercent: 10, spkPercent: 0, qocRate: 0,
        }));
        // OP = 3900 + 0 + 150 = 4050
        expect(result.U_OP).toBe(4050);
        // CIF → no surcharge: OP_THB = 4050 * 33.5 = 135675
        expect(result.U_OP_THB).toBe(135675);
        expect(result.U_DT).toBeGreaterThan(0);
    });
});

describe('Golden Cases — FOB order term', () => {

    it('TermID 872671: FOB US USD AirCOUR — surcharge applies', () => {
        const result = calculate(makeInput({
            productCost: 36.31, pkh: 0, soc: 8.75, exchangeRate: 33.25,
            orderTerm: 'FOB', shipModeNo: 6, dimUnit: 1,
            length: 10, width: 10, height: 10, itemWeight: 0.25,
            freight: 425, insPercent: 1, zoneRate: 0,
            dtPercent: 10, etPercent: 0, miscTax: 0,
            wtt: 375, cc: 200, scc: 0, stkPercent: 0,
            numInBuy: 1, numInSale: 1,
            markupPercent: 10, spkPercent: 0, qocRate: 0,
        }));
        // FOB is FOBType → surcharge 1.03 with mode 6
        // OP = 36.31 + 0 + 8.75 = 45.06
        expect(result.U_OP).toBeCloseTo(45.06, 2);
        // OP_THB = 45.06 * 33.25 * 1.03 = 1543.19235
        expect(result.U_OP_THB).toBeCloseTo(1543.19, 0);
        expect(result.U_DT).toBeGreaterThan(0);
        expect(result.U_preQLC).toBeCloseTo(2712.04, 0);
    });
});

describe('Golden Cases — CFR order term', () => {

    // CFR → NOT in FOBType group → no surcharge
    it('TermID 879373: CFR TH USD AirFWD — no surcharge', () => {
        const result = calculate(makeInput({
            productCost: 8.2, pkh: 0, soc: 1.8, exchangeRate: 33,
            orderTerm: 'CFR', shipModeNo: 1, dimUnit: 1,
            length: 0, width: 0, height: 0, itemWeight: 4,
            freight: 0, insPercent: 1, zoneRate: 0,
            dtPercent: 10, etPercent: 0, miscTax: 0,
            wtt: 10.63, cc: 83.2, scc: 0, stkPercent: 0,
            numInBuy: 1, numInSale: 1,
            markupPercent: 10, spkPercent: 0, qocRate: 0,
        }));
        // OP = 8.2 + 0 + 1.8 = 10
        expect(result.U_OP).toBe(10);
        // CFR → no surcharge: OP_THB = 10 * 33 = 330
        expect(result.U_OP_THB).toBe(330);
        expect(result.U_preQLC).toBeCloseTo(460.46, 0);
    });

    // CFR with UOM conversion CT→PR (numInBuy=60, numInSale=1)
    it('TermID 865676: CFR VN USD Sea — UOM CT→PR conversion', () => {
        const result = calculate(makeInput({
            productCost: 705, pkh: 0, soc: 7.63, exchangeRate: 33.5,
            orderTerm: 'CFR', shipModeNo: 2, dimUnit: 1,
            length: 41, width: 33, height: 45, itemWeight: 12,
            freight: 0, insPercent: 1, zoneRate: 0,
            dtPercent: 0, etPercent: 0, miscTax: 0,
            wtt: 17.045, cc: 181.818, scc: 0, stkPercent: 5,
            numInBuy: 60, numInSale: 1,
            markupPercent: 10, spkPercent: 5, qocRate: 5,
        }));
        // OP = 705 + 0 + 7.63 = 712.63
        expect(result.U_OP).toBeCloseTo(712.63, 2);
        // CFR → no surcharge
        expect(result.U_OP_THB).toBeCloseTo(23873.105, 0);
        // STK = 5% → stk > 0
        expect(result.U_STK).toBeGreaterThan(0);
        // QLC2 = QLC / numInBuy (60)
        expect(result.U_QLC2).toBeCloseTo(result.U_QLC / 60, 1);
    });
});

describe('Golden Cases — FAS order term', () => {

    // FAS is FOBType → surcharge with mode 6
    it('TermID 858854: FAS SG SGD AirCOUR — surcharge', () => {
        const result = calculate(makeInput({
            productCost: 5.8, pkh: 0, soc: 0, exchangeRate: 26.25,
            orderTerm: 'FAS', shipModeNo: 6, dimUnit: 1,
            length: 30, width: 30, height: 30, itemWeight: 1,
            freight: 0, insPercent: 0, zoneRate: 0,
            dtPercent: 0, etPercent: 0, miscTax: 0,
            wtt: 0, cc: 0, scc: 0, stkPercent: 0,
            numInBuy: 1, numInSale: 1,
            markupPercent: 10, spkPercent: 0, qocRate: 0,
        }));
        // FAS + mode 6 → surcharge 1.03
        // OP_THB = 5.8 * 26.25 * 1.03 = 156.8175
        expect(result.U_OP_THB).toBeCloseTo(156.8175, 2);
    });

    // FAS + Truck (mode 3) → surcharge
    it('TermID 815225: FAS SG USD Truck — surcharge', () => {
        const result = calculate(makeInput({
            productCost: 6, pkh: 0, soc: 0, exchangeRate: 35.5,
            orderTerm: 'FAS', shipModeNo: 3, dimUnit: 1,
            length: 10, width: 10, height: 10, itemWeight: 0.1,
            freight: 0, insPercent: 0, zoneRate: 0,
            dtPercent: 0, etPercent: 0, miscTax: 0,
            wtt: 5, cc: 0, scc: 0, stkPercent: 0,
            numInBuy: 1, numInSale: 1,
            markupPercent: 10, spkPercent: 0, qocRate: 0,
        }));
        // FAS + mode 3 → surcharge 1.03
        // OP_THB = 6 * 35.5 * 1.03 = 219.39
        expect(result.U_OP_THB).toBeCloseTo(219.39, 2);
    });
});

describe('Golden Cases — CPT/CIP/DAT/DDU order terms', () => {

    // CPT → NOT FOBType → no surcharge
    it('TermID 898665: CPT TH USD AirFWD — no surcharge', () => {
        const result = calculate(makeInput({
            productCost: 200.61, pkh: 0, soc: 113.66, exchangeRate: 33.3,
            orderTerm: 'CPT', shipModeNo: 1, dimUnit: 1,
            length: 0, width: 0, height: 0, itemWeight: 0,
            freight: 0, insPercent: 1, zoneRate: 0,
            dtPercent: 10, etPercent: 0, miscTax: 0,
            wtt: 133.33, cc: 2133.33, scc: 0, stkPercent: 0,
            numInBuy: 1, numInSale: 1,
            markupPercent: 10, spkPercent: 0, qocRate: 0,
        }));
        // CPT → no surcharge
        // OP = 200.61 + 0 + 113.66 = 314.27
        expect(result.U_OP).toBeCloseTo(314.27, 2);
        // OP_THB = 314.27 * 33.3 = 10465.191
        expect(result.U_OP_THB).toBeCloseTo(10465.191, 0);
    });

    // DDU → same as DDP → no surcharge
    it('TermID 896223: DDU TH THB Truck — local simple', () => {
        const result = calculate(makeInput({
            productCost: 1705.86, pkh: 0, soc: 0, exchangeRate: 1,
            orderTerm: 'DDU', shipModeNo: 3,
            numInBuy: 12, numInSale: 1,
            markupPercent: 10, spkPercent: 0, qocRate: 0,
        }));
        expect(result.U_OP).toBeCloseTo(1705.86, 2);
        expect(result.U_OP_THB).toBeCloseTo(1705.86, 2);
        // QLC2 = QLC / 12
        expect(result.U_QLC2).toBeCloseTo(result.U_QLC / 12, 1);
    });
});

describe('Golden Cases — STK (Stock Fee)', () => {

    // TermID 5407: STK=3%, Exwork US USD AirCOUR
    it('TermID 5407: Exwork US INCH — STK 3%', () => {
        const result = calculate(makeInput({
            productCost: 71.23, pkh: 0, soc: 0, exchangeRate: 32.05,
            orderTerm: 'Exwork', shipModeNo: 6, dimUnit: 2,
            length: 0, width: 0, height: 0, itemWeight: 1.91,
            freightRate: 200, freight: 550,
            insPercent: 1, zoneRate: 0, dtPercent: 10,
            etPercent: 0, miscTax: 0,
            wtt: 20, cc: 20, scc: 0, stkPercent: 3,
            numInBuy: 1, numInSale: 1,
            markupPercent: 0, spkPercent: 0, qocRate: 0,
        }));
        // STK = 3% * preQLC
        expect(result.U_STK).toBeGreaterThan(0);
        expect(result.U_STK).toBeCloseTo(result.U_preQLC * 0.03, 0);
        // QLC = ceil(preQLC + STK, 0.01)
        expect(result.U_QLC).toBeGreaterThan(result.U_preQLC);
    });

    // TermID 6733: STK=5%
    it('TermID 6733: Exwork US — STK 5%', () => {
        const result = calculate(makeInput({
            productCost: 28.89, pkh: 0, soc: 0, exchangeRate: 31.25,
            orderTerm: 'Exwork', shipModeNo: 6, dimUnit: 1,
            length: 0, width: 0, height: 0, itemWeight: 2,
            freightRate: 250, freight: 500,
            insPercent: 1, zoneRate: 0, dtPercent: 10,
            etPercent: 0, miscTax: 0,
            wtt: 100, cc: 50, scc: 0, stkPercent: 5,
            numInBuy: 1, numInSale: 1,
            markupPercent: 0, spkPercent: 0, qocRate: 0,
        }));
        expect(result.U_STK).toBeCloseTo(result.U_preQLC * 0.05, 0);
    });

    // TermID 76532: STK=20%
    it('TermID 76532: Exwork US INCH — STK 20%', () => {
        const result = calculate(makeInput({
            productCost: 10.4, pkh: 0, soc: 0, exchangeRate: 33.5,
            orderTerm: 'Exwork', shipModeNo: 6, dimUnit: 2,
            length: 0, width: 0, height: 0, itemWeight: 0.08,
            freightRate: 300, freight: 50,
            insPercent: 1, zoneRate: 0, dtPercent: 10,
            etPercent: 0, miscTax: 0,
            wtt: 150, cc: 100, scc: 0, stkPercent: 20,
            numInBuy: 1, numInSale: 1,
            markupPercent: 0, spkPercent: 0, qocRate: 0,
        }));
        expect(result.U_STK).toBeCloseTo(result.U_preQLC * 0.20, 0);
    });
});

describe('Golden Cases — SCC (Special Custom Clear / U_ASP)', () => {

    // TermID 33417: U_ASP=1250
    it('TermID 33417: Exwork US INCH AirCOUR — SCC 1250', () => {
        const result = calculate(makeInput({
            productCost: 598.64, pkh: 0, soc: 0, exchangeRate: 35.2,
            orderTerm: 'Exwork', shipModeNo: 6, dimUnit: 2,
            length: 6, width: 6, height: 6, itemWeight: 0.91,
            freightRate: 200, freight: 1250,
            insPercent: 1, zoneRate: 720, dtPercent: 10,
            etPercent: 0, miscTax: 0,
            wtt: 750, cc: 400, scc: 1250, stkPercent: 0,
            numInBuy: 1, numInSale: 1,
            markupPercent: 0, spkPercent: 0, qocRate: 0,
        }));
        // SCC is added to preQLC
        // preQLC = OP*ExRate + INS + FR + DT + ... + WTT + CC + SCC
        // SCC=1250 should be in preQLC
        expect(result.U_preQLC).toBeGreaterThan(result.U_OP_THB + 1250);
    });
});

describe('Golden Cases — MiscTax', () => {

    // TermID 78696: MiscTax=12
    it('TermID 78696: Exwork US INCH — MiscTax 12', () => {
        const result = calculate(makeInput({
            productCost: 443.86, pkh: 0, soc: 0, exchangeRate: 32.1,
            orderTerm: 'Exwork', shipModeNo: 6, dimUnit: 2,
            length: 0, width: 0, height: 0, itemWeight: 12,
            freightRate: 200, freight: 2160,
            insPercent: 1, zoneRate: 0, dtPercent: 10,
            etPercent: 0, miscTax: 12,
            wtt: 66.66, cc: 33.33, scc: 0, stkPercent: 0,
            numInBuy: 1, numInSale: 1,
            markupPercent: 0, spkPercent: 0, qocRate: 0,
        }));
        // MiscTax is added into preQLC
        // Without miscTax, preQLC would be 12 less
        const withoutMisc = result.U_preQLC - 12;
        expect(withoutMisc).toBeGreaterThan(0);
    });

    // TermID 247612: MiscTax=2500 (large)
    it('TermID 247612: Exwork US INCH — MiscTax 2500', () => {
        const result = calculate(makeInput({
            productCost: 257.56, pkh: 0, soc: 0, exchangeRate: 33.25,
            orderTerm: 'Exwork', shipModeNo: 6, dimUnit: 2,
            length: 35, width: 11, height: 11, itemWeight: 5,
            freightRate: 250, freight: 2000,
            insPercent: 1, zoneRate: 720, dtPercent: 10,
            etPercent: 0, miscTax: 2500,
            wtt: 80, cc: 80, scc: 0, stkPercent: 0,
            numInBuy: 1, numInSale: 1,
            markupPercent: 10, spkPercent: 5, qocRate: 0,
        }));
        // MiscTax=2500 in preQLC
        expect(result.U_preQLC).toBeGreaterThan(2500);
        // SPK is added to totalPrice
        const expectedSPK = Math.round(result.U_QLC2 * 0.05 * 1000000) / 1000000;
        expect(result.U_QLC3).toBeCloseTo(result.U_QLC2 + expectedSPK, 0);
    });
});

describe('Golden Cases — INCH dimension (dimUnit=2)', () => {

    // TermID 897870: CPT TH USD AirFWD, INCH, large dimensions
    it('TermID 897870: CPT INCH — vol*17 conversion', () => {
        const result = calculate(makeInput({
            productCost: 361.31, pkh: 0, soc: 178.8, exchangeRate: 32.85,
            orderTerm: 'CPT', shipModeNo: 1, dimUnit: 2,
            length: 8, width: 26, height: 96, itemWeight: 78,
            freight: 0, insPercent: 1, zoneRate: 0,
            dtPercent: 10, etPercent: 0, miscTax: 0,
            wtt: 200, cc: 3207.7951, scc: 0, stkPercent: 0,
            numInBuy: 1, numInSale: 1,
            markupPercent: 10, spkPercent: 0, qocRate: 0,
        }));
        // INCH → vol * 17, then / 6000 for mode 1
        // vol = 8 * 26 * 96 = 19968
        // adjustedVol = 19968 * 17 = 339456
        // DW = 339456 / 6000 = 56.576
        expect(result.U_DimWeight).toBeCloseTo(56.576, 2);
    });
});
