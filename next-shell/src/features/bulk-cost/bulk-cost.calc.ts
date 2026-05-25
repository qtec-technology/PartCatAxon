// ─────────────────────────────────────────────────────────────────────────────
// Bulk Cost Allocation – Pure Calculation Function
// ─────────────────────────────────────────────────────────────────────────────
//
// Aligned with: ผลลัพธ์สุดท้ายที่ต้องได้ครบ.md
//
// Allocation rules from the spec:
//   PKH  → by weight (PART 3)
//   SOC  → by weight (PART 3)
//   Freight → by weight (PART 4)
//   CC   → by weight (PART 4)    ← corrected: CC is by weight, not by value
//   TT   → by value  (PART 4)
//
// Document fees (COC, Mill, Test Cert, COA, COO, Any Other):
//   Already per-each on the source line. Passed through to final result.
//
// Final result (AY–CP):
//   Uses the existing Term calculation engine logic to compute OP1, OP2,
//   CIF, DT, QLC, Total QLC, Markup, Round Up with the allocated costs.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  AllocationLineResult,
  AllocationLineSource,
  AllocationPreview,
  AllocationWarning,
  BulkCostInput,
  FinalResultColumns,
} from './bulk-cost.types';

// ─── Public API ─────────────────────────────────────────────────────────────

export function calculateAllocationPreview(
  lines: readonly AllocationLineSource[],
  costs: BulkCostInput,
): AllocationPreview {
  const runWarnings: AllocationWarning[] = [];

  // ─── Validate inputs ─────────────────────────────────────────────────────
  if (lines.length === 0) {
    runWarnings.push({
      code: 'ZERO_QTY',
      message: 'No lines selected for allocation.',
      severity: 'error',
    });
  }

  const vendors = new Set(lines.map((l) => l.vendorCode).filter(Boolean));
  if (vendors.size > 1) {
    runWarnings.push({
      code: 'MIXED_VENDOR',
      message: `Multiple vendors detected (${[...vendors].join(', ')}). Allocation should use a single vendor.`,
      severity: 'error',
    });
  }

  const currencies = new Set(lines.map((l) => l.currency).filter(Boolean));
  if (currencies.size > 1) {
    runWarnings.push({
      code: 'MIXED_CURRENCY',
      message: `Multiple currencies detected (${[...currencies].join(', ')}). Allocation should use a single currency.`,
      severity: 'error',
    });
  }

  // Check negative cost inputs
  const costKeys = ['pkh', 'soc', 'freight', 'customs', 'wireTT'] as const;
  for (const field of costKeys) {
    if (costs[field] < 0) {
      runWarnings.push({
        code: 'NEGATIVE_COST',
        message: `${field} has a negative value (${costs[field]}).`,
        severity: 'warning',
        field,
      });
    }
  }

  // ─── Compute totals ──────────────────────────────────────────────────────
  let totalWeight = 0;
  let totalAmount = 0;
  let totalQty = 0;
  let weightAvailable = 0;
  let weightMissing = 0;

  for (const line of lines) {
    const w = resolveWeight(line);
    if (w !== null && w > 0) {
      totalWeight += w * line.qty;
      weightAvailable++;
    } else {
      weightMissing++;
    }
    totalAmount += line.amount;
    totalQty += line.qty;
  }

  // ─── Per-line allocation ──────────────────────────────────────────────────
  const lineResults: AllocationLineResult[] = [];

  // Running totals for rounding residual tracking
  let allocPKH = 0, allocSOC = 0, allocFreight = 0, allocCC = 0, allocTT = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const warnings: AllocationWarning[] = [];
    const isLast = i === lines.length - 1;

    const weight = resolveWeight(line);
    const lineWeight = weight !== null && weight > 0 ? weight * line.qty : 0;

    // ── Ratios ──────────────────────────────────────────────────────────────
    const weightRatioPerItem = totalWeight > 0 ? lineWeight / totalWeight : 0;
    const weightRatioPerEach = line.qty > 0
      ? weightRatioPerItem / line.qty
      : 0;
    const valueRatioPerItem = totalAmount > 0 ? line.amount / totalAmount : 0;
    const valueRatioPerEach = line.qty > 0
      ? valueRatioPerItem / line.qty
      : 0;

    // ── Warnings ────────────────────────────────────────────────────────────
    if (weight === null || weight <= 0) {
      warnings.push({
        code: 'MISSING_WEIGHT',
        message: `Weight is missing or zero for ${lineLabel(line)}. Weight-based costs (PKH, SOC, Freight, CC) will not be allocated to this line.`,
        severity: 'warning',
        field: 'shippingWeightPerEach',
      });
    }
    if (line.amount <= 0) {
      warnings.push({
        code: 'MISSING_AMOUNT',
        message: `Amount is zero or negative for ${lineLabel(line)}. Value-based costs (TT) will not be allocated to this line.`,
        severity: 'warning',
        field: 'amount',
      });
    }
    if (line.qty <= 0) {
      warnings.push({
        code: 'ZERO_QTY',
        message: `Qty is zero for ${lineLabel(line)}.`,
        severity: 'error',
        field: 'qty',
      });
    }

    // ── Allocate weight-based: PKH, SOC, Freight, CC ────────────────────────
    const pkhItem = isLast ? costs.pkh - allocPKH : round6(costs.pkh * weightRatioPerItem);
    const socItem = isLast ? costs.soc - allocSOC : round6(costs.soc * weightRatioPerItem);
    const freightItem = isLast ? costs.freight - allocFreight : round6(costs.freight * weightRatioPerItem);
    const ccItem = isLast ? costs.customs - allocCC : round6(costs.customs * weightRatioPerItem);

    allocPKH += pkhItem;
    allocSOC += socItem;
    allocFreight += freightItem;
    allocCC += ccItem;

    // ── Allocate value-based: TT ────────────────────────────────────────────
    const ttItem = isLast ? costs.wireTT - allocTT : round6(costs.wireTT * valueRatioPerItem);
    allocTT += ttItem;

    // ── Per-each ────────────────────────────────────────────────────────────
    const safeQty = line.qty > 0 ? line.qty : 1;
    const pkhEach = round6(pkhItem / safeQty);
    const socEach = round6(socItem / safeQty);
    const freightEach = round6(freightItem / safeQty);
    const ccEach = round6(ccItem / safeQty);
    const ttEach = round6(ttItem / safeQty);

    // ── Final result (AY–CP) ────────────────────────────────────────────────
    const finalResult = computeFinalResult(line, costs, pkhEach, socEach, freightEach, ccEach, ttEach);

    const status: AllocationLineResult['status'] =
      warnings.some((w) => w.severity === 'error')
        ? 'error'
        : warnings.length > 0
          ? 'warning'
          : 'ready';

    lineResults.push({
      lineKey: line.lineKey,
      weightRatioPerItem: round6(weightRatioPerItem),
      weightRatioPerEach: round6(weightRatioPerEach),
      valueRatioPerItem: round6(valueRatioPerItem),
      valueRatioPerEach: round6(valueRatioPerEach),
      pkhPerEach: pkhEach,
      pkhPerItem: round6(pkhItem),
      socPerEach: socEach,
      socPerItem: round6(socItem),
      freightPerEach: freightEach,
      freightPerItem: round6(freightItem),
      wireTTPerEach: ttEach,
      wireTTPerItem: round6(ttItem),
      ccPerEach: ccEach,
      ccPerItem: round6(ccItem),
      finalResult,
      warnings,
      status,
    });
  }

  // ─── Rounding residuals ───────────────────────────────────────────────────
  const residual = {
    pkh: round6(costs.pkh - allocPKH),
    soc: round6(costs.soc - allocSOC),
    freight: round6(costs.freight - allocFreight),
    customs: round6(costs.customs - allocCC),
    wireTT: round6(costs.wireTT - allocTT),
  };

  const hasResidual = Object.values(residual).some((v) => Math.abs(v) > 0.001);
  if (hasResidual) {
    runWarnings.push({
      code: 'ROUNDING_RESIDUAL',
      message: `Rounding residuals: PKH=${residual.pkh}, SOC=${residual.soc}, Freight=${residual.freight}, CC=${residual.customs}, TT=${residual.wireTT}`,
      severity: 'warning',
    });
  }

  return {
    previewedAt: new Date().toISOString(),
    vendorCode: lines[0]?.vendorCode ?? '',
    vendorName: lines[0]?.vendorName ?? '',
    totalLines: lines.length,
    totalQty,
    totalAmount: round6(totalAmount),
    totalWeight: round6(totalWeight),
    weightAvailable,
    weightMissing,
    lines: lineResults,
    runWarnings,
    roundingResidual: residual,
  };
}

// ─── Final Result Computation (AY–CP) ───────────────────────────────────────
// Uses Term calculation logic with allocated costs applied.

function computeFinalResult(
  line: AllocationLineSource,
  costs: BulkCostInput,
  pkhEach: number,
  socEach: number,
  freightEach: number,
  ccEach: number,
  ttEach: number,
): FinalResultColumns {
  const productCost = line.unitPrice;
  const exRate = costs.exchangeRate;
  const orderTerm = line.orderTerm || costs.orderTerm;
  const location = line.location || costs.location;
  const shipModeNo = line.shipModeNo || costs.shipModeNo;

  // OP1 (THB) = (PCS + PKH + SOC + COC + Mill + Test Cert + COO + Any Other) * exchange rate.
  const docCOO = round6(line.docFee.coo + line.docFee.coa);
  const docFeeTotal = round6(
    line.docFee.coc +
    line.docFee.millCert +
    line.docFee.testCert +
    docCOO +
    line.docFee.anyOther
  );
  const op1Source = round6(productCost + pkhEach + socEach + docFeeTotal);
  const op1 = round6(op1Source * exRate);

  // ── Exwork Case ───────────────────────────────────────────────────────────
  const isExworkTerm = orderTerm === 'Exwork' || orderTerm === 'Ex-work';
  const isFOBType = isExworkTerm || ['FCA', 'FAS', 'FOB'].includes(orderTerm);
  const exworkCase = (isFOBType && (shipModeNo === 3 || shipModeNo === 6)) ? 1.03 : 1;

  // ── OP2 = OP1 * ExworkCase ────────────────────────────────────────────────
  const op2 = round6(op1 * exworkCase);

  // ── Insurance ─────────────────────────────────────────────────────────────
  const ins = round6(op2 * (line.insPercent / 100));

  // ── Shipping Weight ───────────────────────────────────────────────────────
  const dw = calcDW(line.length, line.width, line.height, shipModeNo, line.dimUnit);
  const iw = line.itemWeightPerEach ?? 0;
  const swCal = line.shippingWeightPerEach !== null && line.shippingWeightPerEach > 0
    ? line.shippingWeightPerEach
    : ceilTo(Math.max(dw, iw), 0.5);

  // FR Zone
  let frZoneRate = 0;
  let frZoneCost = 0;
  if (isExworkTerm || orderTerm === 'FCA') {
    if (shipModeNo === 3) {
      frZoneRate = 0;
      frZoneCost = round6(0.1 * op2);
    } else if (shipModeNo === 6) {
      frZoneRate = line.zoneRate;
      frZoneCost = round6(Math.max(dw, iw) * line.zoneRate);
    }
  }

  // ── Freight per each (allocated) — FR input is in THB, no exchange rate ──
  const frEachTHB = freightEach;
  const frQTEC = frEachTHB;

  // ── CIF ───────────────────────────────────────────────────────────────────
  let cifQTEC = 0;
  if (!(isExworkTerm || orderTerm === 'FCA') || shipModeNo !== 3) {
    cifQTEC = round6(op2 + ins + frEachTHB);
  }

  let cifZone = 0;
  if ((isExworkTerm || orderTerm === 'FCA') &&
      (shipModeNo === 3 || shipModeNo === 6)) {
    cifZone = round6(op2 + ins + frZoneCost);
  }

  // ── Duty Tax ──────────────────────────────────────────────────────────────
  const dtQTEC = round6(cifQTEC * (line.importDutyPercent / 100));
  const dtZone = round6(cifZone * (line.importDutyPercent / 100));
  const selectedDuty = round6(Math.max(dtQTEC, dtZone));

  // ── TT and CC per each in THB — inputs are always THB, no exchange rate ───
  const ttFinal = ttEach;
  const ccFinal = ccEach;

  // ── Excise Tax (ET) — reverse formula, same as Term engine ───────────────
  // ET = (MAX(CIF, CIFZONE) + DT + MiscTax) * ET% / (1 - 1.1 * ET%/100)
  const etPercent = line.etPercent;
  let et = 0;
  if (etPercent > 0) {
    const cifMax = Math.max(cifQTEC, cifZone);
    const etDenom = 1 - (1.1 * etPercent / 100);
    if (etDenom > 0) {
      et = round6((cifMax + selectedDuty + line.miscTax) * (etPercent / 100) / etDenom);
    }
  }

  // ── Municipal Tax (MT) = ET * 10% ─────────────────────────────────────────
  const mt = round6(et * 0.10);

  // ── preQLC: base is OP1 (pre-surcharge, same as OP_SUM in Term engine) ───
  // preQLC = OP1 + INS + FR + DT + ET + MT + MiscTax + TT + CC + SCC
  const preQLC = round6(op1 + ins + frEachTHB + selectedDuty + et + mt + line.miscTax + ttFinal + ccFinal + line.scc);

  // ── STK = STK% * preQLC ───────────────────────────────────────────────────
  const stk = round6((line.stkPercent / 100) * preQLC);

  // ── QLC = CEILING(preQLC + STK, 0.01) ────────────────────────────────────
  const qlc = round6(ceilTo(preQLC + stk, 0.01));

  // ── Total QLC ─────────────────────────────────────────────────────────────
  const qlc2 = line.stockConversion > 0 ? round6(qlc / line.stockConversion) : 0;
  const qlc3Base = line.saleConversion > 0 ? round6(qlc2 * line.saleConversion) : 0;
  const totalQLC = round6(qlc3Base + line.sspk + line.qoc);

  // ── Markup ────────────────────────────────────────────────────────────────
  const denom = 1 - (line.markupPercent / 100);
  const markup = denom > 0 ? round6((totalQLC / denom) - totalQLC) : 0;
  const roundUp = denom > 0 ? round6(totalQLC / denom) : 0;

  return {
    supplierName: line.vendorName,
    purchaseOrderTerm: orderTerm,
    termLocation: location,
    productCost,
    pkh: pkhEach,
    soc: socEach,
    docCOC: line.docFee.coc,
    docMill: line.docFee.millCert,
    docTestCert: line.docFee.testCert,
    docCOO,
    docAnyOther: line.docFee.anyOther,
    docFees: docFeeTotal,
    currency: line.currency,
    rateExchange: exRate,
    shipWeightCal: round6(swCal),
    insPercent: line.insPercent,
    importDutyPercent: line.importDutyPercent,
    purchaseUOM: line.purchaseUOM,
    stockUOM: line.stockUOM,
    saleUOM: line.saleUOM,
    stockConversion: line.stockConversion,
    saleConversion: line.saleConversion,
    purchaseMOQ: line.moq,
    wireTT: ttFinal,
    customClear: ccFinal,
    op1Source,
    op1,
    exworkCase,
    op2,
    ins,
    frQTEC,
    frZoneRate,
    frZoneCost,
    cifQTEC,
    cifZone,
    dtQTEC,
    dtZone,
    selectedDuty,
    ttFinal,
    ccFinal,
    et,
    mt,
    miscTaxVal: line.miscTax,
    scc: line.scc,
    preQLC,
    stk,
    qlc,
    spk: line.sspk,
    qocVal: line.qoc,
    totalQLC,
    markup,
    roundUp,
  };
}

function lineLabel(line: AllocationLineSource): string {
  return line.itemCode || line.supplierOrderCode || `line ${line.no}`;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function resolveWeight(line: AllocationLineSource): number | null {
  if (line.shippingWeightPerEach !== null && line.shippingWeightPerEach > 0) {
    return line.shippingWeightPerEach;
  }
  if (line.dimensionWeightPerEach !== null && line.dimensionWeightPerEach > 0) {
    return line.dimensionWeightPerEach;
  }
  if (line.itemWeightPerEach !== null && line.itemWeightPerEach > 0) {
    return line.itemWeightPerEach;
  }
  return null;
}

function calcDW(l: number, w: number, h: number, shipMode: number, dimUnit: number): number {
  if (shipMode < 1) return 0;
  const vol = l * w * h;
  if (vol === 0) return 0;
  const adjustedVol = dimUnit === 2 ? vol * 17 : vol;
  switch (shipMode) {
    case 1: case 4: case 5: return adjustedVol / 6000;
    case 2: { const d = adjustedVol / 1000; return d < 1000 ? 1000 : d; }
    case 3: case 6: return adjustedVol / 5000;
    default: return adjustedVol / 6000;
  }
}

function ceilTo(value: number, step: number): number {
  if (step === 0) return value;
  return Math.ceil(value / step) * step;
}

function round6(value: number): number {
  return Math.round(value * 1000000) / 1000000;
}
