import { describe, expect, it } from 'vitest';
import {
    createItemBodySchema,
    updateItemBodySchema,
} from '#src/dtos/item/item.request.schema.js';

const baseCreatePayload = {
    ItemGroup: 104,
    U_Brand: 'PROTO',
    U_Calalogno: 'PN-001',
    ItemDescription: 'Test item',
    InvntryUom: 'EA',
};

describe('item request schemas', () => {
    it('accepts null B1ItemNo on create and preserves the field for repository null handling', () => {
        const parsed = createItemBodySchema.parse({
            ...baseCreatePayload,
            B1ItemNo: null,
        });

        expect(Object.prototype.hasOwnProperty.call(parsed, 'B1ItemNo')).toBe(true);
        expect(parsed.B1ItemNo).toBeUndefined();
    });

    it('accepts null B1ItemNo on update so users can clear the field', () => {
        const parsed = updateItemBodySchema.parse({ B1ItemNo: null });

        expect(Object.prototype.hasOwnProperty.call(parsed, 'B1ItemNo')).toBe(true);
        expect(parsed.B1ItemNo).toBeUndefined();
    });
});
