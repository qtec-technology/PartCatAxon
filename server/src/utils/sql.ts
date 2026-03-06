/**
 * Bracket-escapes a SQL identifier.
 * Prevents injection via table/column names by wrapping in [ ] and escaping ] as ]].
 */
export function toSqlIdentifier(name: string): string {
    return `[${String(name || '').replace(/]/g, ']]')}]`;
}
