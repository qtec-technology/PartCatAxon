/**
 * Pure number / display formatting utilities for the Bulk Cost Workspace.
 * No React imports — safe to import from both .ts and .tsx files.
 */

export function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

/** Display value with 2 decimal places, or '-' when absent/non-finite. */
export function fmt(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** fmt that returns '' instead of '-' (used in source-data cells). */
export function fmtPlain(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  return fmt(value);
}

/** Same as fmtPlain but accepts explicit null as empty string. */
export function fmtNullablePlain(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : fmtPlain(value);
}

/** Used in audit / formula columns — numbers use fmt, strings pass through. */
export function fmtAuditValue(value: number | string | null): string {
  if (typeof value === 'number') return fmt(value);
  return value ?? '-';
}

/** Formats a number for display in a form cell; nullable=true returns '' instead of '0.00'. */
export function formatDisplayNumber(value: number | null | undefined, nullable = false): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return nullable ? '' : '0.00';
  return fmt(value);
}

export function formatMatchStatus(itemCode: string): string {
  return itemCode.trim() ? 'Existing' : 'New Item';
}

/** Converts a stored number to an editable string (no trailing zeros). */
export function toEditableNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  return String(round6(value));
}

export function pct(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

/** Display weight value with up to 4 decimal places, or '-' when absent. */
export function fmtWeight(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

/** fmtWeight that returns '' instead of '-' (used in source-data cells). */
export function fmtWeightPlain(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  return fmtWeight(value);
}

/** Same as fmtWeightPlain but accepts explicit null as empty string. */
export function fmtNullableWeightPlain(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : fmtWeightPlain(value);
}
