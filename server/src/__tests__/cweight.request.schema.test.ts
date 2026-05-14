import { describe, expect, it } from 'vitest';
import { resolveCWeightBodySchema } from '#src/dtos/cweight/cweight.request.schema.js';

describe('resolveCWeightBodySchema', () => {
    it('accepts quotation-line CWeight lookup inputs', () => {
        const result = resolveCWeightBodySchema.safeParse({
            supplierOrderCode: ' 100G64 ',
            manufacturerPartNo: ' 1292G ',
            manufacturerName: ' LIBMAN ',
            itemWeightKg: '2.72',
            length: null,
            width: '',
            height: undefined,
            dimUnit: null,
            shipModeNo: '1',
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data).toMatchObject({
                supplierOrderCode: '100G64',
                manufacturerPartNo: '1292G',
                manufacturerName: 'LIBMAN',
                itemWeightKg: 2.72,
                length: null,
                width: null,
                dimUnit: null,
                shipModeNo: '1',
            });
        }
    });

    it('rejects unknown fields so other AI scopes do not leak into CWeight', () => {
        const result = resolveCWeightBodySchema.safeParse({
            supplierOrderCode: '100G64',
            hsCode: '7326908688',
        });

        expect(result.success).toBe(false);
    });
});
