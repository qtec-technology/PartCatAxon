import type { CreateTermDTO } from '#src/types/term.types.js';
import {
    asRecord,
    parseOptionalInt,
    parseString,
} from '#src/dtos/common/request-parsers.js';

export interface TermsQueryDTO {
    itemId: number | null;
}

export interface CWeightQueryDTO {
    vendorStockItemNo: string;
}

export interface TermIdParamDTO {
    termId: number | null;
}

export interface MasterFGParamsDTO {
    itemId: number | null;
}

export interface TermDeleteBodyDTO {
    confirmText: string;
    confirmTermId: number | null;
}

export type CreateTermBodyDTO = CreateTermDTO & Record<string, unknown>;
export type UpdateTermBodyDTO = Partial<CreateTermDTO> & Record<string, unknown>;
export type PreviewCalculationBodyDTO = Partial<CreateTermDTO> & Record<string, unknown>;

export function toTermsQueryDTO(query: unknown): TermsQueryDTO {
    const q = asRecord(query);
    return {
        itemId: parseOptionalInt(q.itemId),
    };
}

export function toCWeightQueryDTO(query: unknown): CWeightQueryDTO {
    const q = asRecord(query);
    return {
        vendorStockItemNo: String(q.vendorStockItemNo ?? '').trim(),
    };
}

export function toTermIdParamDTO(params: unknown): TermIdParamDTO {
    const p = asRecord(params);
    return {
        termId: parseOptionalInt(p.id),
    };
}

export function toMasterFGParamsDTO(params: unknown): MasterFGParamsDTO {
    const p = asRecord(params);
    return {
        itemId: parseOptionalInt(p.itemId),
    };
}

export function toTermDeleteBodyDTO(body: unknown): TermDeleteBodyDTO {
    const b = asRecord(body);
    return {
        confirmText: parseString(b.confirmText, ''),
        confirmTermId: parseOptionalInt(b.confirmTermId),
    };
}
