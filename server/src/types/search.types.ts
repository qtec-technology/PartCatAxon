// ─── Search Types ───────────────────────────────────────────────────────────

export type SearchMode =
    | 'fts'              // Full-Text Search
    | 'catalogNo'        // Mfr Catalog No
    | 'customerStock'    // Customer Stock Code
    | 'itemCode'         // Item Code
    | 'sapB1ItemNo';     // SAP B1 Item No

export interface SearchRequest {
    mode: SearchMode;
    keyword: string;
    brand?: string;       // Filter by brand (Optional)
    exactMatch?: boolean; // true = exact, false = LIKE
    myItems?: boolean;    // Filter by current user
}

export interface FTSResult {
    ItemID: number;
    ItemCode: string;
    U_Brand: string;
    U_Calalogno: string;
    ItemDescription: string;
    LongDesc1: string | null;
    LongDesc2: string | null;
    LongDesc3: string | null;
    LongDesc4: string | null;
    InvntryUom: string | null;
    Updatedby: string | null;
    UpdatedDate: Date | null;
    RANK: number;
}

export interface AutoCompleteItem {
    U_Brand: string;
    U_Calalogno: string;
    ItemDescription: string;
}
