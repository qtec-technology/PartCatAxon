import { Paperclip, Plus, Trash2, Upload, X } from 'lucide-react';
import type { ChangeEvent, RefObject } from 'react';
import { type UseFormSetValue } from 'react-hook-form';
import { InlineSelect } from '../../../common/InlineSelect';
import { Button, cn } from '../../common/atoms';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../ui/table';
import type { ItemData } from '../../../../types/item_types';
import {
  ITEM_ATTACHMENT_CATEGORIES,
  composeLongDescWithSuffix,
  formatDateTimeDisplay,
  splitLongDescToChunks,
  type AttachmentItem,
  type ItemFormElementIds,
} from '../item.utils';

interface ItemCenterColumnProps {
  activeTab: 'desc' | 'attach';
  setActiveTab: (tab: 'desc' | 'attach') => void;
  previewImage: string;
  onImageError: () => void;
  canManageItemImage: boolean;
  canManageAttachments: boolean;
  isNew: boolean;
  isReadOnly: boolean;
  itemIds: ItemFormElementIds;
  handleImageUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  editableLongDescMaxLength: number;
  editableLongDescription: string;
  lockedLongDescSuffix: string;
  currentMfrCatalogNo: string;
  currentMfrBrand: string;
  fullDescriptionChunks: [string, string, string, string];
  fullDescription: string;
  setValue: UseFormSetValue<ItemData>;
  attachments: AttachmentItem[];
  buildAttachmentDownloadUrl: (attachmentId: string) => string;
  deletingAttachmentIds: Record<string, boolean>;
  handleDeleteAttachment: (attachment: AttachmentItem) => void | Promise<void>;
  showAddFileDialog: boolean;
  setShowAddFileDialog: (value: boolean) => void;
  attachCategory: string;
  setAttachCategory: (value: string) => void;
  attachFile: File | null;
  setAttachFile: (file: File | null) => void;
  attachFileInputRef: RefObject<HTMLInputElement | null>;
  handleAddAttachment: () => void;
}

export function ItemCenterColumn({
  activeTab,
  setActiveTab,
  previewImage,
  onImageError,
  canManageItemImage,
  canManageAttachments,
  isNew,
  isReadOnly,
  itemIds,
  handleImageUpload,
  editableLongDescMaxLength,
  editableLongDescription,
  lockedLongDescSuffix,
  currentMfrCatalogNo,
  currentMfrBrand,
  fullDescriptionChunks,
  fullDescription,
  setValue,
  attachments,
  buildAttachmentDownloadUrl,
  deletingAttachmentIds,
  handleDeleteAttachment,
  showAddFileDialog,
  setShowAddFileDialog,
  attachCategory,
  setAttachCategory,
  attachFile,
  setAttachFile,
  attachFileInputRef,
  handleAddAttachment,
}: ItemCenterColumnProps) {
  const closeAddFileDialog = () => {
    setShowAddFileDialog(false);
    setAttachCategory('');
    setAttachFile(null);
    if (attachFileInputRef.current) {
      attachFileInputRef.current.value = '';
    }
  };

  return (
    <div className="col-span-12 lg:col-span-6 flex flex-col gap-4">

      <div className="bg-gray-50 p-4 border border-gray-200 rounded">
        <div className="bg-white border border-gray-300 w-64 aspect-square mx-auto flex items-center justify-center mb-2 overflow-hidden relative">
          <a
            href={previewImage}
            target="_blank"
            rel="noreferrer"
            className="h-full w-full block"
            title="Open image"
          >
            <img
              src={previewImage}
              alt="Preview"
              className="h-full w-full object-contain"
              onError={onImageError}
            />
          </a>
        </div>
        {canManageItemImage && (
          <div className="flex justify-center">
            <label className="cursor-pointer bg-[#2264A0] text-white px-3 py-1 text-sm rounded hover:bg-blue-800 flex items-center gap-2">
              <Upload className="w-3 h-3" /> Upload Img
              <input id={itemIds.imageUpload} name="itemImageUpload" type="file" className="hidden" accept=".jpg,.png,.gif" onChange={handleImageUpload} />
            </label>
          </div>
        )}
        {isNew && (
          <p className="mt-2 text-center text-xs text-gray-500">
            Image will be uploaded after the item is created.
          </p>
        )}
      </div>

      <div className="border border-gray-200 rounded overflow-hidden bg-white">
        <div className="flex border-b border-gray-200 bg-gray-100">
          <button
            type="button"
            className={cn("px-4 py-2 text-sm font-bold", activeTab === 'desc' ? "bg-white border-t-2 border-t-[#2264A0] text-[#2264A0]" : "text-gray-500 hover:text-gray-700")}
            onClick={() => setActiveTab('desc')}
          >
            Long Description
          </button>
          <button
            type="button"
            className={cn("px-4 py-2 text-sm font-bold", activeTab === 'attach' ? "bg-white border-t-2 border-t-[#2264A0] text-[#2264A0]" : "text-gray-500 hover:text-gray-700")}
            onClick={() => setActiveTab('attach')}
          >
            Attachments
          </button>
        </div>

        <div className="p-4">
          {activeTab === 'desc' && (
            <div className="space-y-3">
              <div>
                <label htmlFor={itemIds.longDescriptionInput} className="text-xs font-bold text-gray-700 mb-2 block">
                  ✏️ Long Description Input
                </label>
                <div className="relative">
                  <textarea
                    id={itemIds.longDescriptionInput}
                    name="longDescriptionInput"
                    className={cn(
                      "w-full border rounded px-2 py-1.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-[#2264A0]/30 resize-none",
                      isReadOnly
                        ? "border-gray-300 bg-[#F5F5F5] text-gray-500"
                        : "border-[#2264A0] bg-white"
                    )}
                    rows={15}
                    maxLength={editableLongDescMaxLength}
                    placeholder="Type the full long description here..."
                    value={editableLongDescription}
                    disabled={isReadOnly}
                    onChange={(e) => {
                      const body = e.target.value.slice(0, editableLongDescMaxLength);
                      const merged = composeLongDescWithSuffix(body, currentMfrCatalogNo, currentMfrBrand);
                      const [chunk1, chunk2, chunk3, chunk4] = splitLongDescToChunks(merged);
                      setValue('longDesc1', chunk1);
                      setValue('longDesc2', chunk2);
                      setValue('longDesc3', chunk3);
                      setValue('longDesc4', chunk4);
                    }}
                  />
                  {editableLongDescription.length > 0 && !isReadOnly && (
                    <button
                      type="button"
                      onClick={() => {
                        const [chunk1, chunk2, chunk3, chunk4] = splitLongDescToChunks(
                          composeLongDescWithSuffix('', currentMfrCatalogNo, currentMfrBrand)
                        );
                        setValue('longDesc1', chunk1);
                        setValue('longDesc2', chunk2);
                        setValue('longDesc3', chunk3);
                        setValue('longDesc4', chunk4);
                      }}
                      className="absolute top-1.5 right-1.5 w-5 h-5 flex items-center justify-center rounded-full bg-gray-300 hover:bg-red-400 hover:text-white text-gray-600 text-xs transition-colors"
                      title="Clear all"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <div className="mt-2 rounded border border-dashed border-gray-300 bg-gray-50 p-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Auto-appended (Locked)</p>
                  <pre className="mt-1 whitespace-pre-wrap text-xs text-gray-700 font-mono">{lockedLongDescSuffix}</pre>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 p-2 border rounded">
                  <label htmlFor={itemIds.longDesc1} className="text-[10px] text-gray-500 block mb-1">LongDesc1 (Max 254) — <span className="font-semibold">{fullDescriptionChunks[0].length}</span>/254</label>
                  <textarea
                    id={itemIds.longDesc1}
                    name="longDesc1Preview"
                    disabled
                    className="w-full text-xs border p-1 bg-[#F5F5F5] text-gray-600 resize-none" rows={8}
                    value={fullDescriptionChunks[0]}
                    readOnly
                  />
                </div>
                <div className="bg-gray-50 p-2 border rounded">
                  <label htmlFor={itemIds.longDesc2} className="text-[10px] text-gray-500 block mb-1">LongDesc2 (Max 254) — <span className="font-semibold">{fullDescriptionChunks[1].length}</span>/254</label>
                  <textarea
                    id={itemIds.longDesc2}
                    name="longDesc2Preview"
                    disabled
                    className="w-full text-xs border p-1 bg-[#F5F5F5] text-gray-600 resize-none" rows={8}
                    value={fullDescriptionChunks[1]}
                    readOnly
                  />
                </div>
                <div className="bg-gray-50 p-2 border rounded">
                  <label htmlFor={itemIds.longDesc3} className="text-[10px] text-gray-500 block mb-1">LongDesc3 (Max 254) — <span className="font-semibold">{fullDescriptionChunks[2].length}</span>/254</label>
                  <textarea
                    id={itemIds.longDesc3}
                    name="longDesc3Preview"
                    disabled
                    className="w-full text-xs border p-1 bg-[#F5F5F5] text-gray-600 resize-none" rows={8}
                    value={fullDescriptionChunks[2]}
                    readOnly
                  />
                </div>
                <div className="bg-gray-50 p-2 border rounded">
                  <label htmlFor={itemIds.longDesc4} className="text-[10px] text-gray-500 block mb-1">LongDesc4 (Max 254) — <span className="font-semibold">{fullDescriptionChunks[3].length}</span>/254</label>
                  <textarea
                    id={itemIds.longDesc4}
                    name="longDesc4Preview"
                    disabled
                    className="w-full text-xs border p-1 bg-[#F5F5F5] text-gray-600 resize-none" rows={8}
                    value={fullDescriptionChunks[3]}
                    readOnly
                  />
                </div>
              </div>

              <div className="text-right text-xs text-gray-500">
                {fullDescription.length} / 1016 characters (includes locked suffix)
              </div>
            </div>
          )}

          {activeTab === 'attach' && (
            <div>
              {isNew && (
                <p className="mb-3 text-xs text-gray-500">
                  Attachments will be uploaded after the item is created.
                </p>
              )}
              {canManageAttachments && (
                <div className="mb-3 flex w-full justify-end">
                  <Button
                    type="button"
                    size="md"
                    variant="primary"
                    className="min-h-5 px-4 text-sm font-semibold"
                    onClick={() => setShowAddFileDialog(true)}
                  >
                    <Plus className="w-5 h-5" /> Add File
                  </Button>
                </div>
              )}

              <div className="border border-gray-200 rounded overflow-x-auto">
                <Table className="w-full min-w-[980px] text-sm">
                  <TableHeader className="bg-[#2264A0] shadow-sm sticky top-0 z-20">
                    <TableRow className="hover:bg-[#2264A0] border-b-0">
                      <TableHead className="text-white h-10 px-3 text-sm font-semibold">Category</TableHead>
                      <TableHead className="text-white h-10 px-3 text-sm font-semibold">Attachment</TableHead>
                      <TableHead className="text-white h-10 px-3 text-sm font-semibold">Updated By</TableHead>
                      <TableHead className="text-white h-10 px-3 text-sm font-semibold">Updated Date</TableHead>
                      <TableHead className="text-white h-10 px-3 text-sm font-semibold">Attachment ID</TableHead>
                      {canManageAttachments && <TableHead className="text-white h-10 px-3 w-10"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attachments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={canManageAttachments ? 6 : 5} className="text-center py-8 text-gray-400 text-sm">
                          <Paperclip className="w-5 h-5 mx-auto mb-1 text-gray-300" />
                          No attachments found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      attachments.map((att) => {
                        const attachmentId = String(att.id || '').trim();
                        const downloadUrl = att.isPending ? '' : buildAttachmentDownloadUrl(attachmentId);

                        return (
                        <TableRow key={att.id} className="hover:bg-[#E8F0F8] text-gray-700 h-10">
                          <TableCell className="px-3 py-2 border-r border-[#DDDDDD] last:border-r-0">{att.category}</TableCell>
                          <TableCell className="px-3 py-2 border-r border-[#DDDDDD] last:border-r-0 text-[#2264A0]">
                            {downloadUrl ? (
                              <a href={downloadUrl} target="_blank" rel="noreferrer" className="hover:underline">
                                {att.fileName}
                              </a>
                            ) : (
                              <span>{att.fileName}</span>
                            )}
                          </TableCell>
                          <TableCell className="px-3 py-2 border-r border-[#DDDDDD] last:border-r-0">{att.updatedBy}</TableCell>
                          <TableCell className="px-3 py-2 border-r border-[#DDDDDD] last:border-r-0">{formatDateTimeDisplay(att.updatedDate)}</TableCell>
                          <TableCell className="px-3 py-2 border-r border-[#DDDDDD] last:border-r-0 font-mono">{att.id}</TableCell>
                          {canManageAttachments && (
                            <TableCell className="px-3 py-2 border-r border-[#DDDDDD] last:border-r-0">
                              <button
                                type="button"
                                onClick={() => { void handleDeleteAttachment(att); }}
                                disabled={deletingAttachmentIds[String(att.id)] === true}
                                className={cn(
                                  "text-red-400 hover:text-red-600",
                                  deletingAttachmentIds[String(att.id)] === true && "cursor-not-allowed opacity-50"
                                )}
                                title="Remove"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </TableCell>
                          )}
                        </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {showAddFileDialog && canManageAttachments && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
                  <div className="bg-[#F0F0F0] border border-gray-400 rounded shadow-lg w-[420px]">
                    <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-[#E8E8E8] to-[#D0D0D0] border-b border-gray-300">
                      <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                        <Paperclip className="w-4 h-4" />
                        Attachments of ITEM
                      </div>
                      <button type="button" onClick={closeAddFileDialog} className="text-gray-500 hover:text-red-500">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="p-5 space-y-4">
                      <div className="flex items-center gap-3">
                        <label htmlFor={itemIds.attachmentCategory} className="text-sm text-gray-700 w-16 text-right">Category</label>
                        <InlineSelect
                          id={itemIds.attachmentCategory}
                          name="attachmentCategory"
                          value={attachCategory}
                          onValueChange={(nextValue) => setAttachCategory(nextValue)}
                          placeholder="- Select -"
                          allowClear
                          size="sm"
                          className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm bg-white"
                          options={ITEM_ATTACHMENT_CATEGORIES.map((category) => ({
                            value: category,
                            label: category,
                          }))}
                        />
                      </div>

                      <div className="flex items-center gap-3">
                        <label htmlFor={itemIds.attachmentFileName} className="text-sm text-gray-700 w-16 text-right">Upload</label>
                        <input
                          id={itemIds.attachmentFileName}
                          name="attachmentFileName"
                          type="text"
                          readOnly
                          value={attachFile?.name || ''}
                          className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm bg-white"
                          placeholder=""
                        />
                        <input
                          ref={attachFileInputRef}
                          id={itemIds.attachmentFile}
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
                        >
                          Browse
                        </Button>
                      </div>
                    </div>

                    <div className="flex justify-center gap-3 px-5 pb-4">
                      <Button type="button" size="sm" variant="primary" onClick={handleAddAttachment} className="min-w-[70px]">
                        Ok
                      </Button>
                      <Button type="button" size="sm" variant="neutral" onClick={closeAddFileDialog} className="min-w-[70px]">
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
