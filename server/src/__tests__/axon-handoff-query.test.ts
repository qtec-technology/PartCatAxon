import { describe, expect, it } from 'vitest';
import {
    buildLoadAxonComparisonHeaderSql,
    buildLoadAxonComparisonLinesSql,
} from '#src/queries/domains/axon-handoff/axon-handoff.read.js';

describe('AXON handoff read SQL', () => {
    it('loads comparison header by ChainId and optional revision', () => {
        const sql = buildLoadAxonComparisonHeaderSql('[AXON].[dbo].[vwFinalComparisonHeader]');

        expect(sql).toContain('FROM [AXON].[dbo].[vwFinalComparisonHeader]');
        expect(sql).toContain('[ChainId] = @ChainId');
        expect(sql).toContain('[SourceRfqId]');
        expect(sql).toContain('[Subject]');
        expect(sql).toContain('@ComparisonRevision IS NULL');
        expect(sql).toContain('ORDER BY [UpdatedAt] DESC, [ComparisonRevision] DESC');
    });

    it('loads comparison lines by ChainId and stable line ordering', () => {
        const sql = buildLoadAxonComparisonLinesSql('[AXON].[dbo].[vwFinalComparisonLines]');

        expect(sql).toContain('FROM [AXON].[dbo].[vwFinalComparisonLines]');
        expect(sql).toContain('[SupplierRfqOperationId]');
        expect(sql).toContain('[QuoteItemId]');
        expect(sql).toContain('[RfqLineId]');
        expect(sql).toContain('[AxonLineId]');
        expect(sql).toContain('[SourceRank]');
        expect(sql).toContain('[IsRecommendedSupplier]');
        expect(sql).toContain('[SupplierCode]');
        expect(sql).toContain('[QuotedQty]');
        expect(sql).toContain('[MatchMethod]');
        expect(sql).toContain('[SourceConfidence]');
        expect(sql).toContain('ORDER BY [SourceRank], [SupplierName], [LineNo], [AxonLineId]');
    });
});
