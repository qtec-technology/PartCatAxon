import { z } from 'zod';

const nullableTrimmedString = z.preprocess((value) => {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}, z.string().nullable()).optional();

const nullableFiniteNumber = z.preprocess((value) => {
    if (value === null || value === undefined || value === '') return null;
    return typeof value === 'number' ? value : Number(value);
}, z.number().finite().nullable()).optional();

const nullableDimUnit = z.union([z.string(), z.literal(1), z.literal(2), z.null()]).optional();
const nullableShipModeNo = z.union([z.string(), z.number(), z.null()]).optional();

export const resolveCWeightBodySchema = z.object({
    /** Grainger No — alternative name for supplierOrderCode; supplierOrderCode takes priority if both are supplied. */
    graingerNo: nullableTrimmedString,
    supplierOrderCode: nullableTrimmedString,
    manufacturerPartNo: nullableTrimmedString,
    manufacturerName: nullableTrimmedString,
    /** Product description for vector search fallback. */
    description: nullableTrimmedString,
    category1: nullableTrimmedString,
    category2: nullableTrimmedString,
    category3: nullableTrimmedString,
    itemWeightKg: nullableFiniteNumber,
    length: nullableFiniteNumber,
    width: nullableFiniteNumber,
    height: nullableFiniteNumber,
    dimUnit: nullableDimUnit,
    shipModeNo: nullableShipModeNo,
}).strict();

export type ResolveCWeightBodyDTO = z.infer<typeof resolveCWeightBodySchema>;
