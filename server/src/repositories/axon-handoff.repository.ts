import { getPool, sql } from '#src/config/database.js';
import { toSqlIdentifier } from '#src/utils/sql.js';
import {
    buildLoadAxonComparisonHeaderSql,
    buildLoadAxonComparisonLinesSql,
} from '#src/queries/domains/axon-handoff/axon-handoff.read.js';
import type {
    AxonComparison,
    AxonComparisonHeader,
    AxonComparisonLine,
    LoadAxonComparisonInput,
} from '#src/types/axon-handoff.types.js';

interface AxonComparisonHeaderRow {
    ChainId: string;
    ComparisonRevision: string | null;
    SourceRfqId: string | number | null;
    CustomerName: string | null;
    CustomerReferenceNo: string | null;
    Subject: string | null;
    DocumentNo: string | null;
    DocumentDate: Date | string | null;
    SupplierCode: string | null;
    SupplierName: string | null;
    Currency: string | null;
    PurchaseTerm: string | null;
    TermLocation: string | null;
    QuoteStatus: string | null;
    UpdatedAt: Date | string | null;
}

interface AxonComparisonLineRow {
    ChainId: string;
    ComparisonRevision: string | null;
    SourceRfqId: string | number | null;
    BrandGroupId: string | number | null;
    SupplierRfqOperationId: string | number | null;
    SupplierQuoteId: string | null;
    QuoteItemId: string | number | null;
    RfqLineId: string | number | null;
    AxonLineId: string;
    LineNo: number;
    SourceRank: number | null;
    IsRecommendedSupplier: boolean | number | null;
    IsSelectedSupplier: boolean | number | null;
    SupplierCode: string | null;
    SupplierName: string | null;
    QuotationNo: string | null;
    QuoteDate: Date | string | null;
    PaymentTerms: string | null;
    PurchaseTerm: string | null;
    DeliveryTerms: string | null;
    FreightType: string | null;
    FreightAmount: number | null;
    SupplierOrderCode: string | null;
    MfrBrand: string | null;
    MfrCatalogNo: string | null;
    Description: string | null;
    Qty: number | null;
    Uom: string | null;
    UnitPrice: number | null;
    Currency: string | null;
    QuotedQty: number | null;
    QuotedUom: string | null;
    RfqQty: number | null;
    RfqUom: string | null;
    Moq: number | null;
    LotSize: number | null;
    LeadTimeDays: number | null;
    ItemWeightKg: number | null;
    Length: number | null;
    Width: number | null;
    Height: number | null;
    DimUnit: string | null;
    ChargeableWeightKg: number | null;
    HsCode: string | null;
    DutyPercent: number | null;
    PermitRequired: boolean | number | null;
    ShelfLifeRequired: boolean | number | null;
    MatchMethod: string | null;
    MatchConfidence: number | null;
    SourceConfidence: number | null;
    SourceText: string | null;
}

function text(value: unknown): string {
    if (value === null || value === undefined) return '';
    return String(value).trim();
}

function nullableText(value: unknown): string | null {
    const normalized = text(value);
    return normalized ? normalized : null;
}

function nullableNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function nullableBoolean(value: unknown): boolean | null {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    const normalized = String(value).trim().toLowerCase();
    if (['true', 'yes', 'y', '1'].includes(normalized)) return true;
    if (['false', 'no', 'n', '0'].includes(normalized)) return false;
    return null;
}

function dateToIso(value: Date | string | null): string | null {
    if (value === null) return null;
    if (value instanceof Date) return value.toISOString();
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function qualifiedViewName(rawName: string | undefined): string | null {
    const normalized = String(rawName || '').trim();
    if (!normalized) return null;
    return normalized.split('.').map(toSqlIdentifier).join('.');
}

function requireViewNames(): { headerView: string; lineView: string } {
    const headerView = qualifiedViewName(process.env.DB_VIEW_AXON_FINAL_COMPARISON_HEADER);
    const lineView = qualifiedViewName(process.env.DB_VIEW_AXON_FINAL_COMPARISON_LINES);
    if (!headerView || !lineView) {
        const err = new Error(
            'AXON handoff views are not configured. Set DB_VIEW_AXON_FINAL_COMPARISON_HEADER and DB_VIEW_AXON_FINAL_COMPARISON_LINES after Pi-Jo confirms the view names.',
        ) as Error & { statusCode?: number };
        err.statusCode = 501;
        throw err;
    }
    return { headerView, lineView };
}

function toHeader(row: AxonComparisonHeaderRow): AxonComparisonHeader {
    return {
        chainId: text(row.ChainId),
        comparisonRevision: nullableText(row.ComparisonRevision),
        sourceRfqId: nullableText(row.SourceRfqId),
        customerName: nullableText(row.CustomerName),
        customerReferenceNo: nullableText(row.CustomerReferenceNo),
        subject: nullableText(row.Subject),
        documentNo: nullableText(row.DocumentNo),
        documentDate: dateToIso(row.DocumentDate),
        supplierCode: nullableText(row.SupplierCode),
        supplierName: nullableText(row.SupplierName),
        currency: nullableText(row.Currency),
        purchaseTerm: nullableText(row.PurchaseTerm),
        termLocation: nullableText(row.TermLocation),
        quoteStatus: nullableText(row.QuoteStatus),
        updatedAt: dateToIso(row.UpdatedAt),
    };
}

function toLine(row: AxonComparisonLineRow): AxonComparisonLine {
    return {
        chainId: text(row.ChainId),
        comparisonRevision: nullableText(row.ComparisonRevision),
        sourceRfqId: nullableText(row.SourceRfqId),
        brandGroupId: nullableText(row.BrandGroupId),
        supplierRfqOperationId: nullableText(row.SupplierRfqOperationId),
        supplierQuoteId: nullableText(row.SupplierQuoteId),
        quoteItemId: nullableText(row.QuoteItemId),
        rfqLineId: nullableText(row.RfqLineId),
        axonLineId: text(row.AxonLineId),
        lineNo: Number(row.LineNo),
        sourceRank: nullableNumber(row.SourceRank),
        isRecommendedSupplier: nullableBoolean(row.IsRecommendedSupplier),
        isSelectedSupplier: nullableBoolean(row.IsSelectedSupplier),
        supplierCode: nullableText(row.SupplierCode),
        supplierName: nullableText(row.SupplierName),
        quotationNo: nullableText(row.QuotationNo),
        quoteDate: dateToIso(row.QuoteDate),
        paymentTerms: nullableText(row.PaymentTerms),
        purchaseTerm: nullableText(row.PurchaseTerm),
        deliveryTerms: nullableText(row.DeliveryTerms),
        freightType: nullableText(row.FreightType),
        freightAmount: nullableNumber(row.FreightAmount),
        supplierOrderCode: nullableText(row.SupplierOrderCode),
        mfrBrand: nullableText(row.MfrBrand),
        mfrCatalogNo: nullableText(row.MfrCatalogNo),
        description: nullableText(row.Description),
        qty: nullableNumber(row.Qty),
        uom: nullableText(row.Uom),
        unitPrice: nullableNumber(row.UnitPrice),
        currency: nullableText(row.Currency),
        quotedQty: nullableNumber(row.QuotedQty),
        quotedUom: nullableText(row.QuotedUom),
        rfqQty: nullableNumber(row.RfqQty),
        rfqUom: nullableText(row.RfqUom),
        moq: nullableNumber(row.Moq),
        lotSize: nullableNumber(row.LotSize),
        leadTimeDays: nullableNumber(row.LeadTimeDays),
        itemWeightKg: nullableNumber(row.ItemWeightKg),
        length: nullableNumber(row.Length),
        width: nullableNumber(row.Width),
        height: nullableNumber(row.Height),
        dimUnit: nullableText(row.DimUnit),
        chargeableWeightKg: nullableNumber(row.ChargeableWeightKg),
        hsCode: nullableText(row.HsCode),
        dutyPercent: nullableNumber(row.DutyPercent),
        permitRequired: nullableBoolean(row.PermitRequired),
        shelfLifeRequired: nullableBoolean(row.ShelfLifeRequired),
        matchMethod: nullableText(row.MatchMethod),
        matchConfidence: nullableNumber(row.MatchConfidence),
        sourceConfidence: nullableNumber(row.SourceConfidence),
        sourceText: nullableText(row.SourceText),
    };
}

export async function loadAxonComparison(input: LoadAxonComparisonInput): Promise<AxonComparison | null> {
    const { headerView, lineView } = requireViewNames();
    const pool = await getPool();
    const requestedRevision = input.comparisonRevision ? input.comparisonRevision : null;

    const headerRequest = pool.request()
        .input('ChainId', sql.NVarChar(100), input.chainId)
        .input('ComparisonRevision', sql.NVarChar(100), requestedRevision);
    const headerResult = await headerRequest.query<AxonComparisonHeaderRow>(
        buildLoadAxonComparisonHeaderSql(headerView),
    );
    const header = headerResult.recordset[0] ? toHeader(headerResult.recordset[0]) : null;
    const resolvedRevision = requestedRevision ?? header?.comparisonRevision ?? null;

    const lineRequest = pool.request()
        .input('ChainId', sql.NVarChar(100), input.chainId)
        .input('ComparisonRevision', sql.NVarChar(100), resolvedRevision);

    const lineResult = await lineRequest.query<AxonComparisonLineRow>(
        buildLoadAxonComparisonLinesSql(lineView),
    );
    const lines = lineResult.recordset.map(toLine);
    if (!header && lines.length === 0) return null;

    return {
        chainId: input.chainId,
        comparisonRevision: resolvedRevision,
        header,
        lines,
    };
}
