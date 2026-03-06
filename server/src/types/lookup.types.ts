// ─── Lookup Types (Dropdown data) ───────────────────────────────────────────

export interface BrandOption {
    Code: string;
    Name?: string;
    U_Brand?: string; // Made optional just in case, or required if always present
}

export interface ItemGroupOption {
    ItemGroupCode: number;
    ItemGroupName: string;
}

export interface UOMOption {
    Code: string;
    Name: string;
}

export interface CurrencyOption {
    Code: string;
    Name: string;
    U_ExRate: number;
}

export interface OrderTermOption {
    Code: string;
    Name: string;
}

export interface LocationOption {
    Code: string;
    Name: string;
    Priority: number;
    ZoneName: string | null;
    ZoneRate: number | null;
}

export interface SubLocationOption {
    Code: number;
    Module: string;
    Country: string;
    Name: string;
    Priority: number;
}

export interface PermitTypeOption {
    Code: string;
    Name: string;
}

export interface VendorOption {
    CardCode: string;
    CardName: string;
    validFor: string;
}

export interface VendorBrandFormVendorOption {
    CardCode: string;
    CardName: string;
}

export interface ContactOption {
    CntctCode: number;
    CardCode: string;
    Name: string;
    Active: string;
}

export interface FreightOption {
    Code: string;
    Name: string;
    U_Rate: number;
}

export interface SalesPersonOption {
    SlpCode: number;
    SlpName: string;
    Active: string;
}

export interface CountryOption {
    Code: string;
    Name: string;
}

export interface ItemCategoryOption {
    Code: string;
    Name: string;
}

export interface CategoryBrandOption {
    ItemCategory: string;
    U_Brand: string;
}

export interface AttachmentRecord {
    AttachmentID: number;
    CatID: string;
    ParentID: number;
    Category: string;
    Attachement: string;   // note: original DB column spelling
    Updatedby: string;
    UpdatedDate: Date;
}
