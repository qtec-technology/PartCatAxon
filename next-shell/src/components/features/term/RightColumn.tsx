import { memo, useEffect, useId, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { ExternalLink, Paperclip, Plus, Trash2 } from 'lucide-react';
import { Button } from '../common/atoms';
import { InlineSelect } from '../../common/InlineSelect';
import { NumberInput } from '../../common/NumberInput';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { clientLogger } from '../../../utils/logger';
import { attachmentApi } from '../../../services/attachment.api';
import { referenceFileApi } from '../../../services/reference-files.api';
import type {
  CreateTermAttachmentInput,
  TermAttachmentItem,
  TermCalcResults,
  TermFormData,
  UpdateTermFormData,
} from '../../../types/term_form.types';

interface RightColumnProps {
  formData: RightColumnFormData;
  updateFormData: UpdateTermFormData;
  isReadOnly: boolean;
  calcResults: TermCalcResults;
  attachments?: TermAttachmentItem[];
  uomOptions: Array<{ value: string; label: string }>;
  onAddAttachment?: (input: CreateTermAttachmentInput) => Promise<void>;
  onDeleteAttachment?: (attachmentId: string) => Promise<void>;
  attachmentOwner?: { relatedType: 'TERM'; relatedId: number } | null;
}

type RightColumnFormData = Pick<
  TermFormData,
  | 'purchaseUOM'
  | 'numInBuy'
  | 'stockUOM'
  | 'numInSale'
  | 'salesUOM'
  | 'spk'
  | 'qoc'
  | 'markup'
>;

const moneyFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const ATTACHMENT_CATEGORIES = [
  'Term-Certificate',
  'Vendor Quotation',
  'Others',
] as const;

const REFERENCE_LINKS = [
  { key: 'uom-manual', label: 'UOM Manual (PPT)' },
  { key: 'standard-custom-cost-table', label: 'Standard Custom Cost Table' },
  { key: 'domestic-agent-price-table', label: 'Domestic Agent Price Table' },
] as const;

const ensureUomOptions = (
  options: Array<{ value: string; label: string }>,
  currentValue: string
) => {
  const current = String(currentValue || '').trim();
  if (!current) return options;
  if (options.some((row) => row.value === current)) return options;
  return [{ value: current, label: current }, ...options];
};

const formatDateTime = (value: string): string => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return format(parsed, 'dd-MMM-yyyy HH:mm:ss');
};

export const RightColumn = memo(function RightColumn({
  formData,
  updateFormData,
  isReadOnly,
  calcResults,
  attachments: attachmentsProp,
  uomOptions,
  onAddAttachment,
  onDeleteAttachment,
  attachmentOwner,
}: RightColumnProps) {
  const idBase = useId();
  const fmt = (v: number) => moneyFormatter.format(v);
  const f = 'focus:outline-none focus:border-term-green focus:ring-1 focus:ring-term-green disabled:bg-white disabled:text-gray-500 enabled:border-gray-500';
  const salesOutputCls = 'w-[156px] px-3 py-1.5 border rounded text-sm font-mono text-right';
  const salesInputCls = `w-[74px] px-2 py-1.5 border border-gray-300 rounded text-sm bg-white text-right ${f}`;
  const salesMarkupCls = `w-[74px] px-2 py-1 border border-gray-300 rounded text-xs bg-white text-center ${f}`;
  const stockConvDisplay = Number.isFinite(formData.numInBuy) ? formData.numInBuy.toFixed(2) : '0.00';
  const salesConvDisplay = Number.isFinite(formData.numInSale) ? formData.numInSale.toFixed(2) : '0.00';

  const normalizedUoms = useMemo(
    () =>
      uomOptions
        .map((row) => ({
          value: String(row.value || '').trim(),
          label: String(row.label || '').trim(),
        }))
        .filter((row) => row.value !== '' && row.label !== ''),
    [uomOptions]
  );
  const purchaseUomOptions = useMemo(
    () => ensureUomOptions(normalizedUoms, formData.purchaseUOM),
    [formData.purchaseUOM, normalizedUoms]
  );
  const salesUomOptions = useMemo(
    () => ensureUomOptions(normalizedUoms, formData.salesUOM),
    [formData.salesUOM, normalizedUoms]
  );

  const attachments = attachmentsProp || [];
  const buildAttachmentDownloadUrl = (attachmentId: string): string => (
    attachmentOwner && attachmentId
      ? attachmentApi.getDownloadUrl(attachmentId, attachmentOwner)
      : ''
  );
  const canAddAttachment = typeof onAddAttachment === 'function';
  const canDeleteAttachment = typeof onDeleteAttachment === 'function';
  const [showAddFileDialog, setShowAddFileDialog] = useState(false);
  const [attachCategory, setAttachCategory] = useState('');
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const [attachmentBusy, setAttachmentBusy] = useState(false);

  const attachmentCategoryRef = useRef<HTMLButtonElement>(null);
  const attachFileInputRef = useRef<HTMLInputElement>(null);

      const ids = useMemo(
    () => ({
      purchaseUom: `${idBase}-purchaseUom`,
      numInBuy: `${idBase}-numInBuy`,
      numInSale: `${idBase}-numInSale`,
      salesUom: `${idBase}-salesUom`,
      spk: `${idBase}-spk`,
      qoc: `${idBase}-qoc`,
      salesCostPerUnit: `${idBase}-salesCostPerUnit`,
      markup: `${idBase}-markup`,
      markupAmount: `${idBase}-markupAmount`,
      attachmentCategory: `${idBase}-attachmentCategory`,
      attachmentFileName: `${idBase}-attachmentFileName`,
      attachmentFile: `${idBase}-attachmentFile`,
    }),
    [idBase]
  );

  const closeAttachmentDialog = () => {
    setShowAddFileDialog(false);
    setAttachCategory('');
    setAttachFile(null);
    if (attachFileInputRef.current) {
      attachFileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    if (!showAddFileDialog) return;
    attachmentCategoryRef.current?.focus();
  }, [showAddFileDialog]);

  const handleAddAttachment = async () => {
    if (!attachCategory || !attachFile || attachmentBusy) return;

    try {
      setAttachmentBusy(true);
      await onAddAttachment?.({
        category: attachCategory,
        fileName: attachFile.name,
        filePath: '',
        file: attachFile,
      });
      closeAttachmentDialog();
    } catch (error) {
      clientLogger.error('Failed to add term attachment', error);
    } finally {
      setAttachmentBusy(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId: string, fileName: string) => {
    const confirmed = window.confirm(
      fileName
        ? `Confirm delete attachment "${fileName}"?`
        : 'Confirm delete this attachment?'
    );
    if (!confirmed) return;

    try {
      setAttachmentBusy(true);
      await onDeleteAttachment?.(attachmentId);
    } catch (error) {
      clientLogger.error('Failed to delete term attachment', error);
    } finally {
      setAttachmentBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full min-h-0">
      <section className="border border-term-green rounded-md overflow-hidden shadow-sm" aria-labelledby={`${idBase}-uom-heading`}>
        <div className="bg-term-green px-3 py-2">
          <h2 id={`${idBase}-uom-heading`} className="text-base font-bold text-white tracking-wide">UOM Conversion</h2>
        </div>
        <div className="p-3 space-y-2.5 bg-white">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
            <label htmlFor={ids.purchaseUom} className="text-sm text-left sm:text-right text-gray-700 whitespace-nowrap w-full sm:w-[170px]">Purchase UOM (หน่วยซื้อ)</label>
            <InlineSelect
              id={ids.purchaseUom}
              value={formData.purchaseUOM || ''}
              onValueChange={(nextValue) => updateFormData('purchaseUOM', nextValue)}
              disabled={isReadOnly}
              placeholder="- Please Select -"
              allowClear
              size="sm"
              className={`w-full sm:w-[160px] px-2 py-1.5 border border-gray-300 rounded text-sm bg-white ${f} disabled:opacity-100 disabled:bg-gray-200 disabled:text-gray-900`}
              options={purchaseUomOptions.map((row) => ({ value: row.value, label: row.label }))}
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
            <label htmlFor={ids.numInBuy} className="text-xs text-left sm:text-right text-term-green font-bold whitespace-nowrap w-full sm:w-[170px]">Stock Conversion *</label>
            <div className="flex items-center">
              <NumberInput
                id={ids.numInBuy}
                value={formData.numInBuy}
                onChange={(v) => updateFormData('numInBuy', Number(v.toFixed(2)))}
                precision={2}
                disabled={isReadOnly}
                className={`w-[90px] px-2 py-1.5 border border-gray-300 rounded text-sm bg-white text-right ${f}`}
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
            <span className="text-sm text-left sm:text-right text-gray-700 font-bold whitespace-nowrap w-full sm:w-[170px]">Stock UOM (หน่วยเก็บ)</span>
            <span className="text-sm font-bold text-term-green bg-[#F0FDFA] px-3 py-1 rounded border border-term-green/20">{formData.stockUOM || 'EA'}</span>
          </div>

          <div className="border-t border-gray-100 pt-2 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
              <label htmlFor={ids.numInSale} className="text-xs text-left sm:text-right text-term-green font-bold whitespace-nowrap w-full sm:w-[170px]">Sales Conversion *</label>
              <div className="flex items-center">
                <NumberInput
                  id={ids.numInSale}
                  value={formData.numInSale}
                  onChange={(v) => updateFormData('numInSale', Number(v.toFixed(2)))}
                  precision={2}
                  disabled={isReadOnly}
                  className={`w-[90px] px-2 py-1.5 border border-gray-300 rounded text-sm bg-white text-right ${f}`}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
            <label htmlFor={ids.salesUom} className="text-sm text-left sm:text-right text-gray-700 whitespace-nowrap w-full sm:w-[170px]">Sales UOM (หน่วยขาย)</label>
            <InlineSelect
              id={ids.salesUom}
              value={formData.salesUOM || ''}
              onValueChange={(nextValue) => updateFormData('salesUOM', nextValue)}
              disabled={isReadOnly}
              placeholder="- Please Select -"
              allowClear
              size="sm"
              className={`w-full sm:w-[160px] px-2 py-1.5 border border-gray-300 rounded text-sm bg-white ${f} disabled:opacity-100 disabled:bg-gray-200 disabled:text-gray-900`}
              options={salesUomOptions.map((row) => ({ value: row.value, label: row.label }))}
            />
          </div>

          <div className="bg-term-green text-white text-center py-1.5 rounded text-sm -mx-3 -mb-3 mt-2">
            Stock Conversion: {stockConvDisplay} | Sales Conversion: {salesConvDisplay}
          </div>
        </div>
      </section>

      <section className="border border-term-green rounded-md overflow-hidden shadow-sm" aria-labelledby={`${idBase}-sales-heading`}>
        <div className="bg-term-green px-3 py-2">
          <h2 id={`${idBase}-sales-heading`} className="text-base font-bold text-white tracking-wide">Sales Calculation (การคำนวณราคาขายสินค้าต่อ 1 หน่วยขาย)</h2>
        </div>
        <div className="p-3 space-y-2.5 bg-white">
          <div className="flex items-center justify-between">
            <label htmlFor={ids.salesCostPerUnit} className="text-sm text-gray-700">ต้นทุนรวม SPK และ QOC</label>
            <input
              id={ids.salesCostPerUnit}
              name="salesCostPerUnit"
              type="text"
              value={fmt(calcResults.TOTAL_PRICE)}
              readOnly
              className={`${salesOutputCls} border-gray-300 bg-gray-200 text-gray-900`}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-700">SPK + QOC</span>
            <div className="flex gap-1">
              <NumberInput
                id={ids.spk}
                value={formData.spk}
                onChange={(v) => updateFormData('spk', v)}
                disabled={isReadOnly}
                className={salesInputCls}
                placeholder="SPK"
              />
              <NumberInput
                id={ids.qoc}
                value={formData.qoc}
                onChange={(v) => updateFormData('qoc', v)}
                disabled={isReadOnly}
                className={salesInputCls}
                placeholder="QOC"
              />
            </div>
          </div>
          <div className="space-y-1.5 pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 flex-1">
                <label htmlFor={ids.markup} className="text-xs text-gray-700">Markup %</label>
                <InlineSelect
                  id={ids.markup}
                  value={formData.markup || 0}
                  onValueChange={(nextValue) => updateFormData('markup', parseInt(nextValue, 10) || 0)}
                  disabled={isReadOnly}
                  size="sm"
                  className={`${salesMarkupCls} disabled:opacity-100 disabled:bg-gray-200 disabled:text-gray-900`}
                  options={[
                    ...(typeof formData.markup === 'number' && (formData.markup < 0 || formData.markup > 25)
                      ? [{ value: String(formData.markup), label: String(formData.markup) }]
                      : []),
                    ...Array.from({ length: 26 }, (_, i) => ({ value: String(i), label: String(i) })),
                  ]}
                />
              </div>
              <input
                id={ids.markupAmount}
                name="markupAmount"
                type="text"
                value={fmt(calcResults.MK_THB || 0)}
                readOnly
                className={`${salesOutputCls} border-gray-300 bg-gray-200 text-gray-900`}
              />
            </div>
          </div>

          <div className="border-t border-gray-100 pt-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-gray-800">SALE PRICE (THB)</span>
              <div className="w-[196px] rounded-md bg-gradient-to-r from-term-green to-[#3D8B1C] px-4 py-2 text-right text-white shadow-sm">
                <span className="text-xl font-bold font-mono tracking-wide">{fmt(calcResults.SALES_PRICE)}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white border border-gray-200 rounded-md p-3 shadow-sm space-y-1.5" aria-labelledby={`${idBase}-links-heading`}>
        <h2 id={`${idBase}-links-heading`} className="text-xs font-bold text-gray-700 block mb-2">Reference Links</h2>
        {REFERENCE_LINKS.map((link) => {
          const isOffice = referenceFileApi.isOfficeFile(link.key);
          const url = isOffice
            ? referenceFileApi.getOfficeUrl(link.key)
            : referenceFileApi.getUrl(link.key);

          return (
            <a
              key={link.key}
              href={isOffice ? '#' : url}
              target={isOffice ? undefined : '_blank'}
              rel="noreferrer"
              className="text-xs text-term-green hover:text-[#1D6F16] hover:underline flex items-center gap-1.5 cursor-pointer"
              onClick={
                isOffice
                  ? (e) => {
                      e.preventDefault();
                      window.location.href = url;
                    }
                  : undefined
              }
            >
              <ExternalLink className="w-3.5 h-3.5" /> {link.label}
            </a>
          );
        })}
      </section>

      <section className="border border-term-green rounded-md overflow-hidden shadow-sm flex-1 min-h-0 flex flex-col" aria-labelledby={`${idBase}-attachments-heading`}>
        <div className="bg-term-green px-3 py-2">
          <h2 id={`${idBase}-attachments-heading`} className="text-base font-bold text-white flex items-center gap-1.5 tracking-wide">
            <Paperclip className="w-4 h-4" /> Attachments
          </h2>
        </div>
        <div className="p-3 space-y-2 bg-white flex-1 min-h-0 flex flex-col">
          {!isReadOnly && canAddAttachment && (
            <div className="flex justify-end">
              <Button
                size="md"
                variant="primary"
                onClick={() => setShowAddFileDialog(true)}
                disabled={attachmentBusy}
                className="min-h-5 px-4 text-sm font-semibold"
              >
                <Plus className="w-2 h-2 mr-1" /> Add File
              </Button>
            </div>
          )}

          <div className="flex-1 min-h-0 border border-gray-300 rounded-md overflow-hidden shadow-sm">
            <div className="h-full overflow-auto">
              <table className="w-full min-w-[760px] table-fixed border-collapse text-sm whitespace-nowrap">
                <caption className="sr-only">Term attachments list</caption>
                <colgroup>
                  <col className="w-[120px]" />
                  <col className="w-[150px]" />
                  <col className="w-[80px]" />
                  <col className="w-[150px]" />
                  <col className="w-[120px]" />
                  {!isReadOnly && canDeleteAttachment && <col className="w-[44px]" />}
                </colgroup>
                <thead className="sticky top-0 z-10">
                  <tr className="bg-term-green text-white">
                    <th scope="col" className="px-3 py-2 text-center font-semibold border border-white/20">Category</th>
                    <th scope="col" className="px-3 py-2 text-center font-semibold border border-white/20">Attachment</th>
                    <th scope="col" className="px-3 py-2 text-center font-semibold border border-white/20">Updated By</th>
                    <th scope="col" className="px-3 py-2 text-center font-semibold border border-white/20">Updated Date</th>
                    <th scope="col" className="px-3 py-2 text-center font-semibold border border-white/20">Attachment ID</th>
                    {!isReadOnly && canDeleteAttachment && <th scope="col" className="px-2 py-2 w-10 text-center border border-white/20"><span className="sr-only">Actions</span></th>}
                  </tr>
                </thead>
                <tbody>
                  {attachments.length === 0 ? (
                    <tr>
                      <td colSpan={(!isReadOnly && canDeleteAttachment) ? 6 : 5} className="text-center py-8 text-sm text-gray-500 border border-gray-200">
                        <Paperclip className="w-6 h-6 mx-auto mb-2 text-gray-300" />
                        {!isReadOnly && !canAddAttachment ? (
                          <span className="text-xs text-amber-600">
                            Attachments are available after creating term (Edit mode).
                          </span>
                        ) : (
                          'No attachments found.'
                        )}
                      </td>
                    </tr>
                  ) : (
                    attachments.map((att, idx) => {
                      const updatedDateDisplay = formatDateTime(att.updatedDate);
                      const downloadUrl = buildAttachmentDownloadUrl(att.id);
                      return (
                        <tr key={att.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/70'}>
                          <td className="px-3 py-2 border border-gray-200 align-middle">
                            <span className="block truncate" title={att.category}>{att.category}</span>
                          </td>
                          <td className="px-3 py-2 border border-gray-200 align-middle text-term-green font-medium">
                            {downloadUrl ? (
                              <a href={downloadUrl} target="_blank" rel="noreferrer" className="block truncate hover:underline" title={att.fileName}>
                                {att.fileName}
                              </a>
                            ) : (
                              <span className="block truncate" title={att.fileName}>{att.fileName}</span>
                            )}
                          </td>
                          <td className="px-3 py-2 border border-gray-200 align-middle">
                            <span className="block truncate" title={att.updatedBy}>{att.updatedBy}</span>
                          </td>
                          <td className="px-3 py-2 border border-gray-200 align-middle">
                            <span className="block truncate" title={updatedDateDisplay}>{updatedDateDisplay}</span>
                          </td>
                          <td className="px-3 py-2 border border-gray-200 align-middle font-mono">
                            <span className="block truncate" title={att.id}>{att.id}</span>
                          </td>
                          {!isReadOnly && canDeleteAttachment && (
                            <td className="px-2 py-2 border border-gray-200 text-center align-middle">
                              <button
                                type="button"
                                onClick={() => void handleDeleteAttachment(att.id, att.fileName)}
                                disabled={attachmentBusy}
                                className="text-red-500 hover:text-red-700"
                                title="Remove"
                                aria-label={`Remove attachment ${att.fileName}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <Dialog
        open={showAddFileDialog}
        onOpenChange={(open) => {
          if (!open) {
            closeAttachmentDialog();
            return;
          }
          setShowAddFileDialog(true);
        }}
      >
        <DialogContent className="max-w-[420px] border-gray-400 bg-[#F0F0F0] p-0 gap-0">
          <DialogHeader className="px-3 py-2 bg-gradient-to-r from-[#E8E8E8] to-[#D0D0D0] border-b border-gray-300">
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold text-gray-800">
              <Paperclip className="w-4 h-4" /> Add Attachment
            </DialogTitle>
            <DialogDescription className="sr-only">
              Choose an attachment category and file to add to this term.
            </DialogDescription>
          </DialogHeader>

          <div className="p-5 space-y-4">
            <div className="flex items-center gap-3">
              <label htmlFor={ids.attachmentCategory} className="text-sm text-gray-700 w-16 text-right">Category</label>
              <InlineSelect
                ref={attachmentCategoryRef}
                id={ids.attachmentCategory}
                value={attachCategory}
                onValueChange={(nextValue) => setAttachCategory(nextValue)}
                placeholder="- Please Select -"
                allowClear
                size="sm"
                className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm bg-white"
                options={ATTACHMENT_CATEGORIES.map((category) => ({ value: category, label: category }))}
              />
            </div>

            <div className="flex items-center gap-3">
              <label htmlFor={ids.attachmentFileName} className="text-sm text-gray-700 w-16 text-right">Upload</label>
              <input
                id={ids.attachmentFileName}
                name="attachmentFileName"
                type="text"
                readOnly
                value={attachFile?.name || ''}
                className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm bg-white"
              />
              <input
                ref={attachFileInputRef}
                id={ids.attachmentFile}
                name="attachmentFile"
                type="file"
                className="hidden"
                onChange={(e) => setAttachFile(e.target.files?.[0] || null)}
              />
              <Button
                type="button"
                size="sm"
                variant="neutral"
                onClick={() => attachFileInputRef.current?.click()}
                disabled={attachmentBusy}
              >
                Browse
              </Button>
            </div>
          </div>

          <DialogFooter className="flex justify-center gap-3 px-5 pb-4 sm:justify-center">
            <Button
              type="button"
              size="sm"
              variant="primary"
              onClick={() => void handleAddAttachment()}
              className="min-w-[70px]"
              disabled={attachmentBusy || !attachCategory || !attachFile}
            >
              OK
            </Button>
            <Button type="button" size="sm" variant="neutral" onClick={closeAttachmentDialog} className="min-w-[70px]">
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});
