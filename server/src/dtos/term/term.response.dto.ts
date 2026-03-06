import type { Term } from '#src/types/term.types.js';

export type TermsResponseDTO = Term[];
export type TermByIdResponseDTO = Term;

export interface TermMutationResponseDTO {
    TermID: number;
    [key: string]: unknown;
}

export interface VendorEmailResponseDTO {
    contactName: string | null;
    email: string | null;
    tel: string | null;
    mobile: string | null;
    catalogNo: string | null;
    itemDescription: string | null;
    brand: string | null;
    longDesc: string | null;
    /** Pre-built mailto: URL for RFQ email (null if no email address) */
    mailtoUrl: string | null;
}

export interface CWeightResponseDTO {
    cWeight: number;
}

export type TermItemDetailResponseDTO = Record<string, unknown>;

export interface MasterFGResponseDTO {
    masterFG: string | null;
}
