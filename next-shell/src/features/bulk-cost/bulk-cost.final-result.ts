import type { FinalResultColumns } from './bulk-cost.types';

export type FinalResultKey = keyof FinalResultColumns;

export interface FinalResultColumnDefinition {
  key: FinalResultKey;
  label: string;
  kind: 'text' | 'number';
  editable?: boolean;
  excelColumn?: string;
}

export const BULK_COST_AY_CP_COLUMNS: FinalResultColumnDefinition[] = [
  { excelColumn: 'AY', key: 'supplierName', label: 'Supplier', kind: 'text' },
  { excelColumn: 'AZ', key: 'purchaseOrderTerm', label: 'PO Term', kind: 'text' },
  { excelColumn: 'BA', key: 'termLocation', label: 'Location', kind: 'text' },
  { excelColumn: 'BB', key: 'productCost', label: 'PCS', kind: 'number', editable: true },
  { excelColumn: 'BC', key: 'pkh', label: 'PKH', kind: 'number', editable: true },
  { excelColumn: 'BD', key: 'soc', label: 'SOC', kind: 'number', editable: true },
  { excelColumn: 'BE', key: 'docCOC', label: 'COC', kind: 'number', editable: true },
  { excelColumn: 'BF', key: 'docMill', label: 'Mill', kind: 'number', editable: true },
  { excelColumn: 'BG', key: 'docTestCert', label: 'Test Cert', kind: 'number', editable: true },
  { excelColumn: 'BH', key: 'docCOO', label: 'COO/COA', kind: 'number', editable: true },
  { excelColumn: 'BI', key: 'docAnyOther', label: 'Any Other', kind: 'number', editable: true },
  { excelColumn: 'BJ', key: 'currency', label: 'Curr', kind: 'text' },
  { excelColumn: 'BK', key: 'rateExchange', label: 'EX.RATE', kind: 'number', editable: true },
  { excelColumn: 'BL', key: 'shipWeightCal', label: 'Ship Wt', kind: 'number', editable: true },
  { excelColumn: 'BM', key: 'insPercent', label: 'INS %', kind: 'number', editable: true },
  { excelColumn: 'BN', key: 'importDutyPercent', label: 'Duty %', kind: 'number', editable: true },
  { excelColumn: 'BO', key: 'purchaseUOM', label: 'Pur UOM', kind: 'text' },
  { excelColumn: 'BP', key: 'stockUOM', label: 'Stk UOM', kind: 'text' },
  { excelColumn: 'BQ', key: 'saleUOM', label: 'Sale UOM', kind: 'text' },
  { excelColumn: 'BR', key: 'stockConversion', label: 'Stk Conv', kind: 'number', editable: true },
  { excelColumn: 'BS', key: 'saleConversion', label: 'Sale Conv', kind: 'number', editable: true },
  { excelColumn: 'BT', key: 'purchaseMOQ', label: 'MOQ', kind: 'text', editable: true },
  { excelColumn: 'BU', key: 'wireTT', label: 'TT (THB)', kind: 'number', editable: true },
  { excelColumn: 'BV', key: 'customClear', label: 'CC (THB)', kind: 'number', editable: true },
  { excelColumn: 'BW', key: 'op1', label: 'OP1 (THB)', kind: 'number', editable: true },
  { excelColumn: 'BX', key: 'exworkCase', label: 'Exwork', kind: 'number', editable: true },
  { excelColumn: 'BY', key: 'op2', label: 'OP2 (THB)', kind: 'number', editable: true },
  { excelColumn: 'BZ', key: 'ins', label: 'INS', kind: 'number', editable: true },
  { excelColumn: 'CA', key: 'frQTEC', label: 'FR (THB)', kind: 'number', editable: true },
  { excelColumn: 'CB', key: 'frZoneRate', label: 'FR Zone/KG', kind: 'number', editable: true },
  { excelColumn: 'CC', key: 'frZoneCost', label: 'FR Zone', kind: 'number', editable: true },
  { excelColumn: 'CD', key: 'cifQTEC', label: 'CIF QTEC', kind: 'number', editable: true },
  { excelColumn: 'CE', key: 'cifZone', label: 'CIF Zone', kind: 'number', editable: true },
  { excelColumn: 'CF', key: 'dtQTEC', label: 'DT QTEC', kind: 'number', editable: true },
  { excelColumn: 'CG', key: 'dtZone', label: 'DT Zone', kind: 'number', editable: true },
  { excelColumn: 'CH', key: 'selectedDuty', label: 'Final DT', kind: 'number', editable: true },
  { excelColumn: 'CI', key: 'ttFinal', label: 'TT Final (THB)', kind: 'number', editable: true },
  { excelColumn: 'CJ', key: 'ccFinal', label: 'CC Final (THB)', kind: 'number', editable: true },
  { excelColumn: 'CK', key: 'qlc', label: 'QLC', kind: 'number', editable: true },
  { excelColumn: 'CL', key: 'spk', label: 'SPK (THB)', kind: 'number', editable: true },
  { excelColumn: 'CM', key: 'qocVal', label: 'QOC (THB)', kind: 'number', editable: true },
  { excelColumn: 'CN', key: 'totalQLC', label: 'Total QLC', kind: 'number', editable: true },
  { excelColumn: 'CO', key: 'markup', label: 'Markup', kind: 'number', editable: true },
  { excelColumn: 'CP', key: 'roundUp', label: 'Round Up', kind: 'number', editable: true },
];

export const BULK_COST_DIAGNOSTIC_COLUMNS: FinalResultColumnDefinition[] = [
  { key: 'docFees', label: 'Documents Fees (FEES)', kind: 'number', editable: true },
  { key: 'op1Source', label: 'OP1 (PSC)', kind: 'number', editable: true },
  { key: 'et', label: 'ET', kind: 'number', editable: true },
  { key: 'mt', label: 'MT', kind: 'number', editable: true },
  { key: 'miscTaxVal', label: 'Misc Tax', kind: 'number', editable: true },
  { key: 'scc', label: 'SCC', kind: 'number', editable: true },
  { key: 'preQLC', label: 'Pre QLC', kind: 'number', editable: true },
  { key: 'stk', label: 'STK', kind: 'number', editable: true },
];

export const FINAL_RESULT_COLS = BULK_COST_AY_CP_COLUMNS;

export const FINAL_RESULT_COLS_BY_KEY = new Map(
  [...BULK_COST_AY_CP_COLUMNS, ...BULK_COST_DIAGNOSTIC_COLUMNS].map((column) => [column.key, column]),
);

export function toAyCpFinalResultRow(finalResult: FinalResultColumns): Record<string, string | number | null> {
  return Object.fromEntries(
    BULK_COST_AY_CP_COLUMNS.map((column) => [column.excelColumn, finalResult[column.key]]),
  );
}
