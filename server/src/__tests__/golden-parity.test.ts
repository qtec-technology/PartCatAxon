import { describe, it, expect } from 'vitest';
import { calculate, CalcInput, CalcResult } from '#src/services/calculation.service.js';

// ─── Helper ─────────────────────────────────────────────────────────────────

function makeInput(o: Partial<CalcInput>): CalcInput {
    return {
        productCost: 0, pkh: 0, soc: 0, exchangeRate: 1,
        orderTerm: 'DDP', shipModeNo: 3, dimUnit: 1,
        length: 0, width: 0, height: 0, itemWeight: 0,
        freightRate: 0, freight: 0,
        insPercent: 0, zoneRate: 0, dtPercent: 0, etPercent: 0, miscTax: 0,
        wtt: 0, cc: 0, scc: 0, stkPercent: 0,
        numInBuy: 1, numInSale: 1,
        markupPercent: 0, spkPercent: 0, qocRate: 0,
        ...o,
    };
}

/**
 * Compare every calculable output field between engine result and CSV persisted value.
 * Uses tolerance of 0.01 for most fields, 0.02 for downstream fields.
 */
function compareAll(
    label: string,
    result: CalcResult,
    csv: Partial<Record<keyof CalcResult, number>>,
) {
    const diffs: string[] = [];
    for (const [key, expected] of Object.entries(csv)) {
        const actual = result[key as keyof CalcResult];
        const diff = Math.abs(actual - expected);
        if (diff > 0.02) {
            diffs.push(`  ${key}: engine=${actual}, csv=${expected}, diff=${diff.toFixed(6)}`);
        }
    }
    if (diffs.length > 0) {
        throw new Error(`${label} mismatches:\n${diffs.join('\n')}`);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Exact Parity Tests: Engine output vs CSV persisted values
// ═══════════════════════════════════════════════════════════════════════════

describe('Exact Parity — engine output vs CSV persisted values', () => {

    // ─── CIF TH USD Sea (TermID 897455) ──────────────────────────────────
    it('TermID 897455: CIF TH USD Sea — every field matches CSV', () => {
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
        compareAll('897455', result, {
            U_OP: 40,
            U_OP_THB: 1340,
            U_INS: 13.4,
            U_CIF: 1353.4,
            U_CIFZONE: 0,
            U_DT: 0,
            U_DT_FR: 0,
            U_DT_FRZONE: 0,
            U_ET: 0,
            U_MT: 0,
            U_preQLC: 1498.15,
            U_STK: 0,
            U_QLC: 1498.15,
            U_QLC2: 1498.15,
            U_QLC3: 1498.15,
            U_MK_THB: 166.461111,
            U_SalesPrice: 1664.611111,
        });
    });

    // ─── DDP TH THB Truck simple (TermID 839905) ────────────────────────
    // From original vw@PITM1.csv: ProdCost=21593 THB, MK=10%
    it('TermID 839905: DDP TH THB Truck — every field matches CSV', () => {
        const result = calculate(makeInput({
            productCost: 21593, pkh: 0, soc: 0, exchangeRate: 1,
            orderTerm: 'DDP', shipModeNo: 3,
            numInBuy: 1, numInSale: 1,
            markupPercent: 10, spkPercent: 0, qocRate: 0,
        }));
        compareAll('839905', result, {
            U_OP: 21593,
            U_OP_THB: 21593,
            U_INS: 0,
            U_CIF: 21593,
            U_CIFZONE: 0,
            U_DT: 0,
            U_ET: 0,
            U_MT: 0,
            U_preQLC: 21593,
            U_STK: 0,
            U_QLC: 21593,
            U_QLC2: 21593,
            U_QLC3: 21593,
        });
    });

    // ─── FOB US USD AirCOUR (TermID 872671) ─────────────────────────────
    it('TermID 872671: FOB US USD AirCOUR — every field matches CSV', () => {
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
        compareAll('872671', result, {
            U_OP: 45.06,
            U_OP_THB: 1543.19235,
            U_INS: 15.431923,
            U_CIF: 1983.624273,
            U_CIFZONE: 0,           // CSV shows 0
            U_DT_FR: 198.362427,
            U_DT_FRZONE: 0,
            U_DT: 198.362427,
            U_ET: 0,
            U_MT: 0,
            U_preQLC: 2712.04,      // CSV: 2712.03935 ≈ 2712.04
        });
    });

    // ─── CFR TH USD AirFWD (TermID 879373) ──────────────────────────────
    it('TermID 879373: CFR TH USD AirFWD — every field matches CSV', () => {
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
        compareAll('879373', result, {
            U_OP: 10,
            U_OP_THB: 330,
            U_INS: 3.3,
            U_CIF: 333.3,
            U_DT_FR: 33.33,
            U_DT: 33.33,
            U_preQLC: 460.46,
            U_QLC2: 460.46,
            U_QLC3: 460.46,
            U_MK_THB: 51.162222,
            U_SalesPrice: 511.622222,
        });
    });

    // ─── FAS SG SGD AirCOUR (TermID 858854) ─────────────────────────────
    it('TermID 858854: FAS SG SGD AirCOUR — every field matches CSV', () => {
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
        compareAll('858854', result, {
            U_OP: 5.8,
            U_OP_THB: 156.8175,
            U_INS: 0,
            U_DT: 0,
            U_preQLC: 152.25,    // CSV shows 152.25
            U_QLC2: 152.25,
            U_QLC3: 152.25,
            U_MK_THB: 16.916666,
            U_SalesPrice: 169.166666,
        });
    });

    // ─── Exwork US USD AirCOUR with STK 3% (TermID 5407) ────────────────
    it('TermID 5407: Exwork INCH STK3% — every field matches CSV', () => {
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
        // CSV: OP=71.23, OP_THB=2351.409145 (Exwork+mode6 → *1.03)
        compareAll('5407', result, {
            U_OP: 71.23,
            U_OP_THB: 2351.409145,
            U_INS: 23.514091,
            U_CIF: 2924.923236,
            U_DT_FR: 292.492323,
            U_DT: 292.492323,
        });
        // STK = 3% * preQLC
        // CSV: preQLC=3188.927915, STK=95.66784
        expect(result.U_preQLC).toBeCloseTo(3188.93, 0);
        expect(result.U_STK).toBeCloseTo(95.668, 0);
        // QLC = ceil(preQLC + STK, 0.01) = 3284.6
        expect(result.U_QLC).toBeCloseTo(3284.6, 0);
    });

    // ─── CPT TH USD AirFWD (TermID 898665) ──────────────────────────────
    it('TermID 898665: CPT TH USD AirFWD — every field matches CSV', () => {
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
        compareAll('898665', result, {
            U_OP: 314.27,
            U_OP_THB: 10465.191,
            U_INS: 104.65191,
            U_CIF: 10569.84291,
            U_DT_FR: 1056.984291,
            U_DT: 1056.984291,
            U_preQLC: 13893.49,     // CSV: 13893.4872 ≈ 13893.49
            U_QLC2: 13893.49,
            U_QLC3: 13893.49,
            U_MK_THB: 1543.721111,
            U_SalesPrice: 15437.21111,
        });
    });

    // ─── CIF TH USD Sea with DT 10% (TermID 896274) ────────────────────
    it('TermID 896274: CIF TH USD Sea — DT 10% matches CSV', () => {
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
        compareAll('896274', result, {
            U_OP: 4050,
            U_OP_THB: 135675,
            U_INS: 1356.75,
            U_CIF: 137031.75,
            U_DT_FR: 13703.175,
            U_DT: 13703.175,
            U_preQLC: 168234.925,   // CSV: 168234.925
            U_QLC: 168234.93,       // CSV: 168234.93
            U_MK_THB: 18692.77,
            U_SalesPrice: 186927.7,
        });
    });

    // ─── Exwork + AirCOUR with SCC + MiscTax (TermID 33417) ─────────────
    it('TermID 33417: Exwork INCH SCC=1250 — every field matches CSV', () => {
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
        compareAll('33417', result, {
            U_OP: 598.64,
            U_OP_THB: 21704.29184,  // 598.64 * 35.2 * 1.03
            U_INS: 217.042918,
        });
        // DT = MAX(DT_FR, DT_FRZONE)
        // CSV: DT_FR=2317.133475, DT_FRZONE=2257.653475, DT=2317.133475
        expect(result.U_DT_FR).toBeCloseTo(2317.133, 0);
        expect(result.U_DT_FRZONE).toBeCloseTo(2257.653, 0);
        expect(result.U_DT).toBeCloseTo(2317.133, 0);
        // preQLC = CSV: 27256.30439
        expect(result.U_preQLC).toBeCloseTo(27256.30, 0);
        expect(result.U_QLC).toBeCloseTo(27256.31, 0);
    });

    // ─── CFR with STK 5% + SPK + QOC (TermID 865676) ───────────────────
    it('TermID 865676: CFR VN STK5% SPK+QOC — downstream matches CSV', () => {
        const result = calculate(makeInput({
            productCost: 705, pkh: 0, soc: 7.63, exchangeRate: 33.5,
            orderTerm: 'CFR', shipModeNo: 2, dimUnit: 1,
            length: 41, width: 33, height: 45, itemWeight: 12,
            freight: 0, insPercent: 1, zoneRate: 0,
            dtPercent: 0, etPercent: 0, miscTax: 0,
            wtt: 17.045, cc: 181.818, scc: 0, stkPercent: 5,
            numInBuy: 60, numInSale: 1,
            markupPercent: 10, spkPercent: 1.17526117, qocRate: 0.005,
        }));
        compareAll('865676', result, {
            U_OP: 712.63,
            U_OP_THB: 23873.105,
            U_INS: 238.73105,
            U_CIF: 24111.83605,
        });
        // STK = 5% * preQLC
        // CSV: preQLC=24310.69905, STK=1215.535
        expect(result.U_preQLC).toBeCloseTo(24310.70, 0);
        expect(result.U_STK).toBeCloseTo(1215.535, 0);
        // QLC2 = QLC / 60
        // CSV: QLC2=425.437333
        expect(result.U_QLC2).toBeCloseTo(425.44, 0);
        // QLC3 = QLC2 * 1 + 5 + 5 = 435.437
        // CSV: QLC3=435.437333
        expect(result.U_QLC3).toBeCloseTo(435.44, 0);
    });
});
