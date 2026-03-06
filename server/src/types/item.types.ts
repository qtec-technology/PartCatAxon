// ─── Item Master (@POITM) ───────────────────────────────────────────────────

export interface Item {
    ItemID: number;
    ItemCode: string | null;
    ItemGroup: number | null;
    B1ItemNo: string | null;
    BPStockItemNo: string | null;
    U_Calalogno: string | null;
    U_Brand: string | null;
    ItemDescription: string | null;
    SAPB1Desc: string | null;
    VatGroupPu: string | null;
    VatGourpSa: string | null;
    U_CountryOrg: string | null;
    U_ECCN: string | null;
    U_UNSPSC: string | null;
    U_Punchout: string | null;
    U_VMI: string | null;
    U_CustBPA: string | null;
    U_IsQTECSTock: string | null;
    U_B1Item: string | null;
    U_Serialreq: string | null;
    U_MSDS: string | null;
    U_Certificate: string | null;
    U_Ecommerce: string | null;
    U_Permitreq: string | null;
    U_PermitType: string | null;
    U_DG_Required: string | null;
    U_HScode: string | null;
    InvntryUom: string | null;
    LongDesc1: string | null;
    LongDesc2: string | null;
    LongDesc3: string | null;
    LongDesc4: string | null;
    U_EpoCode: string | null;
    LeadTime: string | null;
    U_Remark: string | null;
    Updatedby: string | null;
    UpdatedDate: Date | null;
    SaleSubLocation: string | null;
    Active: boolean | null;
    RowVer: number | null;
    ItemCategory: string | null;
    SpecialRequirement: string | null;
    MasterFG: string | null;
    LastAwardedSO: number | null;
    TariffCode: string | null;
    TariffDescription: string | null;
    CustomsDuty: string | null;
    GeneralSpec?: string | null;
    GeneralSpecUrl?: string | null;
}

// ─── Item Create DTO ────────────────────────────────────────────────────────

export interface CreateItemDTO {
    ItemGroup: number;
    U_Brand: string;
    U_Calalogno: string;
    ItemDescription: string;
    InvntryUom: string;
    U_CountryOrg?: string;
    BPStockItemNo?: string;
    B1ItemNo?: string;
    SAPB1Desc?: string;
    VatGroupPu?: string;
    VatGourpSa?: string;
    LongDesc1?: string;
    LongDesc2?: string;
    LongDesc3?: string;
    LongDesc4?: string;
    U_ECCN?: string;
    U_UNSPSC?: string;
    U_EpoCode?: string;
    U_HScode?: string;
    U_Remark?: string;
    LeadTime?: string;
    SaleSubLocation?: string;
    ItemCategory?: string;
    SpecialRequirement?: string;
    GeneralSpec?: string;
    GeneralSpecUrl?: string;
    // Checkbox flags (stored as "Y"/"N")
    U_Punchout?: string;
    U_VMI?: string;
    U_CustBPA?: string;
    U_IsQTECSTock?: string;
    U_B1Item?: string;
    U_Serialreq?: string;
    U_MSDS?: string;
    U_Certificate?: string;
    U_Ecommerce?: string;
    U_DG_Required?: string;
    U_Permitreq?: string;
    U_PermitType?: string;
    Active?: boolean | string;
    MasterFG?: boolean | string;
}

// ─── Item Detail (for Term header) ──────────────────────────────────────────

export interface ItemDetail {
    ItemID: number;
    ItemCode: string;
    U_Brand: string;
    U_Calalogno: string;
    ItemDescription: string;
    LongDesc1: string | null;
    InvntryUom: string;
}
