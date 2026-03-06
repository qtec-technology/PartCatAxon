import { memo, useEffect, useId, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { ExternalLink, Paperclip, Plus, Trash2 } from 'lucide-react';
import { Button } from '../common/atoms';
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
  'Quotation',
  'Drawing',
  'Specification',
  'Photo',
  'Certificate',
  'Other',
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
}: RightColumnProps) {
  const idBase = useId();
  const fmt = (v: number) => moneyFormatter.format(v);
  const f = 'focus:outline-none focus:border-term-green focus:ring-1 focus:ring-term-green disabled:bg-white disabled:text-gray-500 enabled:border-gray-500';
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
  const canAddAttachment = typeof onAddAttachment === 'function';
  const canDeleteAttachment = typeof onDeleteAttachment === 'function';
  const [showAddFileDialog, setShowAddFileDialog] = useState(false);
  const [attachCategory, setAttachCategory] = useState('');
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const [attachmentBusy, setAttachmentBusy] = useState(false);

  const attachmentCategoryRef = useRef<HTMLSelectElement>(null);
  const attachFileInputRef = useRef<HTMLInputElement>(null);

  const ids = useMemo(
    () => ({
      purchaseUom: `${idBase}-purchaseUom`,
      numInBuy: `${idBase}-numInBuy`,
      numInSale: `${idBase}-numInSale`,
      salesUom: `${idBase}-salesUom`,
      spk: `${idBase}-spk`,
      qoc: `${idBase}-qoc`,
      markup: `${idBase}-markup`,
      addAttachmentTitle: `${idBase}-addAttachmentTitle`,
      addAttachmentDesc: `${idBase}-addAttachmentDesc`,
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
            <select
              id={ids.purchaseUom}
              value={formData.purchaseUOM || ''}
              onChange={(e) => updateFormData('purchaseUOM', e.target.value)}
              disabled={isReadOnly}
              className={`w-full sm:w-[160px] px-2 py-1.5 border border-gray-300 rounded text-sm bg-white ${f}`}
            >
              <option value="">- Please Select -</option>
              {purchaseUomOptions.map((row) => <option key={row.value} value={row.value}>{row.label}</option>)}
            </select>
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
            <select
              id={ids.salesUom}
              value={formData.salesUOM || ''}
              onChange={(e) => updateFormData('salesUOM', e.target.value)}
              disabled={isReadOnly}
              className={`w-full sm:w-[160px] px-2 py-1.5 border border-gray-300 rounded text-sm bg-white ${f}`}
            >
              <option value="">- Please Select -</option>
              {salesUomOptions.map((row) => <option key={row.value} value={row.value}>{row.label}</option>)}
            </select>
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
            <label className="text-sm text-gray-700">ต้นทุนสินค้าต่อ 1 หน่วยขาย</label>
            <input
              type="text"
              value={fmt(calcResults.QLC3)}
              readOnly
              className="w-[120px] px-2 py-1.5 border border-gray-300 rounded text-sm bg-gray-200 font-mono text-right text-gray-900"
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
                className={`w-[58px] px-2 py-1.5 border border-gray-300 rounded text-sm bg-white text-right ${f}`}
                placeholder="SPK"
              />
              <NumberInput
                id={ids.qoc}
                value={formData.qoc}
                onChange={(v) => updateFormData('qoc', v)}
                disabled={isReadOnly}
                className={`w-[58px] px-2 py-1.5 border border-gray-300 rounded text-sm bg-white text-right ${f}`}
                placeholder="QOC"
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700">ต้นทุนรวม SPK และ QOC</span>
            <input
              type="text"
              value={fmt(calcResults.TOTAL_PRICE)}
              readOnly
              className="w-[120px] px-2 py-1.5 border border-term-red rounded text-sm bg-red-50 font-mono text-right font-bold text-gray-900"
            />
          </div>
          <div className="space-y-1.5 pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 flex-1">
                <label htmlFor={ids.markup} className="text-xs text-gray-700">Markup %</label>
                <select
                  id={ids.markup}
                  value={formData.markup || 0}
                  onChange={(e) => updateFormData('markup', parseInt(e.target.value, 10) || 0)}
                  disabled={isReadOnly}
                  className={`w-[60px] px-1.5 py-1 border border-gray-300 rounded text-xs bg-white text-center ${f}`}
                >
                  {typeof formData.markup === 'number' && (formData.markup < 0 || formData.markup > 25) && (
                    <option value={formData.markup}>{formData.markup}</option>
                  )}
                  {Array.from({ length: 26 }, (_, i) => (
                    <option key={i} value={i}>{i}</option>
                  ))}
                </select>
              </div>
              <input
                type="text"
                value={fmt(calcResults.MK_THB || 0)}
                readOnly
                className="w-[120px] px-2 py-1.5 border border-gray-300 rounded text-sm bg-gray-200 font-mono text-right text-gray-900"
              />
            </div>
          </div>

          <div className="border-t border-gray-100 pt-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-gray-800">SALE PRICE (THB)</span>
              <div className="bg-gradient-to-r from-term-green to-[#3D8B1C] text-white w-[160px] px-3 py-2 rounded-md shadow-sm text-right">
                <span className="text-xl font-bold font-mono tracking-wide">{fmt(calcResults.SALES_PRICE)}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white border border-gray-200 rounded-md p-3 shadow-sm space-y-1.5" aria-labelledby={`${idBase}-links-heading`}>
        <h2 id={`${idBase}-links-heading`} className="text-xs font-bold text-gray-700 block mb-2">Reference Links</h2>
        <button
          type="button"
          disabled
          aria-disabled="true"
          className="text-xs text-gray-400 flex items-center gap-1.5 cursor-not-allowed"
        >
          <ExternalLink className="w-3.5 h-3.5" /> Standard Custom Cost Table (coming soon)
        </button>
        <button
          type="button"
          disabled
          aria-disabled="true"
          className="text-xs text-gray-400 flex items-center gap-1.5 cursor-not-allowed"
        >
          <ExternalLink className="w-3.5 h-3.5" /> Domestic Agent Price Table (coming soon)
        </button>
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
                      return (
                        <tr key={att.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/70'}>
                          <td className="px-3 py-2 border border-gray-200 align-middle">
                            <span className="block truncate" title={att.category}>{att.category}</span>
                          </td>
                          <td className="px-3 py-2 border border-gray-200 align-middle text-term-green font-medium">
                            <span className="block truncate" title={att.fileName}>{att.fileName}</span>
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
            <DialogTitle id={ids.addAttachmentTitle} className="flex items-center gap-2 text-sm font-semibold text-gray-800">
              <Paperclip className="w-4 h-4" /> Add Attachment
            </DialogTitle>
            <DialogDescription id={ids.addAttachmentDesc} className="sr-only">
              Choose an attachment category and file to add to this term.
            </DialogDescription>
          </DialogHeader>

          <div className="p-5 space-y-4">
            <div className="flex items-center gap-3">
              <label htmlFor={ids.attachmentCategory} className="text-sm text-gray-700 w-16 text-right">Category</label>
              <select
                ref={attachmentCategoryRef}
                id={ids.attachmentCategory}
                className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm bg-white"
                value={attachCategory}
                onChange={(e) => setAttachCategory(e.target.value)}
              >
                <option value="">- Please Select -</option>
                {ATTACHMENT_CATEGORIES.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3">
              <label htmlFor={ids.attachmentFileName} className="text-sm text-gray-700 w-16 text-right">Upload</label>
              <input
                id={ids.attachmentFileName}
                type="text"
                readOnly
                value={attachFile?.name || ''}
                className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm bg-white"
              />
              <input
                ref={attachFileInputRef}
                id={ids.attachmentFile}
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
