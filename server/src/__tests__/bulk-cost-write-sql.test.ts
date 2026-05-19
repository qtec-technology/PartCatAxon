import { describe, expect, it } from 'vitest';
import {
    buildCreateDraftItemSql,
    buildCreateDraftTermSql,
    buildCreateBulkCostRunSql,
} from '#src/queries/domains/bulk-cost/bulk-cost.write.js';

describe('Bulk Cost write SQL', () => {
    it('persists run revision metadata during save revision', () => {
        const sql = buildCreateBulkCostRunSql('[dbo].[BulkCostRun]');

        expect(sql).toContain('[PreviewSnapshotJson]');
        expect(sql).toContain('[RevisionGroupID]');
        expect(sql).toContain('[RevisionNo]');
        expect(sql).toContain('[RevisionSourceRunID]');
    });

    it('persists draft item and draft term snapshots instead of legacy BulkCostLine writes', () => {
        const itemSql = buildCreateDraftItemSql('[dbo].[DraftItem]');
        const termSql = buildCreateDraftTermSql('[dbo].[DraftTerm]');

        expect(itemSql).toContain('[LatestSnapshotJson]');
        expect(itemSql).toContain('[OriginSnapshotJson]');
        expect(termSql).toContain('[U_OP]');
        expect(termSql).toContain('[U_SalesPrice]');
        expect(itemSql).not.toContain('BulkCostLine');
        expect(termSql).not.toContain('BulkCostLine');
    });
});
