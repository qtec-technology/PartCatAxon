import type {
  AllocationLineResult,
  AllocationLineSource,
  BulkCostInput,
  FinalResultColumns,
} from './bulk-cost.types';

export type BulkCostFormulaAuditStatus = 'pass' | 'fail' | 'warn';

export type BulkCostFormulaAuditStepKey =
  | 'op-source'
  | 'op1-thb'
  | 'op2'
  | 'ins'
  | 'fr-actual'
  | 'fr-zone'
  | 'cif-actual'
  | 'cif-zone'
  | 'dt-actual'
  | 'dt-zone'
  | 'selected-duty'
  | 'et'
  | 'mt'
  | 'pre-qlc'
  | 'stk'
  | 'qlc'
  | 'qlc2'
  | 'total-qlc'
  | 'markup'
  | 'sales-price';

export interface BulkCostFormulaAuditRow {
  stepKey: BulkCostFormulaAuditStepKey;
  label: string;
  formulaName: string;
  inputValues: Record<string, string | number | null>;
  expectedValue: number | string | null;
  actualValue: number | string | null;
  status: BulkCostFormulaAuditStatus;
  note: string;
}

export interface BulkCostFormulaAudit {
  rows: BulkCostFormulaAuditRow[];
  status: BulkCostFormulaAuditStatus;
  passCount: number;
  warnCount: number;
  failCount: number;
}

export interface BuildBulkCostFormulaAuditOptions {
  allocationLine?: Pick<AllocationLineResult, 'freightPerEach'>;
  tolerance?: number;
}

const DEFAULT_TOLERANCE = 0.01;

export function buildBulkCostFormulaAudit(
  source: AllocationLineSource,
  costs: BulkCostInput,
  finalResult: FinalResultColumns,
  options: BuildBulkCostFormulaAuditOptions = {},
): BulkCostFormulaAudit {
  const tolerance = options.tolerance ?? DEFAULT_TOLERANCE;
  const rows: BulkCostFormulaAuditRow[] = [];
  const dutyRate = source.importDutyPercent / 100;
  const isExworkTerm = costs.orderTerm === 'Exwork' || costs.orderTerm === 'Ex-work';
  const isFcaOrExwork = isExworkTerm || costs.orderTerm === 'FCA';
  const isFobType = isFcaOrExwork || costs.orderTerm === 'FAS' || costs.orderTerm === 'FOB';
  const exworkCaseExpected = isFobType && (costs.shipModeNo === 3 || costs.shipModeNo === 6) ? 1.03 : 1;
  const docCOO = round6(source.docFee.coo + source.docFee.coa);
  const docFeeTotal = round6(
    source.docFee.coc +
      source.docFee.millCert +
      source.docFee.testCert +
      docCOO +
      source.docFee.anyOther,
  );
  const opSourceExpected = round6(source.unitPrice + finalResult.pkh + finalResult.soc + docFeeTotal);
  const op1Expected = round6(opSourceExpected * costs.exchangeRate);
  const op2Expected = round6(op1Expected * exworkCaseExpected);
  const insExpected = round6(op2Expected * (source.insPercent / 100));
  const dw = calcDW(source.length, source.width, source.height, costs.shipModeNo, source.dimUnit);
  const itemWeight = source.itemWeightPerEach ?? 0;
  const shipWeightExpected = source.shippingWeightPerEach !== null && source.shippingWeightPerEach > 0
    ? source.shippingWeightPerEach
    : ceilTo(Math.max(dw, itemWeight), 0.5);
  const frActualExpected = options.allocationLine
    ? round6(options.allocationLine.freightPerEach * costs.exchangeRate)
    : finalResult.frQTEC;
  const frActualNote = options.allocationLine
    ? 'Compared against allocated freight per each converted to THB.'
    : 'No allocation result supplied; using final FR value as the audit baseline.';
  const frZoneRateExpected = isFcaOrExwork && costs.shipModeNo === 6 ? source.zoneRate : 0;
  const frZoneExpected = round6(
    isFcaOrExwork && costs.shipModeNo === 3
      ? 0.1 * op2Expected
      : isFcaOrExwork && costs.shipModeNo === 6
        ? Math.max(dw, itemWeight) * source.zoneRate
        : 0,
  );
  const cifActualExpected = round6(isFcaOrExwork && costs.shipModeNo === 3 ? 0 : op2Expected + insExpected + frActualExpected);
  const cifZoneExpected = round6(
    isFcaOrExwork && (costs.shipModeNo === 3 || costs.shipModeNo === 6)
      ? op2Expected + insExpected + frZoneExpected
      : 0,
  );
  const dtActualExpected = round6(cifActualExpected * dutyRate);
  const dtZoneExpected = round6(cifZoneExpected * dutyRate);
  const selectedDutyExpected = round6(Math.max(dtActualExpected, dtZoneExpected));
  const etExpected = calculateET(Math.max(cifActualExpected, cifZoneExpected), selectedDutyExpected, source.miscTax, source.etPercent);
  const mtExpected = round6(etExpected * 0.1);
  const preQlcExpected = round6(
    op1Expected +
      insExpected +
      frActualExpected +
      selectedDutyExpected +
      etExpected +
      mtExpected +
      source.miscTax +
      finalResult.ttFinal +
      finalResult.ccFinal +
      source.scc,
  );
  const stkExpected = round6((source.stkPercent / 100) * preQlcExpected);
  const qlcExpected = round6(ceilTo(preQlcExpected + stkExpected, 0.01));
  const qlc2Expected = finalResult.stockConversion > 0 ? round6(qlcExpected / finalResult.stockConversion) : 0;
  const qlc2Actual = finalResult.stockConversion > 0 ? round6(finalResult.qlc / finalResult.stockConversion) : 0;
  const totalQlcExpected = round6(
    (finalResult.saleConversion > 0 ? round6(qlc2Expected * finalResult.saleConversion) : 0) +
      finalResult.spk +
      finalResult.qocVal,
  );
  const markupDenom = 1 - source.markupPercent / 100;
  const markupExpected = markupDenom > 0 ? round6(totalQlcExpected / markupDenom - totalQlcExpected) : 0;
  const salesPriceExpected = markupDenom > 0 ? round6(totalQlcExpected / markupDenom) : 0;

  addNumericRow(rows, tolerance, {
    stepKey: 'op-source',
    label: 'OP source',
    formulaName: 'PCS + PKH + SOC + doc fees',
    inputValues: {
      productCost: source.unitPrice,
      pkh: finalResult.pkh,
      soc: finalResult.soc,
      docCOC: source.docFee.coc,
      docMill: source.docFee.millCert,
      docTestCert: source.docFee.testCert,
      docCOO,
      docAnyOther: source.docFee.anyOther,
    },
    expectedValue: opSourceExpected,
    actualValue: finalResult.op1Source,
    note: 'Document fees are per-each values and must be included before exchange rate.',
  });
  addNumericRow(rows, tolerance, {
    stepKey: 'op1-thb',
    label: 'OP1 THB',
    formulaName: 'OP source * exchange rate',
    inputValues: { opSource: opSourceExpected, exchangeRate: costs.exchangeRate },
    expectedValue: op1Expected,
    actualValue: finalResult.op1,
    note: 'Bulk Cost frontend OP1 should match the Term OP_SUM basis.',
  });
  addNumericRow(rows, tolerance, {
    stepKey: 'op2',
    label: 'OP2',
    formulaName: 'OP1 * ExworkCase',
    inputValues: { op1: op1Expected, orderTerm: costs.orderTerm, shipModeNo: costs.shipModeNo, exworkCase: exworkCaseExpected },
    expectedValue: op2Expected,
    actualValue: finalResult.op2,
    note: '',
  });
  addNumericRow(rows, tolerance, {
    stepKey: 'ins',
    label: 'INS',
    formulaName: 'OP2 * INS%',
    inputValues: { op2: op2Expected, insPercent: source.insPercent },
    expectedValue: insExpected,
    actualValue: finalResult.ins,
    note: '',
  });
  addNumericRow(rows, tolerance, {
    stepKey: 'fr-actual',
    label: 'FR actual',
    formulaName: 'allocated FR/Ea * exchange rate',
    inputValues: {
      freightPerEach: options.allocationLine?.freightPerEach ?? null,
      exchangeRate: costs.exchangeRate,
      shipWeightCal: shipWeightExpected,
      freightRate: source.freightRate,
    },
    expectedValue: frActualExpected,
    actualValue: finalResult.frQTEC,
    note: frActualNote,
    mismatchStatus: options.allocationLine ? 'warn' : 'pass',
  });
  addNumericRow(rows, tolerance, {
    stepKey: 'fr-zone',
    label: 'FR zone',
    formulaName: 'Truck: OP2*10%; Air COUR: max(DW, IW)*zoneRate',
    inputValues: { orderTerm: costs.orderTerm, shipModeNo: costs.shipModeNo, dw, itemWeight, zoneRate: source.zoneRate, frZoneRate: frZoneRateExpected },
    expectedValue: frZoneExpected,
    actualValue: finalResult.frZoneCost,
    note: '',
  });
  addNumericRow(rows, tolerance, {
    stepKey: 'cif-actual',
    label: 'CIF actual',
    formulaName: 'OP2 + INS + FR actual',
    inputValues: { op2: op2Expected, ins: insExpected, frActual: frActualExpected, orderTerm: costs.orderTerm, shipModeNo: costs.shipModeNo },
    expectedValue: cifActualExpected,
    actualValue: finalResult.cifQTEC,
    note: 'Exwork/FCA truck branch is zero, matching Term engine behavior.',
  });
  addNumericRow(rows, tolerance, {
    stepKey: 'cif-zone',
    label: 'CIF zone',
    formulaName: 'OP2 + INS + FR zone',
    inputValues: { op2: op2Expected, ins: insExpected, frZone: frZoneExpected },
    expectedValue: cifZoneExpected,
    actualValue: finalResult.cifZone,
    note: '',
  });
  addNumericRow(rows, tolerance, {
    stepKey: 'dt-actual',
    label: 'DT actual',
    formulaName: 'CIF actual * duty%',
    inputValues: { cifActual: cifActualExpected, dutyPercent: source.importDutyPercent },
    expectedValue: dtActualExpected,
    actualValue: finalResult.dtQTEC,
    note: '',
  });
  addNumericRow(rows, tolerance, {
    stepKey: 'dt-zone',
    label: 'DT zone',
    formulaName: 'CIF zone * duty%',
    inputValues: { cifZone: cifZoneExpected, dutyPercent: source.importDutyPercent },
    expectedValue: dtZoneExpected,
    actualValue: finalResult.dtZone,
    note: '',
  });
  addNumericRow(rows, tolerance, {
    stepKey: 'selected-duty',
    label: 'Selected duty',
    formulaName: 'MAX(DT actual, DT zone)',
    inputValues: { dtActual: dtActualExpected, dtZone: dtZoneExpected },
    expectedValue: selectedDutyExpected,
    actualValue: finalResult.selectedDuty,
    note: '',
  });
  addNumericRow(rows, tolerance, {
    stepKey: 'et',
    label: 'ET',
    formulaName: '(MAX(CIF)+DT+MiscTax)*ET%/(1-1.1*ET%)',
    inputValues: { cifMax: Math.max(cifActualExpected, cifZoneExpected), selectedDuty: selectedDutyExpected, miscTax: source.miscTax, etPercent: source.etPercent },
    expectedValue: etExpected,
    actualValue: finalResult.et,
    note: 'Reverse formula mirrors the backend Term engine.',
  });
  addNumericRow(rows, tolerance, {
    stepKey: 'mt',
    label: 'MT',
    formulaName: 'ET * 10%',
    inputValues: { et: etExpected },
    expectedValue: mtExpected,
    actualValue: finalResult.mt,
    note: '',
  });
  addNumericRow(rows, tolerance, {
    stepKey: 'pre-qlc',
    label: 'preQLC',
    formulaName: 'OP1 + INS + FR + DT + ET + MT + MiscTax + TT + CC + SCC',
    inputValues: {
      op1: op1Expected,
      ins: insExpected,
      frActual: frActualExpected,
      selectedDuty: selectedDutyExpected,
      et: etExpected,
      mt: mtExpected,
      miscTax: source.miscTax,
      tt: finalResult.ttFinal,
      cc: finalResult.ccFinal,
      scc: source.scc,
    },
    expectedValue: preQlcExpected,
    actualValue: finalResult.preQLC,
    note: 'Uses OP1/OP_SUM as the base, not OP2.',
  });
  addNumericRow(rows, tolerance, {
    stepKey: 'stk',
    label: 'STK',
    formulaName: 'STK% * preQLC',
    inputValues: { stkPercent: source.stkPercent, preQLC: preQlcExpected },
    expectedValue: stkExpected,
    actualValue: finalResult.stk,
    note: '',
  });
  addNumericRow(rows, tolerance, {
    stepKey: 'qlc',
    label: 'QLC',
    formulaName: 'CEILING(preQLC + STK, 0.01)',
    inputValues: { preQLC: preQlcExpected, stk: stkExpected },
    expectedValue: qlcExpected,
    actualValue: finalResult.qlc,
    note: '',
  });
  addNumericRow(rows, tolerance, {
    stepKey: 'qlc2',
    label: 'QLC2',
    formulaName: 'QLC / stockConversion',
    inputValues: { qlc: finalResult.qlc, stockConversion: finalResult.stockConversion },
    expectedValue: qlc2Expected,
    actualValue: qlc2Actual,
    note: finalResult.stockConversion > 0 ? '' : 'stockConversion is zero or missing.',
    mismatchStatus: finalResult.stockConversion > 0 ? 'fail' : 'warn',
  });
  addNumericRow(rows, tolerance, {
    stepKey: 'total-qlc',
    label: 'Total QLC / Total Price',
    formulaName: 'QLC2 * saleConversion + SPK + QOC',
    inputValues: { qlc2: qlc2Expected, saleConversion: finalResult.saleConversion, spk: finalResult.spk, qoc: finalResult.qocVal },
    expectedValue: totalQlcExpected,
    actualValue: finalResult.totalQLC,
    note: 'Matches Term TotalPrice before markup.',
  });
  addNumericRow(rows, tolerance, {
    stepKey: 'markup',
    label: 'Markup',
    formulaName: 'Total QLC / (1 - markup%) - Total QLC',
    inputValues: { totalQLC: totalQlcExpected, markupPercent: source.markupPercent },
    expectedValue: markupExpected,
    actualValue: finalResult.markup,
    note: markupDenom > 0 ? '' : 'markupPercent leaves no valid denominator.',
    mismatchStatus: markupDenom > 0 ? 'fail' : 'warn',
  });
  addNumericRow(rows, tolerance, {
    stepKey: 'sales-price',
    label: 'Sales price',
    formulaName: 'Total QLC / (1 - markup%)',
    inputValues: { totalQLC: totalQlcExpected, markupPercent: source.markupPercent },
    expectedValue: salesPriceExpected,
    actualValue: finalResult.roundUp,
    note: 'Round Up column currently stores the frontend sales price result.',
    mismatchStatus: markupDenom > 0 ? 'fail' : 'warn',
  });

  const failCount = rows.filter((row) => row.status === 'fail').length;
  const warnCount = rows.filter((row) => row.status === 'warn').length;
  const passCount = rows.filter((row) => row.status === 'pass').length;
  return {
    rows,
    status: failCount > 0 ? 'fail' : warnCount > 0 ? 'warn' : 'pass',
    passCount,
    warnCount,
    failCount,
  };
}

function addNumericRow(
  rows: BulkCostFormulaAuditRow[],
  tolerance: number,
  row: Omit<BulkCostFormulaAuditRow, 'status'> & { mismatchStatus?: 'fail' | 'warn' | 'pass' },
): void {
  const status = compareNumeric(row.expectedValue, row.actualValue, tolerance, row.mismatchStatus);
  rows.push({
    stepKey: row.stepKey,
    label: row.label,
    formulaName: row.formulaName,
    inputValues: row.inputValues,
    expectedValue: normalizeNumber(row.expectedValue),
    actualValue: normalizeNumber(row.actualValue),
    status,
    note: row.note,
  });
}

function compareNumeric(
  expected: number | string | null,
  actual: number | string | null,
  tolerance: number,
  mismatchStatus: 'fail' | 'warn' | 'pass' = 'fail',
): BulkCostFormulaAuditStatus {
  if (typeof expected !== 'number' || typeof actual !== 'number') {
    return expected === actual ? 'pass' : mismatchStatus;
  }
  if (!Number.isFinite(expected) || !Number.isFinite(actual)) {
    return expected === actual ? 'pass' : mismatchStatus;
  }
  return Math.abs(expected - actual) <= tolerance ? 'pass' : mismatchStatus;
}

function calculateET(cifMax: number, selectedDuty: number, miscTax: number, etPercent: number): number {
  if (etPercent <= 0) return 0;
  const denom = 1 - (1.1 * etPercent / 100);
  if (denom <= 0) return 0;
  return round6((cifMax + selectedDuty + miscTax) * (etPercent / 100) / denom);
}

function calcDW(l: number, w: number, h: number, shipMode: number, dimUnit: number): number {
  if (shipMode < 1) return 0;
  const vol = l * w * h;
  if (vol === 0) return 0;
  const adjustedVol = dimUnit === 2 ? vol * 17 : vol;
  switch (shipMode) {
    case 1:
    case 4:
    case 5:
      return adjustedVol / 6000;
    case 2: {
      const d = adjustedVol / 1000;
      return d < 1000 ? 1000 : d;
    }
    case 3:
    case 6:
      return adjustedVol / 5000;
    default:
      return adjustedVol / 6000;
  }
}

function ceilTo(value: number, step: number): number {
  if (step === 0) return value;
  return Math.ceil(value / step) * step;
}

function round6(value: number): number {
  return Math.round(value * 1000000) / 1000000;
}

function normalizeNumber(value: number | string | null): number | string | null {
  return typeof value === 'number' ? round6(value) : value;
}
