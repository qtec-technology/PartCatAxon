export interface TermFormData {
    supplier: string;
    supplierName: string;
    contactPerson: string;
    contractNo: string;
    mfgPartNo: string;
    suppOrderCode: string;
    active: boolean;
    validFrom: string;
    validTo: string;
    purchaseTerm: string;
    purchaseTermLocation: string;
    purchaseSubLocation: string;
    salesTerm: string;
    salesSubLocation: string;
    incoterm: string;
    prodCost: number;
    pkh: number;
    soc: number;
    currency: string;
    exRate: number;
    shipMode: string;
    dimUnit: string;
    length: number;
    width: number;
    height: number;
    weight: number;
    cWeight: number;
    freightType: string;
    freightRate: number;
    fr: number;
    insPercent: number;
    dutyPercent: number;
    excisePercent: number;
    miscTax: number;
    numInBuy: number;
    numInSale: number;
    markup: number;
    stockFeePercent: number;
    wireTT: number;
    customClear: number;
    scc: number;
    zoneRate: number;
    salesPerson: string;
    sourcedBy: string;
    remark: string;
    leadTime: string;
    moq: string;
    vendorBPA: boolean;
    purchaseUOM: string;
    salesUOM: string;
    spk: number;
    qoc: number;
    updatedBy: string;
    updatedDate: string;
    stockUOM: string;
}

export interface TermCalculationPayload {
    U_ProdCost: number;
    U_PKH: number;
    U_SOC: number;
    U_PurRate: number;
    U_OrderTerm: string;
    U_ShipModeNo: number;
    U_DimUnitNo: number;
    U_Length: number;
    U_Width: number;
    U_Height: number;
    U_Weight: number;
    U_FreightRate: number;
    U_FR: number;
    INS_Percent: number;
    U_ZoneRate: number;
    U_DT_Percent: number;
    U_ETPer: number;
    U_MiscTax: number;
    U_WTT: number;
    U_CC: number;
    U_ASP: number;
    U_STK_Percent: number;
    U_SPK: number;
    U_QOC: number;
    U_MK_Percent: number;
    NumInBuy: number;
    NumInSale: number;
}

export interface TermCalculationResponse {
    U_OP: number;
    U_OP_SUM: number;
    U_OP_THB: number;
    U_DimWeight: number;
    U_ShipWeightCal: number;
    U_INS: number;
    U_FRZONE: number;
    U_FreightQTEC: number;
    U_CIF: number;
    U_CIFZONE: number;
    U_ZoneRate: number;
    U_DT: number;
    U_DT_FR: number;
    U_DT_FRZONE: number;
    U_ET: number;
    U_MT: number;
    U_preQLC: number;
    U_STK: number;
    U_QLC: number;
    U_QLC2: number;
    U_QLC3: number;
    U_TotalPrice: number;
    U_MK_THB: number;
    U_SalesPrice: number;
}

export interface TermCalcResults {
    OP1: number;
    OP1_THB: number;
    OP2_THB: number;
    DIM_WEIGHT: number;
    SHP_WEIGHT: number;
    INS: number;
    FR_QTEC: number;
    FR_ZONE: number;
    CIF: number;
    CIF_ZONE: number;
    DT: number;
    DT_ZONE: number;
    ET: number;
    MT: number;
    PRE_QLC: number;
    STK: number;
    QLC: number;
    QLC2: number;
    QLC3: number;
    TOTAL_PRICE: number;
    MK_THB: number;
    SALES_PRICE: number;
}

export interface TermStageStatus {
    OP1: boolean;
    FR: boolean;
    INS: boolean;
    CIF: boolean;
    DT: boolean;
    ET: boolean;
    MT: boolean;
    TERM: boolean;
    UOM: boolean;
    QLC: boolean;
}

export interface TermSupplierOption {
    code: string;
    name: string;
}

export interface TermLocationOption {
    code: string;
    name: string;
    priority: number;
    zoneName: string;
    zoneRate: number;
}

export interface TermCurrencyOption {
    code: string;
    name: string;
    exRate: number;
}

export interface TermFreightTypeOption {
    code: string;
    name: string;
    rate: number;
}

export interface TermAttachmentItem {
    id: string;
    category: string;
    fileName: string;
    updatedBy: string;
    updatedDate: string;
}

export interface CreateTermAttachmentInput {
    category: string;
    fileName: string;
    filePath?: string;
}

export interface TermPageDataState {
    itemCode: string;
    itemDesc: string;
    formData: TermFormData;
    attachments: TermAttachmentItem[];
    suppliers: TermSupplierOption[];
    contacts: string[];
    orderTerms: string[];
    locations: TermLocationOption[];
    subLocations: string[];
    currencies: TermCurrencyOption[];
    freightTypes: TermFreightTypeOption[];
    salesPersons: string[];
    uomOptions: Array<{ value: string; label: string }>;
}

export type UpdateTermFormData = <K extends keyof TermFormData>(field: K, value: TermFormData[K]) => void;

export const defaultTermFormData: TermFormData = {
    supplier: '',
    supplierName: '',
    contactPerson: '',
    contractNo: '',
    mfgPartNo: '',
    suppOrderCode: '',
    active: true,
    validFrom: '',
    validTo: '',
    purchaseTerm: '',
    purchaseTermLocation: '',
    purchaseSubLocation: '',
    salesTerm: '',
    salesSubLocation: '',
    incoterm: 'Incoterms 2020',
    prodCost: 0,
    pkh: 0,
    soc: 0,
    currency: '',
    exRate: 1,
    shipMode: '-1',
    dimUnit: '1',
    length: 0,
    width: 0,
    height: 0,
    weight: 0,
    cWeight: 0,
    freightType: '',
    freightRate: 0,
    fr: 0,
    insPercent: 1,
    dutyPercent: 0,
    excisePercent: 0,
    miscTax: 0,
    numInBuy: 1,
    numInSale: 1,
    markup: 0,
    stockFeePercent: 0,
    wireTT: 0,
    customClear: 0,
    scc: 0,
    zoneRate: 0,
    salesPerson: '',
    sourcedBy: '',
    remark: '',
    leadTime: '',
    moq: '',
    vendorBPA: false,
    purchaseUOM: '',
    salesUOM: '',
    spk: 0,
    qoc: 0,
    updatedBy: '',
    updatedDate: '',
    stockUOM: 'EA',
};

export const defaultTermCalcResults: TermCalcResults = {
    OP1: 0,
    OP1_THB: 0,
    OP2_THB: 0,
    DIM_WEIGHT: 0,
    SHP_WEIGHT: 0,
    INS: 0,
    FR_QTEC: 0,
    FR_ZONE: 0,
    CIF: 0,
    CIF_ZONE: 0,
    DT: 0,
    DT_ZONE: 0,
    ET: 0,
    MT: 0,
    PRE_QLC: 0,
    STK: 0,
    QLC: 0,
    QLC2: 0,
    QLC3: 0,
    TOTAL_PRICE: 0,
    MK_THB: 0,
    SALES_PRICE: 0,
};

export const defaultTermStageStatus: TermStageStatus = {
    OP1: false,
    FR: false,
    INS: false,
    CIF: false,
    DT: false,
    ET: false,
    MT: false,
    TERM: false,
    UOM: false,
    QLC: false,
};
