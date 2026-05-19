export interface AxonComparisonHeader {
    chainId: string;
    comparisonRevision: string | null;
    sourceRfqId: string | null;
    customerName: string | null;
    customerReferenceNo: string | null;
    subject: string | null;
    documentNo: string | null;
    documentDate: string | null;
    supplierCode: string | null;
    supplierName: string | null;
    currency: string | null;
    purchaseTerm: string | null;
    termLocation: string | null;
    quoteStatus: string | null;
    updatedAt: string | null;
}

export interface AxonComparisonLine {
    chainId: string;
    comparisonRevision: string | null;
    sourceRfqId: string | null;
    brandGroupId: string | null;
    supplierRfqOperationId: string | null;
    supplierQuoteId: string | null;
    quoteItemId: string | null;
    rfqLineId: string | null;
    axonLineId: string;
    lineNo: number;
    sourceRank: number | null;
    isRecommendedSupplier: boolean | null;
    isSelectedSupplier: boolean | null;
    supplierCode: string | null;
    supplierName: string | null;
    quotationNo: string | null;
    quoteDate: string | null;
    paymentTerms: string | null;
    purchaseTerm: string | null;
    deliveryTerms: string | null;
    freightType: string | null;
    freightAmount: number | null;
    supplierOrderCode: string | null;
    mfrBrand: string | null;
    mfrCatalogNo: string | null;
    description: string | null;
    qty: number | null;
    uom: string | null;
    unitPrice: number | null;
    currency: string | null;
    quotedQty: number | null;
    quotedUom: string | null;
    rfqQty: number | null;
    rfqUom: string | null;
    moq: number | null;
    lotSize: number | null;
    leadTimeDays: number | null;
    itemWeightKg: number | null;
    length: number | null;
    width: number | null;
    height: number | null;
    dimUnit: string | null;
    chargeableWeightKg: number | null;
    hsCode: string | null;
    dutyPercent: number | null;
    permitRequired: boolean | null;
    shelfLifeRequired: boolean | null;
    matchMethod: string | null;
    matchConfidence: number | null;
    sourceConfidence: number | null;
    sourceText: string | null;
}

export interface AxonComparison {
    chainId: string;
    comparisonRevision: string | null;
    header: AxonComparisonHeader | null;
    lines: AxonComparisonLine[];
}

export interface LoadAxonComparisonInput {
    chainId: string;
    comparisonRevision?: string;
}
