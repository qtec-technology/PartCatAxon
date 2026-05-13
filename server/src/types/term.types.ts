// ─── Term / Pricing (@PITM1) ────────────────────────────────────────────────

export interface Term {
    TermID: number;
    ItemID: number;

    // Supplier
    VendorCode: string | null;
    VendorName: string | null;       // Joined from OCRD
    VendorStockItemNo: string | null;

    // Order Term & Location
    U_OrderTerm: string | null;
    U_TermLocation: string | null;
    SubLocation: string | null;

    // Cost Breakdown
    U_ProdCost: number | null;
    U_PurCurr: string | null;
    U_PurRate: number | null;
    U_PKH: number | null;
    U_SOC: number | null;

    // Order Price
    U_OP: number | null;
    U_OP_SUM: number | null;
    U_OP_THB: number | null;

    // Insurance & Freight
    U_INS: number | null;
    INS_Percent: number | null;
    U_FR: number | null;
    U_FRZONE: number | null;
    U_ZoneRate: number | null;

    // CIF
    U_CIF: number | null;
    U_CIFZONE: number | null;

    // Import Duty
    U_DT_Percent: number | null;
    U_DT: number | null;
    U_DT_FR: number | null;
    U_DT_FRZONE: number | null;

    // Excise Tax
    U_ETPer: number | null;
    U_ET: number | null;
    U_MT: number | null;
    U_MiscTax: number | null;

    // Dimension & Weight
    U_Length: number | null;
    U_Width: number | null;
    U_Height: number | null;
    U_DimWeight: number | null;
    U_Weight: number | null;
    U_DimUnitNo: number | null;
    U_DimUnit: string | null;

    // Freight Calculation
    U_FreightType: string | null;
    U_FreightRate: number | null;
    U_ShipWeightCal: number | null;
    U_FreightQTEC: number | null;
    U_ShipModeNo: number | null;
    U_ShipMode: string | null;

    // QLC Fields
    U_WTT: number | null;
    U_CC: number | null;
    U_ASP: number | null;       // Special Custom Clearance (DB column: U_ASP)
    U_STK_Percent: number | null;
    U_STK: number | null;
    U_preQLC: number | null;
    U_SPK: number | null;       // Special Packing (DB column: U_SPK)
    U_QOC: number | null;
    U_QLC: number | null;
    U_QLC2: number | null;      // QLC per Stock UOM
    U_QLC3: number | null;      // Legacy persisted Total Price (SPK + QOC)
    U_TotalPrice: number | null; // Compatibility alias of Total Price
    U_MK_Percent: number | null;
    U_MK_THB: number | null;
    U_SalesPrice: number | null;

    // Validity
    U_ValidFrom: Date | null;
    U_ValidTo: Date | null;

    // UOM
    BuyUnitMsr: string | null;
    NumInBuy: number | null;
    SalUnitMsr: string | null;
    NumInSale: number | null;

    // Additional
    U_MOQ: string | null;
    LeadTime: string | null;
    U_VendorBPA: string | null;
    CntctCode: number | null;
    CntctName: string | null;
    SlpCode: number | null;
    SlpName: string | null;
    SlpSprtCode: number | null;
    SlpSprtName: string | null;
    Updatedby: string | null;
    UpdatedDate: Date | null;
    U_SalesTerm: string | null;
    U_Remark: string | null;
    SaleSubLocation: string | null;
    Active: boolean | null;
    ContractNo: string | null;
    U_CWeight: number | null;
    LastAwardedSO: number | null;
}

// ─── Term Create DTO ────────────────────────────────────────────────────────

export interface CreateTermDTO {
    ItemID: number;
    VendorCode: string;
    VendorStockItemNo?: string;
    U_OrderTerm?: string;
    U_TermLocation?: string;
    SubLocation?: string;
    U_ProdCost: number;
    U_PurCurr: string;
    U_PurRate: number;
    U_PKH?: number;
    U_SOC?: number;
    U_ShipModeNo?: number;
    U_DimUnitNo?: number;
    U_Length?: number;
    U_Width?: number;
    U_Height?: number;
    U_Weight?: number;
    U_FreightType?: string;
    U_FreightRate?: number;
    U_FR?: number;
    INS_Percent?: number;
    U_ZoneRate?: number;
    U_DT_Percent?: number;
    U_ETPer?: number;
    U_MiscTax?: number;
    BuyUnitMsr?: string;
    NumInBuy?: number;
    SalUnitMsr?: string;
    NumInSale?: number;
    U_MOQ?: string;
    LeadTime?: string;
    U_VendorBPA?: string;
    CntctCode?: number;
    SlpCode?: number;
    SlpSprtCode?: number;
    U_ValidFrom?: Date;
    U_ValidTo?: Date;
    U_SalesTerm?: string;
    U_Remark?: string;
    SaleSubLocation?: string;
    Active?: boolean;
    ContractNo?: string;
    U_WTT?: number;
    U_CC?: number;
    U_ASP?: number;             // Special Custom Clearance
    U_STK_Percent?: number;
    U_MK_Percent?: number;
    U_SPK?: number;             // Special Packing
    U_QOC?: number;
    U_CWeight?: number;
}
