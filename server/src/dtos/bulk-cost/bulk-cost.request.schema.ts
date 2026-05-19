import { z } from 'zod';

const trimmedString = z.preprocess(
    (value) => (typeof value === 'string' ? value.trim() : value),
    z.string(),
);

const nonEmptyString = trimmedString.pipe(z.string().min(1, 'Required'));
const jsonObject = z.object({}).passthrough();

const axonHintsSchema = z.object({
    uniqueLineId: trimmedString.optional(),
    matchMethod: trimmedString.optional(),
    matchConfidence: z.number().finite().min(0).max(1).nullable().optional(),
}).strict();

const saveBulkCostDraftLineSchema = z.object({
    lineKey: nonEmptyString,
    origin: jsonObject.nullable(),
    latest: jsonObject,
    result: jsonObject,
    axon: axonHintsSchema.optional(),
}).strict();

const nullableShipModeNo = z.union([z.string(), z.number(), z.null()]).optional();

const cweightPrefillLineSchema = z.object({
    lineKey: nonEmptyString,
    latest: jsonObject,
    lockedByUser: z.boolean().optional().default(false),
}).strict();

export const bulkCostCWeightPrefillBodySchema = z.object({
    defaults: z.object({
        shipModeNo: nullableShipModeNo,
    }).strict().optional().default({}),
    lines: z.array(cweightPrefillLineSchema).min(1, 'lines must contain at least one line'),
}).strict();

export type BulkCostCWeightPrefillBodyDTO = z.infer<typeof bulkCostCWeightPrefillBodySchema>;

export const calculateBulkCostBodySchema = z.object({
    costs: jsonObject,
    lines: z.array(jsonObject).min(1, 'lines must contain at least one line'),
}).strict();

export type CalculateBulkCostBodyDTO = z.infer<typeof calculateBulkCostBodySchema>;

export const saveBulkCostRunBodySchema = z.object({
    sourceRunId: z.coerce.number().int().positive().optional(),
    supplierCode: nonEmptyString,
    supplierName: trimmedString.optional().default(''),
    status: z.literal('DRAFT').default('DRAFT'),
    costs: jsonObject,
    originLines: z.array(jsonObject).default([]),
    latestLines: z.array(jsonObject).min(1, 'latestLines must contain at least one line'),
    preview: jsonObject,
    lines: z.array(saveBulkCostDraftLineSchema).min(1, 'lines must contain at least one line'),
}).strict();

export type SaveBulkCostRunBodyDTO = z.infer<typeof saveBulkCostRunBodySchema>;

export const listBulkCostRunsQuerySchema = z.object({
    status: z.enum(['DRAFT', 'QUOTED', 'AWARDED', 'REVERSE_MAPPED', 'LOST', 'ARCHIVED']).optional(),
    search: trimmedString.optional(),
    saleIncharge: trimmedString.optional(),
    page: z.coerce.number().int().positive().optional().default(1),
    pageSize: z.coerce.number().int().positive().max(400).optional().default(400),
});

export type ListBulkCostRunsQueryDTO = z.infer<typeof listBulkCostRunsQuerySchema>;

export const updateBulkCostRunStatusBodySchema = z.object({
    status: z.enum(['AWARDED', 'LOST']),
}).strict();

export type UpdateBulkCostRunStatusBodyDTO = z.infer<typeof updateBulkCostRunStatusBodySchema>;
