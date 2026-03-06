/**
 * Port of VBA SplitEvery() + SplitTextIntoLongDesc()
 * Splits long description text into 4 parts of max 254 characters each.
 * Total max: 1,016 characters.
 */
export function splitLongDescription(
    text: string,
    chunkSize: number = 254,
    maxChunks: number = 4
): string[] {
    const maxLength = chunkSize * maxChunks;
    const trimmed = text.substring(0, maxLength);
    const result: string[] = [];

    for (let i = 0; i < maxChunks; i++) {
        const start = i * chunkSize;
        const chunk = trimmed.substring(start, start + chunkSize);
        result.push(chunk || '');
    }

    return result;
}

/**
 * Combine LongDesc1-4 back into a single string.
 */
export function combineLongDescription(
    parts: (string | null | undefined)[]
): string {
    return parts
        .filter((p): p is string => p != null && p.length > 0)
        .join('')
        .trim();
}
