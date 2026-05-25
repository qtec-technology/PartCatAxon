import { describe, expect, it } from 'vitest';
import {
    buildCreateDraftItemSql,
    buildCreateDraftTermSql,
    buildCreateBulkCostRunSql,
    buildSetBulkCostRunRevisionGroupSql,
} from '#src/queries/domains/bulk-cost/bulk-cost.write.js';

describe('Bulk Cost write SQL', () => {
    it('persists run revision metadata during save revision', () => {
        const sql = buildCreateBulkCostRunSql('[dbo].[BulkCostRun]');

        expect(sql).toContain('[PreviewSnapshotJson]');
        expect(sql).toContain('[RevisionGroupID]');
        expect(sql).toContain('[RevisionNo]');
        expect(sql).toContain('[RevisionSourceRunID]');
    });

    it('backfills the first revision group to the inserted RunID', () => {
        const sql = buildSetBulkCostRunRevisionGroupSql('[dbo].[BulkCostRun]');

        expect(sql).toContain('SET [RevisionGroupID] = @RunID');
        expect(sql).toContain('WHERE [RunID] = @RunID');
        expect(sql).toContain('[RevisionGroupID] IS NULL');
    });

    it('persists draft item and draft term snapshots instead of legacy BulkCostLine writes', () => {
        const itemSql = buildCreateDraftItemSql('[dbo].[DraftItem]');
        const termSql = buildCreateDraftTermSql('[dbo].[DraftTerm]');

        expect(itemSql).toContain('[LatestSnapshotJson]');
        expect(itemSql).toContain('[OriginSnapshotJson]');
        expect(termSql).toContain('[U_OP]');
        expect(termSql).toContain('[SubLocation]');
        expect(termSql).toContain('@SubLocation');
        expect(termSql).toContain('[U_SalesTerm]');
        expect(termSql).toContain('@U_SalesTerm');
        expect(termSql).toContain('[SaleSubLocation]');
        expect(termSql).toContain('@SaleSubLocation');
        expect(termSql).toContain('[U_OP_SUM]');
        expect(termSql).toContain('[U_SalesPrice]');
        expect(termSql).toContain('[U_FRZONE]');
        expect(termSql).toContain('[U_CIFZONE]');
        expect(termSql).toContain('[U_DT_FR]');
        expect(termSql).toContain('[U_DT_FRZONE]');
        expect(termSql).toContain('[U_DimWeight]');
        expect(termSql).toContain('[U_QLC2]');
        expect(termSql).toContain('[U_QLC3]');
        expect(itemSql).not.toContain('BulkCostLine');
        expect(termSql).not.toContain('BulkCostLine');
        expect(itemSql).not.toContain('@POITM');
        expect(termSql).not.toContain('@PITM1');
    });
});
