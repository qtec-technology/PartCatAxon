import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CreateItemDTO } from '#src/types/item.types.js';

const dbMock = vi.hoisted(() => ({
    query: vi.fn(),
    queryOne: vi.fn(),
    execSP: vi.fn(),
}));

vi.mock('#src/config/database.js', () => ({
    query: dbMock.query,
    queryOne: dbMock.queryOne,
    execSP: dbMock.execSP,
    sql: {
        Int: 'Int',
        NVarChar: 'NVarChar',
    },
}));

vi.mock('#src/config/db-objects.js', () => ({
    dbObjects: {
        tables: {
            sap: {
                poitm: '[SAP].[dbo].[@POITM]',
                pitm1: '[SAP].[dbo].[@PITM1]',
                attachment: '[SAP].[dbo].[@tblAttachment]',
            },
        },
        views: {
            sap: {
                poitm: '[SAP].[dbo].[VWIT_@POITM]',
            },
            qtec: {
                pitm1: '[QTEC].[dbo].[vw@PITM1]',
            },
        },
        procedures: {
            getItemDetailByItemId: 'SPIT_GetItemDetailByItemID',
            generateCatalogNo: 'SPIT_GenCatalogNo',
            checkDuplicatedByCatalogNo: 'SPIT_CheckDuplicatedByCatalogNo',
            getInvntryUomByItemId: 'SPIT_GetInvntryUomByItemID',
        },
    },
}));

const { createItem, updateItem } = await import('#src/repositories/item.repository.js');

function makeCreateItem(overrides: Partial<CreateItemDTO> = {}): CreateItemDTO {
    return {
        ItemGroup: 104,
        U_Brand: 'PROTO',
        U_Calalogno: 'PN-001',
        ItemDescription: 'Test item',
        InvntryUom: 'EA',
        ...overrides,
    };
}

describe('item.repository B1ItemNo persistence', () => {
    beforeEach(() => {
        dbMock.queryOne.mockReset();
        dbMock.queryOne.mockResolvedValue({ ItemID: 123, RowsAffected: 1 });
    });

    it('inserts SQL null when B1ItemNo is null or blank on new item', async () => {
        await createItem(makeCreateItem({ B1ItemNo: null }), 'Kittipat');
        expect(dbMock.queryOne.mock.calls[0][1].B1ItemNo).toBeNull();

        await createItem(makeCreateItem({ B1ItemNo: '   ' }), 'Kittipat');
        expect(dbMock.queryOne.mock.calls[1][1].B1ItemNo).toBeNull();
    });

    it('updates B1ItemNo to SQL null when the field is cleared', async () => {
        await updateItem(123, { B1ItemNo: null }, 'Kittipat');

        expect(dbMock.queryOne.mock.calls[0][1]).toMatchObject({
            ItemID: 123,
            B1ItemNo: null,
        });
    });
});
