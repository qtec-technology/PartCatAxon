/**
 * Port of VBA FixQuote() — Prevent SQL injection via single/double quotes.
 * Used for parameterized query fallback (prefer using mssql params instead).
 */
export function fixQuote(input: string): string {
    return input.replace(/'/g, "''").replace(/"/g, '""');
}

/**
 * Port of VBA FixNewLine() — Remove line breaks from input.
 */
export function fixNewLine(input: string): string {
    return input.replace(/\r?\n/g, '');
}

/**
 * Keep English/Thai letters, numbers, and spaces.
 * This keeps legacy safety intent while allowing Thai keyword search.
 */
export function alphaNumericOnly(input: string): string {
    return input.replace(/[^a-zA-Z0-9\u0E00-\u0E7F ]/g, '');
}

/**
 * Sanitize search input: remove newlines, then special characters.
 * Call order mirrors legacy: FixNewLine → AlphaNumericOnly → FixQuote
 */
export function sanitizeSearchInput(input: string): string {
    let clean = fixNewLine(input);
    clean = alphaNumericOnly(clean);
    return clean.trim();
}
