export interface ItemData {
  id?: number;
  itemGroup: string;
  itemCategory: string;
  catalogNo: string;
  b1ItemNo: string;
  mfrBrand: string;
  mfrCatalogNo: string;
  itemDescription: string;
  specialRequirement: string;
  customerStockCode: string;
  stockUOM: string;
  countryOfOrigin: string;
  eccn: string;
  unspsc: string;
  eProcurementCode: string;
  remark: string;

  // Checkboxes
  active: boolean;
  masterFG: boolean;
  shelfLifeRequired: boolean; // Added based on image
  punchOut: boolean;
  vmi: boolean;
  customerBPA: boolean;
  isQTECStock: boolean;
  serialRequired: boolean;
  sdsRequired: boolean;
  certificateRequired: boolean;
  eCommerce: boolean;
  b1Item: boolean;
  dgRequired: boolean;
  permitRequired: boolean;
  permitType?: string;
  hsCode?: string;

  // Long Description
  longDesc1: string;
  longDesc2: string;
  longDesc3: string;
  longDesc4: string;

  // Footer
  generalSpec: string;
  referenceUrl: string;

  // Meta
  updatedBy: string;
  updatedDate: string;
  hasImage?: boolean;
}

export type FormMode = 'NEW' | 'VIEW' | 'EDIT';
