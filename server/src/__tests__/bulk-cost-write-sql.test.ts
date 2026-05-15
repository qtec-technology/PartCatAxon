import { describe, expect, it } from 'vitest';
import { buildCreateDraftTermSql } from '#src/queries/domains/bulk-cost/bulk-cost.write.js';

describe('Bulk Cost write SQL', () => {
    it('persists DraftTerm Valid From during save draft', () => {
        const sql = buildCreateDraftTermSql('[dbo].[DraftTerm]');

        expect(sql).toContain('[U_ValidFrom]');
        expect(sql).toContain('@U_ValidFrom');
    });
});
