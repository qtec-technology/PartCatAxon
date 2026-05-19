import { describe, expect, it } from 'vitest';
import { buildCreateItemInsertSql, buildUpdateItemSql } from '#src/queries/domains/item/item.write.js';
import { buildCreateTermSql, buildUpdateTermSql } from '#src/queries/domains/term/term.write.js';

describe('UpdatedDate SQL writes', () => {
    it('uses SQL Server local GETDATE() for item inserts and updates', () => {
        const insertSql = buildCreateItemInsertSql('[dbo].[@POITM]');
        const updateSql = buildUpdateItemSql('[dbo].[@POITM]', ['Updatedby', 'UpdatedDate']);

        expect(insertSql).toContain('@Updatedby, GETDATE()');
        expect(insertSql).not.toContain('@UpdatedDate');
        expect(updateSql).toContain('[UpdatedDate] = GETDATE()');
        expect(updateSql).not.toContain('[UpdatedDate] = @UpdatedDate');
    });

    it('uses SQL Server local GETDATE() for term inserts and updates', () => {
        const insertSql = buildCreateTermSql('[dbo].[@PITM1]');
        const updateSql = buildUpdateTermSql('[dbo].[@PITM1]');

        expect(insertSql).toContain('@Updatedby, GETDATE()');
        expect(insertSql).not.toContain('@UpdatedDate');
        expect(updateSql).toContain('UpdatedDate = GETDATE()');
        expect(updateSql).not.toContain('UpdatedDate = @UpdatedDate');
    });
});
