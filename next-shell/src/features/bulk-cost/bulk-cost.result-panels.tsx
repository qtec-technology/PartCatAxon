import { type ReactNode } from 'react';
import { Info, XCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';

import type {
  BulkCostInput,
  AllocationPreview,
  AllocationLineResult,
  AllocationLineSource,
  FinalResultColumns,
} from './bulk-cost.types';
import { formatShipMode } from './bulk-cost.types';
import { buildBulkCostFormulaAudit } from './bulk-cost.formula-audit';
import { fmt, fmtWeight, fmtAuditValue, pct, formatMatchStatus } from './bulk-cost.format';
import {
  FINAL_RESULT_COLS_BY_KEY,
  FINAL_RESULT_COLS,
  type FinalResultKey,
  type FinalResultColumnDefinition,
} from './bulk-cost.final-result';
import {
  ALLOC_COLS,
  REVIEW_RESULT_TABLE_COLUMNS,
  REVIEW_RESULT_GROUPS,
  REVIEW_RESULT_KEYS,
  REVIEW_LABEL_OVERRIDE,
  FORMULA_PREVIEW_TABLE_COLUMNS,
  FORMULA_RESULT_KEYS,
  FINAL_PREVIEW_TABLE_COLUMNS,
  SALE_PRICE_KEYS,
  getFinalResultColumnKey,
  getReviewColClass,
  type ResultView,
  type DraftPreviewMode,
} from './bulk-cost.columns';
import { FormattedNumberInput } from './bulk-cost.changes-panel';
import { ResizableHeader } from './bulk-cost.cells';
import type { ResizableTableSizing } from './BulkCostWorkspace';
import { getChargeableWeightPerEach, formatYesNo } from './BulkCostWorkspace';

export interface ResultTableProps {
  costs: BulkCostInput;
  fullTableSizing: ResizableTableSizing;
  formulaTableSizing: ResizableTableSizing;
  getFinalResultForLine: (line: AllocationLineResult) => FinalResultColumns;
  onEdit: (lineKey: string, key: FinalResultKey, raw: string) => void;
  onOpenDraftPreview: (mode: DraftPreviewMode, lineKey: string) => void;
  preview: AllocationPreview;
  resultView: ResultView;
  reviewTableSizing: ResizableTableSizing;
  selectedLines: AllocationLineSource[];
}

export function ResultTable({
  costs,
  fullTableSizing,
  formulaTableSizing,
  getFinalResultForLine,
  onEdit,
  onOpenDraftPreview,
  preview,
  resultView,
  reviewTableSizing,
  selectedLines,
}: ResultTableProps) {
  const sourceByKey = new Map(selectedLines.map((line) => [line.lineKey, line]));

  if (resultView === 'review') {
    return (
      <div className="table-scroll">
        <table
          className="prototype-table review-result-table"
          data-resizable-table={reviewTableSizing.tableId}
          style={reviewTableSizing.tableStyle}
        >
          <colgroup>
            {REVIEW_RESULT_TABLE_COLUMNS.map((column) => (
              <col key={column.key} style={reviewTableSizing.getColumnStyle(column.key)} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <ResizableHeader columnKey="rowNo" label="No" rowSpan={2} sizing={reviewTableSizing} />
              <ResizableHeader columnKey="itemGroup" label="Group" rowSpan={2} sizing={reviewTableSizing} />
              <ResizableHeader columnKey="supplierOrderCode" label="Supp Order Code" rowSpan={2} sizing={reviewTableSizing} />
              <ResizableHeader columnKey="description" label="Description" rowSpan={2} sizing={reviewTableSizing} />
              <ResizableHeader columnKey="qty" label="Qty" rowSpan={2} sizing={reviewTableSizing} />
              <ResizableHeader columnKey="uom" label="UOM" rowSpan={2} sizing={reviewTableSizing} />
              {REVIEW_RESULT_GROUPS.map((group) => (
                <th key={group.label} colSpan={group.count} className={group.className}>{group.label}</th>
              ))}
              <ResizableHeader className="th-final" columnKey="draftPreview" label="Preview" rowSpan={2} sizing={reviewTableSizing} />
              <ResizableHeader className="th-final" columnKey="status" label="Status" rowSpan={2} sizing={reviewTableSizing} />
            </tr>
            <tr>
              {REVIEW_RESULT_KEYS.map((key) => (
                <ResizableHeader
                  className={getReviewColClass(key)}
                  columnKey={getFinalResultColumnKey(key)}
                  key={key}
                  label={REVIEW_LABEL_OVERRIDE[key] ?? FINAL_RESULT_COLS_BY_KEY.get(key)?.label ?? key}
                  sizing={reviewTableSizing}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.lines.map((result, index) => {
              const source = sourceByKey.get(result.lineKey);
              if (!source) return null;
              return (
                <ReviewResultRow
                  key={result.lineKey}
                  finalResult={getFinalResultForLine(result)}
                  index={index}
                  result={result}
                  source={source}
                  tableSizing={reviewTableSizing}
                  onEdit={onEdit}
                  onOpenDraftPreview={onOpenDraftPreview}
                />
              );
            })}
          </tbody>
          <tfoot>
            <tr className="result-totals-row">
              <td colSpan={4} className="totals-label-cell">Totals ({preview.lines.length} lines)</td>
              <td className="numeric-cell">{fmt(preview.lines.reduce((s, l) => s + (sourceByKey.get(l.lineKey)?.qty ?? 0), 0))}</td>
              <td />
              {REVIEW_RESULT_KEYS.map((key) => {
                const skip = key === 'rateExchange' || key === 'op1Source' || key === 'shipWeightCal' || key === 'markup';
                if (skip) return <td key={key} />;
                const col = FINAL_RESULT_COLS_BY_KEY.get(key);
                if (!col || col.kind !== 'number') return <td key={key} />;
                const total = preview.lines.reduce((s, l) => s + (Number(getFinalResultForLine(l)[key]) || 0), 0);
                return <td key={key} className="numeric-cell">{fmt(total)}</td>;
              })}
              <td />
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    );
  }

  if (resultView === 'formula') {
    return (
      <div className="table-scroll">
        <table
          className="prototype-table formula-preview-table"
          data-resizable-table={formulaTableSizing.tableId}
          style={formulaTableSizing.tableStyle}
        >
          <colgroup>
            {FORMULA_PREVIEW_TABLE_COLUMNS.map((column) => (
              <col key={column.key} style={formulaTableSizing.getColumnStyle(column.key)} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <ResizableHeader columnKey="rowNo" label="No" rowSpan={2} sizing={formulaTableSizing} />
              <ResizableHeader columnKey="itemGroup" label="Group" rowSpan={2} sizing={formulaTableSizing} />
              <ResizableHeader columnKey="supplierOrderCode" label="Supp Order Code" rowSpan={2} sizing={formulaTableSizing} />
              <ResizableHeader columnKey="description" label="Description" rowSpan={2} sizing={formulaTableSizing} />
              <ResizableHeader columnKey="qty" label="Qty" rowSpan={2} sizing={formulaTableSizing} />
              <ResizableHeader columnKey="uom" label="UOM" rowSpan={2} sizing={formulaTableSizing} />
              <ResizableHeader columnKey="amount" label="Amount" rowSpan={2} sizing={formulaTableSizing} />
              <th colSpan={ALLOC_COLS.length} className="th-group">Allocated Costs</th>
              <th colSpan={FORMULA_RESULT_KEYS.length} className="th-group th-final">Formula Check</th>
              <ResizableHeader className="th-final" columnKey="status" label="Status" rowSpan={2} sizing={formulaTableSizing} />
            </tr>
            <tr>
              {ALLOC_COLS.map((column) => (
                <ResizableHeader columnKey={`alloc-${column.key}`} key={column.key} label={column.label} sizing={formulaTableSizing} />
              ))}
              {FORMULA_RESULT_KEYS.map((key) => (
                <ResizableHeader
                  className="th-final"
                  columnKey={getFinalResultColumnKey(key)}
                  key={key}
                  label={FINAL_RESULT_COLS_BY_KEY.get(key)?.label ?? key}
                  sizing={formulaTableSizing}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.lines.map((result, index) => {
              const source = sourceByKey.get(result.lineKey);
              if (!source) return null;
              return (
                <FormulaResultRow
                  key={result.lineKey}
                  finalResult={getFinalResultForLine(result)}
                  index={index}
                  result={result}
                  source={source}
                  costs={costs}
                  tableSizing={formulaTableSizing}
                  onEdit={onEdit}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="table-scroll">
      <table
        className="prototype-table final-preview-table"
        data-resizable-table={fullTableSizing.tableId}
        style={fullTableSizing.tableStyle}
      >
        <colgroup>
          {FINAL_PREVIEW_TABLE_COLUMNS.map((column) => (
            <col key={column.key} style={fullTableSizing.getColumnStyle(column.key)} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <ResizableHeader columnKey="rowNo" label="No" rowSpan={2} sizing={fullTableSizing} />
            <ResizableHeader columnKey="itemGroup" label="Group" rowSpan={2} sizing={fullTableSizing} />
            <ResizableHeader columnKey="supplierOrderCode" label="Supp Order Code" rowSpan={2} sizing={fullTableSizing} />
            <ResizableHeader columnKey="description" label="Description" rowSpan={2} sizing={fullTableSizing} />
            <ResizableHeader columnKey="qty" label="Qty" rowSpan={2} sizing={fullTableSizing} />
            <ResizableHeader columnKey="uom" label="UOM" rowSpan={2} sizing={fullTableSizing} />
            <ResizableHeader columnKey="amount" label="Amount" rowSpan={2} sizing={fullTableSizing} />
            <th colSpan={ALLOC_COLS.length} className="th-group">Allocated Costs</th>
            <th colSpan={FINAL_RESULT_COLS.length} className="th-group th-final">Final Result (one row = one item/term)</th>
            <ResizableHeader className="th-final" columnKey="status" label="Status" rowSpan={2} sizing={fullTableSizing} />
          </tr>
          <tr>
            {ALLOC_COLS.map((column) => (
              <ResizableHeader columnKey={`alloc-${column.key}`} key={column.key} label={column.label} sizing={fullTableSizing} />
            ))}
            {FINAL_RESULT_COLS.map((column) => (
              <ResizableHeader className="th-final" columnKey={getFinalResultColumnKey(column.key)} key={column.key} label={column.label} sizing={fullTableSizing} />
            ))}
          </tr>
        </thead>
        <tbody>
          {preview.lines.map((result, index) => {
            const source = sourceByKey.get(result.lineKey);
            if (!source) return null;
            return (
              <PreviewRow
                key={result.lineKey}
                index={index}
                source={source}
                result={result}
                finalResult={getFinalResultForLine(result)}
                onEdit={onEdit}
                tableSizing={fullTableSizing}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export interface ReviewResultRowProps {
  index: number;
  source: AllocationLineSource;
  result: AllocationLineResult;
  finalResult: FinalResultColumns;
  onEdit: (lineKey: string, key: FinalResultKey, raw: string) => void;
  onOpenDraftPreview: (mode: DraftPreviewMode, lineKey: string) => void;
  tableSizing: ResizableTableSizing;
}

export function ReviewResultRow({
  index,
  source,
  result,
  finalResult,
  onEdit,
  onOpenDraftPreview,
  tableSizing,
}: ReviewResultRowProps) {
  return (
    <tr className={result.status === 'error' ? 'row-error' : result.status === 'warning' ? 'row-warning' : ''}>
      <td {...tableSizing.getCellProps('rowNo')} className="center-cell">{String(index + 1).padStart(2, '0')}</td>
      <td {...tableSizing.getCellProps('itemGroup')} className="center-cell">{formatItemGroup(source.itemGroup)}</td>
      <td {...tableSizing.getCellProps('supplierOrderCode')} className="text-left-cell">{source.supplierOrderCode}</td>
      <td {...tableSizing.getCellProps('description')} className="text-left-cell">{source.sapDescription}</td>
      <td {...tableSizing.getCellProps('qty')} className="center-cell">{fmt(source.qty)}</td>
      <td {...tableSizing.getCellProps('uom')} className="center-cell">{source.uom}</td>
      {REVIEW_RESULT_KEYS.map((key) => {
        const column = FINAL_RESULT_COLS_BY_KEY.get(key);
        if (!column) return null;
        const isSale = SALE_PRICE_KEYS.has(key);
        return (
          <td
            key={key}
            {...tableSizing.getCellProps(getFinalResultColumnKey(key))}
            className={`${column.kind === 'number' ? 'numeric-cell' : ''}${isSale ? ' td-sale-price' : ''}`}
          >
            <FinalResultCell lineKey={result.lineKey} column={column} value={finalResult[key]} onEdit={onEdit} />
          </td>
        );
      })}
      <td {...tableSizing.getCellProps('draftPreview')} className="center-cell">
        <div className="draft-preview-actions">
          <button
            className="draft-preview-action"
            type="button"
            onClick={() => onOpenDraftPreview('item', result.lineKey)}
          >
            Item
          </button>
          <button
            className="draft-preview-action"
            type="button"
            onClick={() => onOpenDraftPreview('term', result.lineKey)}
          >
            Term
          </button>
        </div>
      </td>
      <td {...tableSizing.getCellProps('status')} className="center-cell">
        <StatusCell result={result} />
      </td>
    </tr>
  );
}

function formatItemGroup(value: string): string {
  return value;
}

export interface FormulaResultRowProps {
  costs: BulkCostInput;
  index: number;
  source: AllocationLineSource;
  result: AllocationLineResult;
  finalResult: FinalResultColumns;
  onEdit: (lineKey: string, key: FinalResultKey, raw: string) => void;
  tableSizing: ResizableTableSizing;
}

export function FormulaResultRow({
  costs,
  index,
  source,
  result,
  finalResult,
  onEdit,
  tableSizing,
}: FormulaResultRowProps) {
  const auditCosts = {
    ...costs,
    orderTerm: source.orderTerm || costs.orderTerm,
    location: source.location || costs.location,
    subLocation: source.subLocation || costs.subLocation,
    shipModeNo: source.shipModeNo || costs.shipModeNo,
  };
  const audit = buildBulkCostFormulaAudit(source, auditCosts, finalResult, { allocationLine: result });
  const rowClass = audit.status === 'fail' || result.status === 'error'
    ? 'row-error'
    : audit.status === 'warn' || result.status === 'warning'
      ? 'row-warning'
      : '';

  return (
    <tr className={rowClass}>
      <td {...tableSizing.getCellProps('rowNo')} className="center-cell">{String(index + 1).padStart(2, '0')}</td>
      <td {...tableSizing.getCellProps('itemGroup')} className="center-cell">{formatItemGroup(source.itemGroup)}</td>
      <td {...tableSizing.getCellProps('supplierOrderCode')} className="text-left-cell">{source.supplierOrderCode}</td>
      <td {...tableSizing.getCellProps('description')} className="text-left-cell">{source.sapDescription}</td>
      <td {...tableSizing.getCellProps('qty')} className="center-cell">{fmt(source.qty)}</td>
      <td {...tableSizing.getCellProps('uom')} className="center-cell">{source.uom}</td>
      <td {...tableSizing.getCellProps('amount')} className="numeric-cell">{fmt(source.amount)}</td>
      {ALLOC_COLS.map((column) => (
        <td key={column.key} {...tableSizing.getCellProps(`alloc-${column.key}`)} className="numeric-cell">
          {String(column.key).includes('Ratio') ? pct(result[column.key]) : fmt(result[column.key])}
        </td>
      ))}
      {FORMULA_RESULT_KEYS.map((key) => {
        const column = FINAL_RESULT_COLS_BY_KEY.get(key);
        if (!column) return null;
        return (
          <td key={key} {...tableSizing.getCellProps(getFinalResultColumnKey(key))} className={column.kind === 'number' ? 'numeric-cell' : ''}>
            <FinalResultCell lineKey={result.lineKey} column={column} value={finalResult[key]} onEdit={onEdit} />
          </td>
        );
      })}
      <td {...tableSizing.getCellProps('status')} className="center-cell">
        <FormulaAuditStatusCell audit={audit} />
      </td>
    </tr>
  );
}

export interface PreviewRowProps {
  index: number;
  source: AllocationLineSource;
  result: AllocationLineResult;
  finalResult: FinalResultColumns;
  onEdit: (lineKey: string, key: FinalResultKey, raw: string) => void;
  tableSizing: ResizableTableSizing;
}

export function PreviewRow({
  index,
  source,
  result,
  finalResult,
  onEdit,
  tableSizing,
}: PreviewRowProps) {
  return (
    <tr className={result.status === 'error' ? 'row-error' : result.status === 'warning' ? 'row-warning' : ''}>
      <td {...tableSizing.getCellProps('rowNo')} className="center-cell">{String(index + 1).padStart(2, '0')}</td>
      <td {...tableSizing.getCellProps('itemGroup')} className="center-cell">{formatItemGroup(source.itemGroup)}</td>
      <td {...tableSizing.getCellProps('supplierOrderCode')} className="text-left-cell">{source.supplierOrderCode}</td>
      <td {...tableSizing.getCellProps('description')} className="text-left-cell">{source.sapDescription}</td>
      <td {...tableSizing.getCellProps('qty')} className="center-cell">{fmt(source.qty)}</td>
      <td {...tableSizing.getCellProps('uom')} className="center-cell">{source.uom}</td>
      <td {...tableSizing.getCellProps('amount')} className="numeric-cell">{fmt(source.amount)}</td>
      <td {...tableSizing.getCellProps('alloc-weightRatioPerItem')} className="numeric-cell">{pct(result.weightRatioPerItem)}</td>
      <td {...tableSizing.getCellProps('alloc-weightRatioPerEach')} className="numeric-cell">{pct(result.weightRatioPerEach)}</td>
      <td {...tableSizing.getCellProps('alloc-valueRatioPerItem')} className="numeric-cell">{pct(result.valueRatioPerItem)}</td>
      <td {...tableSizing.getCellProps('alloc-valueRatioPerEach')} className="numeric-cell">{pct(result.valueRatioPerEach)}</td>
      <td {...tableSizing.getCellProps('alloc-pkhPerEach')} className="numeric-cell">{fmt(result.pkhPerEach)}</td>
      <td {...tableSizing.getCellProps('alloc-socPerEach')} className="numeric-cell">{fmt(result.socPerEach)}</td>
      <td {...tableSizing.getCellProps('alloc-freightPerEach')} className="numeric-cell">{fmt(result.freightPerEach)}</td>
      <td {...tableSizing.getCellProps('alloc-ccPerEach')} className="numeric-cell">{fmt(result.ccPerEach)}</td>
      <td {...tableSizing.getCellProps('alloc-wireTTPerEach')} className="numeric-cell">{fmt(result.wireTTPerEach)}</td>
      {FINAL_RESULT_COLS.map((column) => (
        <td key={column.key} {...tableSizing.getCellProps(getFinalResultColumnKey(column.key))} className={column.kind === 'number' ? 'numeric-cell' : ''}>
          <FinalResultCell
            lineKey={result.lineKey}
            column={column}
            value={finalResult[column.key]}
            onEdit={onEdit}
          />
        </td>
      ))}
      <td {...tableSizing.getCellProps('status')} className="center-cell">
        <StatusCell result={result} />
      </td>
    </tr>
  );
}

export interface DraftPreviewPanelProps {
  costs: BulkCostInput;
  finalResult: FinalResultColumns;
  mode: DraftPreviewMode;
  result: AllocationLineResult;
  source: AllocationLineSource;
  onClose: () => void;
}

export function DraftPreviewPanel({
  costs,
  finalResult,
  mode,
  result,
  source,
  onClose,
}: DraftPreviewPanelProps) {
  const missingFields = mode === 'item'
    ? getMissingItemDraftFields(source)
    : getMissingTermDraftFields(source, finalResult);
  const statusLabel = result.status === 'error'
    ? 'Needs correction'
    : missingFields.length > 0
      ? 'Needs review'
      : 'Preview ready';
  const statusClass = result.status === 'error'
    ? 'error'
    : missingFields.length > 0
      ? 'warning'
      : result.status;

  return (
    <div className="draft-preview-panel" aria-label={`${mode === 'item' ? 'Item' : 'Term'} draft preview`}>
      <div className="draft-preview-header">
        <div>
          <p className="eyebrow">Post-CAL Draft</p>
          <h3>{mode === 'item' ? 'Item Draft Preview' : 'Term Draft Preview'}</h3>
          <span>
            Row {String(source.no).padStart(2, '0')} - {source.sapDescription}
          </span>
        </div>
        <button className="draft-preview-close" type="button" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="draft-preview-status-row">
        <span className={`draft-preview-status ${statusClass}`}>
          {statusLabel}
        </span>
        <span>Save State: Not saved</span>
        <span>Mode: Read-only preview</span>
        <span>Missing: {missingFields.length > 0 ? missingFields.join(', ') : '-'}</span>
      </div>

      {mode === 'item' ? (
        <ItemDraftPreview source={source} />
      ) : (
        <TermDraftPreview costs={costs} finalResult={finalResult} result={result} source={source} />
      )}
    </div>
  );
}

export function ItemDraftPreview({ source }: { source: AllocationLineSource }) {
  return (
    <div className="draft-preview-content">
      <DraftPreviewSection title="Item Master">
        <DraftPreviewField label="Match" value={formatMatchStatus(source.itemCode)} />
        <DraftPreviewField label="Item Code" value={source.itemCode.trim() || 'Auto-generated later'} />
        <DraftPreviewField label="Group" value={formatItemGroup(source.itemGroup)} />
        <DraftPreviewField label="Item Category" value={source.itemCategory} />
        <DraftPreviewField label="Mfr Brand" value={source.manufacturer} />
        <DraftPreviewField label="Mfr Catalog No" value={source.mfgPartNumber} />
        <DraftPreviewField label="Stock UOM" value={source.uom} />
        <DraftPreviewField label="Active" value="Yes" />
        <DraftPreviewField wide label="Item Description" value={source.sapDescription} />
      </DraftPreviewSection>

      <DraftPreviewSection title="Compliance and Reference">
        <DraftPreviewField label="Harmonized Code" value={source.hsCode} />
        <DraftPreviewField label="Country of Origin" value={source.countryOfOrigin} />
        <DraftPreviewField label="Permit Required" value={formatYesNo(source.importPermit)} />
        <DraftPreviewField label="Shelf Life" value={formatYesNo(source.shelfLifeRequire)} />
      </DraftPreviewSection>
    </div>
  );
}

export function TermDraftPreview({
  costs,
  finalResult,
  result,
  source,
}: {
  costs: BulkCostInput;
  finalResult: FinalResultColumns;
  result: AllocationLineResult;
  source: AllocationLineSource;
}) {
  return (
    <div className="draft-preview-content">
      <DraftPreviewSection title="Term Context">
        <DraftPreviewField label="Supplier" value={finalResult.supplierName || source.vendorName} />
        <DraftPreviewField label="Supp Order Code" value={source.supplierOrderCode} />
        <DraftPreviewField label="Purchase Term" value={finalResult.purchaseOrderTerm} />
        <DraftPreviewField label="Location" value={finalResult.termLocation} />
        <DraftPreviewField label="Ship Mode" value={formatShipMode(source.shipModeNo || costs.shipModeNo)} />
        <DraftPreviewField label="Sales Term" value={source.salesTerm || ''} />
        <DraftPreviewField label="Sales Sub Loc" value={source.salesSubLocation || ''} />
        <DraftPreviewField label="Lead Time" value={source.deliveryLeadTime} />
        <DraftPreviewField label="Sale Incharge" value={costs.saleIncharge} />
        <DraftPreviewField label="Contact Person" value={costs.contactPerson} />
      </DraftPreviewSection>

      <DraftPreviewSection title="Line Source">
        <DraftPreviewField label="Qty" value={fmt(source.qty)} />
        <DraftPreviewField label="UOM" value={source.uom} />
        <DraftPreviewField label="Unit Price" value={fmt(source.unitPrice)} />
        <DraftPreviewField label="Amount" value={`${source.currency} ${fmt(source.amount)}`} />
        <DraftPreviewField label="Currency" value={finalResult.currency} />
        <DraftPreviewField label="Exchange Rate" value={fmt(finalResult.rateExchange)} />
      </DraftPreviewSection>

      <DraftPreviewSection title="Cost Result">
        <DraftPreviewField label="PCS" value={fmt(finalResult.productCost)} />
        <DraftPreviewField label="PKH" value={fmt(finalResult.pkh)} />
        <DraftPreviewField label="SOC" value={fmt(finalResult.soc)} />
        <DraftPreviewField label="COC" value={fmt(finalResult.docCOC)} />
        <DraftPreviewField label="Mill" value={fmt(finalResult.docMill)} />
        <DraftPreviewField label="Test Cert" value={fmt(finalResult.docTestCert)} />
        <DraftPreviewField label="COO/COA" value={fmt(finalResult.docCOO)} />
        <DraftPreviewField label="Any Other" value={fmt(finalResult.docAnyOther)} />
        <DraftPreviewField label="OP1 (PSC)" value={fmt(finalResult.op1Source)} />
        <DraftPreviewField label="OP1 (THB)" value={fmt(finalResult.op1)} />
        <DraftPreviewField label="OP2 (THB)" value={fmt(finalResult.op2)} />
        <DraftPreviewField label="Round Up" value={fmt(finalResult.roundUp)} />
      </DraftPreviewSection>

      <DraftPreviewSection title="Weight, Duty, and QLC">
        <DraftPreviewField label="Item Wt/Ea" value={fmtWeight(source.itemWeightPerEach)} />
        <DraftPreviewField label="Dim Wt/Ea" value={fmtWeight(source.dimensionWeightPerEach)} />
        <DraftPreviewField label="Chargeable Wt/Ea" value={fmtWeight(getChargeableWeightPerEach(source))} />
        <DraftPreviewField label="Ship Wt/Ea" value={fmtWeight(finalResult.shipWeightCal)} />
        <DraftPreviewField label="Duty %" value={fmt(finalResult.importDutyPercent)} />
        <DraftPreviewField label="Insurance %" value={fmt(finalResult.insPercent)} />
        <DraftPreviewField label="FR QTEC" value={fmt(finalResult.frQTEC)} />
        <DraftPreviewField label="Zone Rate" value={fmt(finalResult.frZoneRate)} />
        <DraftPreviewField label="TT (THB)" value={fmt(finalResult.wireTT)} />
        <DraftPreviewField label="CC (THB)" value={fmt(finalResult.customClear)} />
        <DraftPreviewField label="QLC" value={fmt(finalResult.qlc)} />
        <DraftPreviewField label="SPK (THB)" value={fmt(finalResult.spk)} />
        <DraftPreviewField label="QOC (THB)" value={fmt(finalResult.qocVal)} />
        <DraftPreviewField label="Total QLC" value={fmt(finalResult.totalQLC)} />
        <DraftPreviewField label="Markup" value={fmt(finalResult.markup)} />
      </DraftPreviewSection>

      <DraftPreviewSection title="UOM and Conversion">
        <DraftPreviewField label="Purchase UOM" value={finalResult.purchaseUOM} />
        <DraftPreviewField label="Stock UOM" value={finalResult.stockUOM} />
        <DraftPreviewField label="Sales UOM" value={finalResult.saleUOM} />
        <DraftPreviewField label="Stock Conversion" value={fmt(finalResult.stockConversion)} />
        <DraftPreviewField label="Sales Conversion" value={fmt(finalResult.saleConversion)} />
        <DraftPreviewField label="MOQ" value={finalResult.purchaseMOQ || '-'} />
      </DraftPreviewSection>

      {result.warnings.length > 0 && (
        <DraftPreviewSection title="Warnings">
          <DraftPreviewField
            wide
            label="Calculation Warnings"
            value={result.warnings.map((warning) => warning.message).join('; ')}
          />
        </DraftPreviewSection>
      )}
    </div>
  );
}

export function DraftPreviewSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="draft-preview-section">
      <h4>{title}</h4>
      <div className="draft-preview-grid">{children}</div>
    </section>
  );
}

export function DraftPreviewField({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: ReactNode;
  wide?: boolean;
}) {
  const normalizedValue = typeof value === 'string' ? formatDraftText(value) : value;
  return (
    <div className={`draft-preview-field ${wide ? 'draft-preview-field-wide' : ''}`}>
      <span>{label}</span>
      <strong>{normalizedValue}</strong>
    </div>
  );
}

export function getMissingItemDraftFields(source: AllocationLineSource): string[] {
  const missing: string[] = [];
  if (!source.itemGroup.trim()) missing.push('Group');
  if (!source.sapDescription.trim()) missing.push('Description');
  if (!source.manufacturer.trim()) missing.push('Mfr Brand');
  if (!source.mfgPartNumber.trim()) missing.push('Mfr Catalog No');
  if (!source.uom.trim()) missing.push('UOM');
  return missing;
}

export function getMissingTermDraftFields(source: AllocationLineSource, finalResult: FinalResultColumns): string[] {
  const missing: string[] = [];
  if (!source.supplierOrderCode.trim()) missing.push('Supp Order Code');
  if (!finalResult.purchaseOrderTerm.trim()) missing.push('Purchase Term');
  if (!finalResult.termLocation.trim()) missing.push('Location');
  if (!source.deliveryLeadTime.trim()) missing.push('Lead Time');
  if (!finalResult.currency.trim()) missing.push('Currency');
  if (!Number.isFinite(finalResult.rateExchange) || finalResult.rateExchange <= 0) missing.push('Exchange Rate');
  if (!Number.isFinite(finalResult.productCost) || finalResult.productCost <= 0) missing.push('PCS');
  return missing;
}

export function formatDraftText(value: string): string {
  const trimmed = value.trim();
  return trimmed || '-';
}

export function FinalResultCell({
  lineKey,
  column,
  value,
  onEdit,
}: {
  lineKey: string;
  column: FinalResultColumnDefinition;
  value: FinalResultColumns[FinalResultKey];
  onEdit: (lineKey: string, key: FinalResultKey, raw: string) => void;
}) {
  if (column.kind === 'number' && column.editable) {
    const numericValue = typeof value === 'number' ? value : 0;
    return (
      <FormattedNumberInput
        id={`preview-${lineKey}-${column.key}`}
        name={`preview.${lineKey}.${column.key}`}
        className="preview-edit-input"
        value={numericValue}
        onChange={(event) => onEdit(lineKey, column.key, event.target.value)}
        aria-label={`${column.label} for ${lineKey}`}
      />
    );
  }

  if (typeof value === 'number') return <span>{fmt(value)}</span>;
  return <span>{value ?? '-'}</span>;
}

export function StatusCell({ result }: { result: AllocationLineResult }) {
  if (result.status === 'error') {
    return (
      <span className="table-warning" title={result.warnings.map((warning) => warning.message).join('\n')}>
        <XCircle size={14} aria-hidden="true" />
        Error
      </span>
    );
  }
  if (result.status === 'warning') {
    return (
      <span className="table-warning" title={result.warnings.map((warning) => warning.message).join('\n')}>
        <AlertTriangle size={14} aria-hidden="true" />
        Warning
      </span>
    );
  }
  return (
    <span className="table-ok">
      <CheckCircle2 size={14} aria-hidden="true" />
      Ready
    </span>
  );
}

export function FormulaAuditStatusCell({ audit }: { audit: ReturnType<typeof buildBulkCostFormulaAudit> }) {
  const title = audit.rows
    .filter((row) => row.status !== 'pass')
    .map((row) => `${row.label}: expected ${fmtAuditValue(row.expectedValue)}, actual ${fmtAuditValue(row.actualValue)}${row.note ? ` - ${row.note}` : ''}`)
    .join('\n');

  if (audit.status === 'fail') {
    return (
      <span className="table-error" title={title || 'Formula audit failed'}>
        <XCircle size={14} aria-hidden="true" />
        Fail ({audit.failCount})
      </span>
    );
  }
  if (audit.status === 'warn') {
    return (
      <span className="table-warning" title={title || 'Formula audit has warnings'}>
        <AlertTriangle size={14} aria-hidden="true" />
        Warn ({audit.warnCount})
      </span>
    );
  }
  return (
    <span className="table-ok" title="Formula audit passed">
      <CheckCircle2 size={14} aria-hidden="true" />
      Pass
    </span>
  );
}
