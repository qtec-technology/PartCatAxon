import { describe, expect, it } from 'vitest';
import { mapDraftTermFreightFields } from '#src/services/bulk-cost-draft-term.mapper.js';

describe('Bulk Cost DraftTerm mapper', () => {
    it('keeps U_FR as actual allocated freight and U_FreightQTEC as reference freight', () => {
        const result = mapDraftTermFreightFields({
            latest: { freightRate: 720 },
            finalResult: {
                frQTEC: 357668.5776,
                shipWeightCal: 52.21,
            },
        });

        expect(result.uFr).toBe(357668.5776);
        expect(result.uFreightQtec).toBe(37591.2);
    });

    it('uses zero fallbacks for missing freight reference inputs', () => {
        const result = mapDraftTermFreightFields({
            latest: {},
            finalResult: { frQTEC: 123 },
        });

        expect(result.uFr).toBe(123);
        expect(result.uFreightQtec).toBe(0);
    });
});
