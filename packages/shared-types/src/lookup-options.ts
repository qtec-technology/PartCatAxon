// ─── Lookup/Dropdown option types — shared API contract ─────────────────────
// Source: server/src/types/lookup.types.ts

export interface LookupOption {
  code: string;
  name: string;
  [key: string]: unknown;
}

export interface CurrencyOption {
  Code: string;
  Name: string;
  U_ExRate: number;
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

export interface UOMOption {
  Code: string;
  Name: string;
}

export interface OrderTermOption {
  Code: string;
  Name: string;
}

export interface VendorOption {
  CardCode: string;
  CardName: string;
  validFor: string;
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

export interface PermitTypeOption {
  Code: string;
  Name: string;
}

export interface ItemGroupOption {
  ItemGroupCode: number;
  ItemGroupName: string;
}
