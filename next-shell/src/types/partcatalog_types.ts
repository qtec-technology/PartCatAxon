// Part Catalog Type Definitions

export interface PartItem {
  ItemID: number;
  ItemCode: string;
  B1ItemNo: string;
  U_Calalogno: string;
  BPStockItemNo: string;
  U_Brand: string;
  ItemDescription: string;
  InvntryUom: string;
  U_CountryOrg: string;
  Updatedby: string;
  UpdatedDate: string;
  Active: boolean;
  MasterFG: boolean;
  LastAwardedSO?: number;
  U_CustBPA?: boolean;
  U_VMI?: boolean;
  U_IsQTECSTock?: boolean;
  LongDesc1?: string;
  LongDesc2?: string;
  LongDesc3?: string;
  LongDesc4?: string;
  VatGroupPu?: string;
  VatGourpSa?: string;
  TariffDescription?: string;
  TariffCode?: string;
  CustomsDuty?: string;
}

export interface TermItem {
  TermID: number;
  ItemID: number;
  CardName: string;
  U_QLC: number;
  VendorStockItemNo: string;
  U_OrderTerm: string;
  U_PurCurr: string;
  U_ProdCost: number;
  U_ValidFrom: string;
  U_ValidTo: string;
  Active?: boolean;
  LastAwardedSO?: number;
  U_TermLocation?: string;
  SubLocation?: string;
  ContractNo?: string;
  U_SalesTerm?: string;
  SaleSubLocation?: string;
  U_PurRate?: number;
  BuyUnitMsr?: string;
  SalUnitMsr?: string;
  UpdatedDate?: string;
}

export interface BrandVendorItem {
  Source: string;
  Brand: string;
  SupplierCode: string;
  SupplierName: string;
  ContactPerson: string;
  Email: string;
  Position: string;
  Tel1: string;
  Tel2: string;
  ContactID: string;
  PositionSAP: string;
  EmailSAP: string;
  Tel1SAP: string;
  Tel2SAP: string;
  VendorBrand1: string;
  VendorBrand2: string;
  VendorBrand3: string;
  CompanyPhone1: string;
  CompanyPhone2: string;
  CompanyMobile: string;
  CompanyEmail: string;
  Website: string;
  CntctCode: string;
  LastUpdate: string;
}

export type SearchType = 'FTS' | 'CATNO' | 'CUST' | 'ITEM' | 'SAP';

export type ViewMode = 'itemList' | 'brandVendor' | 'categoryBrand' | 'vendorBrand';
