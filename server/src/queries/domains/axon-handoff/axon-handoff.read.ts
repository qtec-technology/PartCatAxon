export function buildLoadAxonComparisonHeaderSql(headerViewName: string): string {
    return `
        SELECT TOP 1
            [ChainId],
            [ComparisonRevision],
            [SourceRfqId],
            [CustomerName],
            [CustomerReferenceNo],
            [Subject],
            [DocumentNo],
            [DocumentDate],
            [SupplierCode],
            [SupplierName],
            [Currency],
            [PurchaseTerm],
            [TermLocation],
            [QuoteStatus],
            [UpdatedAt]
        FROM ${headerViewName}
        WHERE [ChainId] = @ChainId
          AND (@ComparisonRevision IS NULL OR [ComparisonRevision] = @ComparisonRevision)
        ORDER BY [UpdatedAt] DESC, [ComparisonRevision] DESC
    `;
}

export function buildLoadAxonComparisonLinesSql(lineViewName: string): string {
    return `
        SELECT
            [ChainId],
            [ComparisonRevision],
            [SourceRfqId],
            [BrandGroupId],
            [SupplierRfqOperationId],
            [SupplierQuoteId],
            [QuoteItemId],
            [RfqLineId],
            [AxonLineId],
            [LineNo],
            [SourceRank],
            [IsRecommendedSupplier],
            [IsSelectedSupplier],
            [SupplierCode],
            [SupplierName],
            [QuotationNo],
            [QuoteDate],
            [PaymentTerms],
            [PurchaseTerm],
            [DeliveryTerms],
            [FreightType],
            [FreightAmount],
            [SupplierOrderCode],
            [MfrBrand],
            [MfrCatalogNo],
            [Description],
            [Qty],
            [Uom],
            [UnitPrice],
            [Currency],
            [QuotedQty],
            [QuotedUom],
            [RfqQty],
            [RfqUom],
            [Moq],
            [LotSize],
            [LeadTimeDays],
            [ItemWeightKg],
            [Length],
            [Width],
            [Height],
            [DimUnit],
            [ChargeableWeightKg],
            [HsCode],
            [DutyPercent],
            [PermitRequired],
            [ShelfLifeRequired],
            [MatchMethod],
            [MatchConfidence],
            [SourceConfidence],
            [SourceText]
        FROM ${lineViewName}
        WHERE [ChainId] = @ChainId
          AND (@ComparisonRevision IS NULL OR [ComparisonRevision] = @ComparisonRevision)
        ORDER BY [SourceRank], [SupplierName], [LineNo], [AxonLineId]
    `;
}
