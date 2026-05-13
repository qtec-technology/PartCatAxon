import { format } from 'date-fns';
import type { ItemData } from '../../../types/item_types';

export interface AttachmentItem {
  id: string;
  category: string;
  fileName: string;
  updatedBy: string;
  updatedDate: string;
  isPending?: boolean;
  file?: File | null;
}

export interface ItemSaveAttachmentInput {
  category: string;
  fileName: string;
  file: File;
}

export interface ItemFormSaveOptions {
  pendingAttachments: ItemSaveAttachmentInput[];
  imageFile: File | null;
}

export interface ItemFormElementIds {
  mfrBrand: string;
  longDescriptionInput: string;
  longDesc1: string;
  longDesc2: string;
  longDesc3: string;
  longDesc4: string;
  attachmentCategory: string;
  attachmentFileName: string;
  attachmentFile: string;
  permitType: string;
  hsCode: string;
  generalSpec: string;
  referenceUrl: string;
  imageUpload: string;
  updatedBy: string;
  updatedDate: string;
}

export const EMPTY_ATTACHMENTS: AttachmentItem[] = [];

export const LONG_DESC_CHUNK_SIZE = 254;
export const LONG_DESC_MAX_LENGTH = LONG_DESC_CHUNK_SIZE * 4;
const GENERATED_LONG_DESC_SUFFIX_REGEX = /(?:\r?\n)?P\/N:\s*[^\r\n]*\r?\nMFG:\s*[^\r\n]*\s*$/i;

export const ITEM_ATTACHMENT_CATEGORIES = [
  'Item-Certificate',
  'MSDS',
  'Picture',
  'Spec.Sheet',
  'Other',
] as const;

export const splitLongDescToChunks = (text: string): [string, string, string, string] => {
  const clipped = text.slice(0, LONG_DESC_MAX_LENGTH);
  return [
    clipped.slice(0, LONG_DESC_CHUNK_SIZE),
    clipped.slice(LONG_DESC_CHUNK_SIZE, LONG_DESC_CHUNK_SIZE * 2),
    clipped.slice(LONG_DESC_CHUNK_SIZE * 2, LONG_DESC_CHUNK_SIZE * 3),
    clipped.slice(LONG_DESC_CHUNK_SIZE * 3, LONG_DESC_CHUNK_SIZE * 4),
  ];
};

export const buildLongDescFooter = (mfrCatalogNo: string, mfrBrand: string): string => {
  const pn = String(mfrCatalogNo || '').trim();
  const mfg = String(mfrBrand || '').trim();
  return `P/N: ${pn}\r\nMFG: ${mfg}`;
};

export const stripGeneratedLongDescSuffix = (text: string): string =>
  String(text || '')
    .replace(GENERATED_LONG_DESC_SUFFIX_REGEX, '');

export const composeLongDescWithSuffix = (
  baseText: string,
  mfrCatalogNo: string,
  mfrBrand: string
): string => {
  const body = stripGeneratedLongDescSuffix(baseText);
  const footer = buildLongDescFooter(mfrCatalogNo, mfrBrand);
  const merged = body.length > 0 ? `${body}\r\n${footer}` : footer;
  return merged.slice(0, LONG_DESC_MAX_LENGTH);
};

export const buildLongDescWithSuffix = (data: ItemData): [string, string, string, string] => {
  const baseLongDesc = [
    String(data.longDesc1 || ''),
    String(data.longDesc2 || ''),
    String(data.longDesc3 || ''),
    String(data.longDesc4 || ''),
  ].join('');

  const merged = composeLongDescWithSuffix(baseLongDesc, data.mfrCatalogNo, data.mfrBrand);
  return splitLongDescToChunks(merged);
};

export const formatDateTimeDisplay = (rawValue: string): string => {
  const value = String(rawValue || '').trim();
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return format(parsed, 'dd-MMM-yyyy HH:mm:ss');
};

export const normalizeReferenceUrl = (rawUrl: string): string => {
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
};
