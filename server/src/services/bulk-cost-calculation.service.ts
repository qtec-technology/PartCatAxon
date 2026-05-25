import { calculate } from '#src/services/calculation.service.js';
import type { SaveBulkCostRunInput } from '#src/types/bulk-cost.types.js';

const DOC_FEE_KEYS = ['coc', 'millCert', 'testCert', 'coa', 'coo', 'anyOther'] as const;

type DocFeeKey = (typeof DOC_FEE_KEYS)[number];

interface DocumentFees extends Record<DocFeeKey, number> {}

interface BulkCostInput {
    pkh: number;
    soc: number;
    freight: number;
    customs: number;
    wireTT: number;
    currency: string;
    exchangeRate: number;
    referenceNo: string;
    remark: string;
    orderTerm: string;
    location: string;
    subLocation: string;
    shipModeNo: number;
    contactPerson: string;
    saleIncharge: string;
}

interface AllocationLineSource {
    [key: string]: unknown;
    lineKey: string;
    no: number;
    itemGroup: string;
    itemCategory: string;
    sapDescription: string;
    manufacturer: string;
    mfgPartNumber: string;
    supplierOrderCode: string;
    ggCode: string;
    qty: number;
    uom: string;
    unitPrice: number;
    amount: number;
    currency: string;
    countryOfOrigin: string;
    hsCode: string;
    docFee: DocumentFees;
    deliveryLeadTime: string;
    orderTerm: string;
    location: string;
    subLocation: string;
    importPermit: string;
    shelfLifeRequire: string;
    itemWeightPerEach: number | null;
    dimensionWeightPerEach: number | null;
    shippingWeightPerEach: number | null;
    totalShippingWeight: number | null;
    importDutyPercent: number;
    vendorCode: string;
    vendorName: string;
    termId: number | null;
    itemCode: string;
    purchaseUOM: string;
    stockUOM: string;
    saleUOM: string;
    stockConversion: number;
    saleConversion: number;
    moq: number | null;
    insPercent: number;
    shipModeNo: number;
    freightRate: number;
    dimUnit: number;
    length: number;
    width: number;
    height: number;
    zoneRate: number;
    etPercent: number;
    miscTax: number;
    scc: number;
    stkPercent: number;
    markupPercent: number;
    sspk: number;
    qoc: number;
}

type AllocationWarningCode =
    | 'MISSING_WEIGHT'
    | 'MISSING_AMOUNT'
    | 'ZERO_QTY'
    | 'MIXED_VENDOR'
    | 'MIXED_CURRENCY'
    | 'NEGATIVE_COST'
    | 'ROUNDING_RESIDUAL';

interface AllocationWarning {
    code: AllocationWarningCode;
    message: string;
    severity: 'warning' | 'error';
    field?: string;
}

interface FinalResultColumns {
    supplierName: string;
    purchaseOrderTerm: string;
    termLocation: string;
    productCost: number;
    pkh: number;
    soc: number;
    docCOC: number;
    docMill: number;
    docTestCert: number;
    docCOO: number;
    docAnyOther: number;
    docFees: number;
    currency: string;
    rateExchange: number;
    shipWeightCal: number;
    insPercent: number;
    importDutyPercent: number;
    purchaseUOM: string;
    stockUOM: string;
    saleUOM: string;
    stockConversion: number;
    saleConversion: number;
    purchaseMOQ: number | null;
    wireTT: number;
    customClear: number;
    op1Source: number;
    op1: number;
    exworkCase: number;
    op2: number;
    dimWeight: number;
    ins: number;
    frQTEC: number;
    frZoneRate: number;
    frZoneCost: number;
    cifQTEC: number;
    cifZone: number;
    dtQTEC: number;
    dtZone: number;
    selectedDuty: number;
    ttFinal: number;
    ccFinal: number;
    et: number;
    mt: number;
    miscTaxVal: number;
    scc: number;
    preQLC: number;
    stk: number;
    qlc: number;
    qlc2: number;
    spk: number;
    qocVal: number;
    totalQLC: number;
    markup: number;
    roundUp: number;
    vatPercent: number;
    vatAmount: number;
    roundUpWithVat: number;
}

interface AllocationLineResult {
    lineKey: string;
    weightRatioPerItem: number;
    weightRatioPerEach: number;
    valueRatioPerItem: number;
    valueRatioPerEach: number;
    pkhPerEach: number;
    pkhPerItem: number;
    socPerEach: number;
    socPerItem: number;
    freightPerEach: number;
    freightPerItem: number;
    wireTTPerEach: number;
    wireTTPerItem: number;
    ccPerEach: number;
    ccPerItem: number;
    finalResult: FinalResultColumns;
    warnings: AllocationWarning[];
    status: 'ready' | 'warning' | 'error';
}

export interface AllocationPreview {
    previewedAt: string;
    vendorCode: string;
    vendorName: string;
    totalLines: number;
    totalQty: number;
    totalAmount: number;
    totalWeight: number;
    weightAvailable: number;
    weightMissing: number;
    excludedLineCount: number;
    lines: AllocationLineResult[];
    runWarnings: AllocationWarning[];
    roundingResidual: {
        pkh: number;
        soc: number;
        freight: number;
        customs: number;
        wireTT: number;
    };
}

export interface BulkCostCalculationInput {
    costs: Record<string, unknown>;
    lines: Record<string, unknown>[];
}

export function normalizeBulkCostInput(raw: Record<string, unknown>): BulkCostInput {
    return normalizeCosts(raw);
}

export function normalizeAllocationLine(raw: Record<string, unknown>): AllocationLineSource {
    return normalizeLine(raw);
}

export function calculateBulkCostPreview(input: BulkCostCalculationInput): AllocationPreview;
export function calculateBulkCostPreview(
    lines: Record<string, unknown>[],
    costs: Record<string, unknown>,
): AllocationPreview;
export function calculateBulkCostPreview(
    inputOrLines: BulkCostCalculationInput | Record<string, unknown>[],
    maybeCosts?: Record<string, unknown>,
): AllocationPreview {
    const input = Array.isArray(inputOrLines)
        ? { lines: inputOrLines, costs: maybeCosts ?? {} }
        : inputOrLines;
    const costs = normalizeCosts(input.costs);
    const allLines = input.lines.map(normalizeLine);
    const lines = allLines.filter(isIncludedLine);
    const excludedLineCount = allLines.length - lines.length;
    const runWarnings: AllocationWarning[] = [];

    if (lines.length === 0) {
        runWarnings.push({
            code: 'ZERO_QTY',
            message: 'No lines selected for allocation.',
            severity: 'error',
        });
    }

    const vendors = new Set(lines.map((line) => line.vendorCode).filter(Boolean));
    if (vendors.size > 1) {
        runWarnings.push({
            code: 'MIXED_VENDOR',
            message: `Multiple vendors detected (${[...vendors].join(', ')}). Allocation should use a single vendor.`,
            severity: 'error',
        });
    }

    const currencies = new Set(lines.map((line) => line.currency).filter(Boolean));
    if (currencies.size > 1) {
        runWarnings.push({
            code: 'MIXED_CURRENCY',
            message: `Multiple currencies detected (${[...currencies].join(', ')}). Allocation should use a single currency.`,
            severity: 'error',
        });
    }

    for (const field of ['pkh', 'soc', 'freight', 'customs', 'wireTT'] as const) {
        if (costs[field] < 0) {
            runWarnings.push({
                code: 'NEGATIVE_COST',
                message: `${field} has a negative value (${costs[field]}).`,
                severity: 'warning',
                field,
            });
        }
    }

    let totalWeight = 0;
    let totalAmount = 0;
    let totalQty = 0;
    let weightAvailable = 0;
    let weightMissing = 0;

    for (const line of lines) {
        const weight = resolveWeight(line);
        if (weight !== null && weight > 0) {
            totalWeight += weight * line.qty;
            weightAvailable += 1;
        } else {
            weightMissing += 1;
        }
        totalAmount += line.amount;
        totalQty += line.qty;
    }

    const results: AllocationLineResult[] = [];
    let allocPKH = 0;
    let allocSOC = 0;
    let allocFreight = 0;
    let allocCC = 0;
    let allocTT = 0;

    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        const warnings: AllocationWarning[] = [];
        const isLast = i === lines.length - 1;
        const weight = resolveWeight(line);
        const lineWeight = weight !== null && weight > 0 ? weight * line.qty : 0;

        const weightRatioPerItem = totalWeight > 0 ? lineWeight / totalWeight : 0;
        const weightRatioPerEach = line.qty > 0 ? weightRatioPerItem / line.qty : 0;
        const valueRatioPerItem = totalAmount > 0 ? line.amount / totalAmount : 0;
        const valueRatioPerEach = line.qty > 0 ? valueRatioPerItem / line.qty : 0;

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

        const pkhItem = isLast ? costs.pkh - allocPKH : round6(costs.pkh * weightRatioPerItem);
        const socItem = isLast ? costs.soc - allocSOC : round6(costs.soc * weightRatioPerItem);
        const freightItem = isLast ? costs.freight - allocFreight : round6(costs.freight * weightRatioPerItem);
        const ccItem = isLast ? costs.customs - allocCC : round6(costs.customs * weightRatioPerItem);
        const ttItem = isLast ? costs.wireTT - allocTT : round6(costs.wireTT * valueRatioPerItem);

        allocPKH += pkhItem;
        allocSOC += socItem;
        allocFreight += freightItem;
        allocCC += ccItem;
        allocTT += ttItem;

        const safeQty = line.qty > 0 ? line.qty : 1;
        const pkhEach = round6(pkhItem / safeQty);
        const socEach = round6(socItem / safeQty);
        const freightEach = round6(freightItem / safeQty);
        const ccEach = round6(ccItem / safeQty);
        const ttEach = round6(ttItem / safeQty);
        const finalResult = computeFinalResult(line, costs, pkhEach, socEach, freightEach, ccEach, ttEach);
        const status: AllocationLineResult['status'] = warnings.some((warning) => warning.severity === 'error')
            ? 'error'
            : warnings.length > 0 ? 'warning' : 'ready';

        results.push({
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

    const residual = {
        pkh: round6(costs.pkh - allocPKH),
        soc: round6(costs.soc - allocSOC),
        freight: round6(costs.freight - allocFreight),
        customs: round6(costs.customs - allocCC),
        wireTT: round6(costs.wireTT - allocTT),
    };

    if (Object.values(residual).some((value) => Math.abs(value) > 0.001)) {
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
        excludedLineCount,
        lines: results,
        runWarnings,
        roundingResidual: residual,
    };
}

export function buildAuthoritativeBulkCostDraft(input: SaveBulkCostRunInput): SaveBulkCostRunInput {
    const sourceLines = input.lines.length > 0
        ? input.lines.map((line) => line.latest)
        : input.latestLines;
    const preview = calculateBulkCostPreview({
        costs: input.costs,
        lines: sourceLines,
    });
    const resultByLineKey = new Map(preview.lines.map((line) => [line.lineKey, line]));
    const originalLineByKey = new Map(input.lines.map((line) => [line.lineKey, line]));

    return {
        ...input,
        preview: preview as unknown as Record<string, unknown>,
        lines: sourceLines
            .map(normalizeLine)
            .filter(isIncludedLine)
            .map((latest) => {
                const original = originalLineByKey.get(latest.lineKey);
                return {
                    lineKey: latest.lineKey,
                    origin: original?.origin ?? null,
                    latest: latest as unknown as Record<string, unknown>,
                    result: resultByLineKey.get(latest.lineKey) as unknown as Record<string, unknown>,
                    axon: original?.axon,
                };
            }),
    };
}

export function assertBulkCostPreviewHasNoCalculationErrors(preview: AllocationPreview): void {
    const runError = preview.runWarnings.find((warning) => warning.severity === 'error');
    const lineError = preview.lines
        .flatMap((line) => line.warnings.map((warning) => ({ lineKey: line.lineKey, warning })))
        .find(({ warning }) => warning.severity === 'error');

    if (!runError && !lineError) return;

    const message = runError
        ? runError.message
        : `${lineError?.lineKey}: ${lineError?.warning.message}`;
    const err = new Error(message) as Error & { statusCode?: number };
    err.statusCode = 400;
    throw err;
}

function computeFinalResult(
    line: AllocationLineSource,
    costs: BulkCostInput,
    pkhEach: number,
    socEach: number,
    freightEach: number,
    ccEach: number,
    ttEach: number,
): FinalResultColumns {
    const docCOO = round6(line.docFee.coo + line.docFee.coa);
    const docFeeTotal = round6(
        line.docFee.coc + line.docFee.millCert + line.docFee.testCert + docCOO + line.docFee.anyOther,
    );
    const orderTerm = line.orderTerm || costs.orderTerm;
    const location = line.location || costs.location;
    const shipModeNo = line.shipModeNo || costs.shipModeNo;
    const calculated = calculate({
        productCost: line.unitPrice,
        pkh: pkhEach,
        soc: socEach,
        docFees: docFeeTotal,
        exchangeRate: costs.exchangeRate,
        orderTerm,
        shipModeNo,
        dimUnit: line.dimUnit,
        length: line.length,
        width: line.width,
        height: line.height,
        itemWeight: line.itemWeightPerEach ?? 0,
        freightRate: line.freightRate,
        freight: freightEach,
        insPercent: line.insPercent,
        zoneRate: line.zoneRate,
        dtPercent: line.importDutyPercent,
        miscTax: line.miscTax,
        etPercent: line.etPercent,
        wtt: ttEach,
        cc: ccEach,
        scc: line.scc,
        stkPercent: line.stkPercent,
        numInBuy: line.stockConversion,
        numInSale: line.saleConversion,
        markupPercent: line.markupPercent,
        sspk: line.sspk,
        qoc: line.qoc,
    });
    const exworkCase = calculated.U_OP_SUM !== 0 ? round6(calculated.U_OP_THB / calculated.U_OP_SUM) : 1;
    const vatPercent = numberValue(line.vatPercent);
    const vatAmount = vatPercent > 0 ? round6(calculated.U_SalesPrice * (vatPercent / 100)) : 0;

    return {
        supplierName: line.vendorName,
        purchaseOrderTerm: orderTerm,
        termLocation: location,
        productCost: line.unitPrice,
        pkh: pkhEach,
        soc: socEach,
        docCOC: line.docFee.coc,
        docMill: line.docFee.millCert,
        docTestCert: line.docFee.testCert,
        docCOO,
        docAnyOther: line.docFee.anyOther,
        docFees: docFeeTotal,
        currency: line.currency,
        rateExchange: costs.exchangeRate,
        shipWeightCal: calculated.U_ShipWeightCal,
        insPercent: line.insPercent,
        importDutyPercent: line.importDutyPercent,
        purchaseUOM: line.purchaseUOM,
        stockUOM: line.stockUOM,
        saleUOM: line.saleUOM,
        stockConversion: line.stockConversion,
        saleConversion: line.saleConversion,
        purchaseMOQ: line.moq,
        wireTT: ttEach,
        customClear: ccEach,
        op1Source: calculated.U_OP,
        op1: calculated.U_OP_SUM,
        exworkCase,
        op2: calculated.U_OP_THB,
        dimWeight: calculated.U_DimWeight,
        ins: calculated.U_INS,
        frQTEC: freightEach,
        frZoneRate: line.zoneRate,
        frZoneCost: calculated.U_FRZONE,
        cifQTEC: calculated.U_CIF,
        cifZone: calculated.U_CIFZONE,
        dtQTEC: calculated.U_DT_FR,
        dtZone: calculated.U_DT_FRZONE,
        selectedDuty: calculated.U_DT,
        ttFinal: ttEach,
        ccFinal: ccEach,
        et: calculated.U_ET,
        mt: calculated.U_MT,
        miscTaxVal: line.miscTax,
        scc: line.scc,
        preQLC: calculated.U_preQLC,
        stk: calculated.U_STK,
        qlc: calculated.U_QLC,
        qlc2: calculated.U_QLC2,
        spk: line.sspk,
        qocVal: line.qoc,
        totalQLC: calculated.U_TotalPrice,
        markup: calculated.U_MK_THB,
        roundUp: calculated.U_SalesPrice,
        vatPercent,
        vatAmount,
        roundUpWithVat: round6(calculated.U_SalesPrice + vatAmount),
    };
}

function normalizeCosts(raw: Record<string, unknown>): BulkCostInput {
    return {
        pkh: numberValue(raw.pkh),
        soc: numberValue(raw.soc),
        freight: numberValue(raw.freight),
        customs: numberValue(raw.customs),
        wireTT: numberValue(raw.wireTT),
        currency: text(raw.currency) || 'THB',
        exchangeRate: numberValue(raw.exchangeRate, 1),
        referenceNo: text(raw.referenceNo),
        remark: text(raw.remark),
        orderTerm: text(raw.orderTerm),
        location: text(raw.location),
        subLocation: text(raw.subLocation),
        shipModeNo: intValue(raw.shipModeNo, -1),
        contactPerson: text(raw.contactPerson),
        saleIncharge: text(raw.saleIncharge),
    };
}

function normalizeLine(raw: Record<string, unknown>): AllocationLineSource {
    const docFee = asRecord(raw.docFee);
    return {
        ...raw,
        lineKey: text(raw.lineKey) || `LINE-${text(raw.no)}`,
        no: intValue(raw.no, 0),
        itemGroup: text(raw.itemGroup),
        itemCategory: text(raw.itemCategory),
        sapDescription: text(raw.sapDescription),
        manufacturer: text(raw.manufacturer),
        mfgPartNumber: text(raw.mfgPartNumber),
        supplierOrderCode: text(raw.supplierOrderCode),
        ggCode: text(raw.ggCode),
        qty: numberValue(raw.qty),
        uom: text(raw.uom),
        unitPrice: numberValue(raw.unitPrice),
        amount: numberValue(raw.amount),
        currency: text(raw.currency) || 'THB',
        countryOfOrigin: text(raw.countryOfOrigin),
        hsCode: text(raw.hsCode),
        docFee: {
            coc: numberValue(docFee.coc),
            millCert: numberValue(docFee.millCert),
            testCert: numberValue(docFee.testCert),
            coa: numberValue(docFee.coa),
            coo: numberValue(docFee.coo),
            anyOther: numberValue(docFee.anyOther),
        },
        deliveryLeadTime: text(raw.deliveryLeadTime),
        orderTerm: text(raw.orderTerm),
        location: text(raw.location),
        subLocation: text(raw.subLocation),
        importPermit: text(raw.importPermit),
        shelfLifeRequire: text(raw.shelfLifeRequire),
        itemWeightPerEach: nullableNumber(raw.itemWeightPerEach),
        dimensionWeightPerEach: nullableNumber(raw.dimensionWeightPerEach),
        shippingWeightPerEach: nullableNumber(raw.shippingWeightPerEach),
        totalShippingWeight: nullableNumber(raw.totalShippingWeight),
        importDutyPercent: numberValue(raw.importDutyPercent),
        vendorCode: text(raw.vendorCode),
        vendorName: text(raw.vendorName),
        termId: nullableNumber(raw.termId),
        itemCode: text(raw.itemCode),
        purchaseUOM: text(raw.purchaseUOM) || text(raw.uom),
        stockUOM: text(raw.stockUOM) || text(raw.uom),
        saleUOM: text(raw.saleUOM) || text(raw.uom),
        stockConversion: numberValue(raw.stockConversion, 1),
        saleConversion: numberValue(raw.saleConversion, 1),
        moq: nullableNumber(raw.moq),
        insPercent: numberValue(raw.insPercent),
        shipModeNo: intValue(raw.shipModeNo, -1),
        freightRate: numberValue(raw.freightRate),
        dimUnit: intValue(raw.dimUnit, 1),
        length: numberValue(raw.length),
        width: numberValue(raw.width),
        height: numberValue(raw.height),
        zoneRate: numberValue(raw.zoneRate),
        etPercent: numberValue(raw.etPercent),
        miscTax: numberValue(raw.miscTax),
        scc: numberValue(raw.scc),
        stkPercent: numberValue(raw.stkPercent),
        markupPercent: numberValue(raw.markupPercent),
        sspk: numberValue(raw.sspk),
        qoc: numberValue(raw.qoc),
    };
}

function resolveWeight(line: AllocationLineSource): number | null {
    if (line.shippingWeightPerEach !== null && line.shippingWeightPerEach > 0) return line.shippingWeightPerEach;
    if (line.dimensionWeightPerEach !== null && line.dimensionWeightPerEach > 0) return line.dimensionWeightPerEach;
    if (line.itemWeightPerEach !== null && line.itemWeightPerEach > 0) return line.itemWeightPerEach;
    return null;
}

function isIncludedLine(line: AllocationLineSource): boolean {
    if (line.excludeFromCalculation === true) return false;
    for (const key of ['included', 'isIncluded', 'includeInCalculation', 'selected']) {
        if (line[key] === false) return false;
    }
    return true;
}

function lineLabel(line: AllocationLineSource): string {
    return line.itemCode || line.supplierOrderCode || `line ${line.no}`;
}

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
}

function text(value: unknown): string {
    if (value === null || value === undefined) return '';
    return String(value).trim();
}

function numberValue(value: unknown, fallback = 0): number {
    if (value === null || value === undefined || value === '') return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function nullableNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function intValue(value: unknown, fallback: number): number {
    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : fallback;
}

function round6(value: number): number {
    return Math.round(value * 1000000) / 1000000;
}
