import { describe, expect, it } from 'vitest';
import { extractHeaderCostSuggestions } from '#src/services/axon-payload.service.js';

describe('axon-payload.service', () => {
    it('extracts headerCosts from RawPayloadJson for Cost Bar suggestions', () => {
        const suggestions = extractHeaderCostSuggestions(JSON.stringify({
            quote: { currency: 'USD', purchaseTerm: 'EXW', termLocation: 'US' },
            headerCosts: {
                packingHandling: {
                    amount: 50,
                    currency: 'USD',
                    basis: 'HEADER_TOTAL',
                    sourceText: 'Packing & handling: USD 50',
                    confidence: 0.92,
                    needsReview: true,
                },
                supplierOutboundCost: {
                    amount: '120',
                    currency: 'USD',
                    basis: 'HEADER_TOTAL',
                    sourceText: 'Freight to forwarder: USD 120',
                    confidence: 0.88,
                },
                insurance: {
                    percent: 1.5,
                    basis: 'HEADER_TOTAL',
                    sourceText: 'Insurance 1.5%',
                    confidence: 0.7,
                },
                otherCharges: [
                    { amount: 20, currency: 'USD', basis: 'HEADER_TOTAL', sourceText: 'Bank fee USD 20', confidence: 0.6 },
                    { amount: null, confidence: 0 },
                ],
            },
        }));

        expect(suggestions).toMatchObject({
            packingHandling: {
                amount: 50,
                currency: 'USD',
                basis: 'HEADER_TOTAL',
                sourceText: 'Packing & handling: USD 50',
                confidence: 0.92,
                needsReview: true,
            },
            supplierOutboundCost: {
                amount: 120,
                currency: 'USD',
                basis: 'HEADER_TOTAL',
                sourceText: 'Freight to forwarder: USD 120',
                confidence: 0.88,
                needsReview: true,
            },
            insurance: {
                amount: null,
                percent: 1.5,
                basis: 'HEADER_TOTAL',
                sourceText: 'Insurance 1.5%',
                confidence: 0.7,
            },
        });
        expect(suggestions?.otherCharges).toHaveLength(1);
    });

    it('supports legacy supplierCosts names while AXON migrates to headerCosts', () => {
        const suggestions = extractHeaderCostSuggestions(JSON.stringify({
            supplierCosts: {
                pkhTotal: 10,
                socTotal: 20,
                freightTotal: 30,
                customClearTotal: 40,
                wireTTTotal: 50,
                insurancePercent: 1.25,
            },
        }));

        expect(suggestions).toMatchObject({
            packingHandling: { amount: 10, confidence: 0.5 },
            supplierOutboundCost: { amount: 20, confidence: 0.5 },
            freight: { amount: 30, confidence: 0.5 },
            customClearance: { amount: 40, confidence: 0.5 },
            wireTransferFee: { amount: 50, confidence: 0.5 },
            insurance: { amount: null, percent: 1.25, confidence: 0.5 },
        });
    });

    it('returns null for invalid or missing payloads', () => {
        expect(extractHeaderCostSuggestions(null)).toBeNull();
        expect(extractHeaderCostSuggestions('{bad json')).toBeNull();
        expect(extractHeaderCostSuggestions(JSON.stringify({ lines: [] }))).toBeNull();
    });
});
