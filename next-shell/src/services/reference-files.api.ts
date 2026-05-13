/**
 * Map of reference file keys to their file extension and MS Office protocol.
 * Only entries with a protocol will use the Office protocol handler;
 * all others open normally in the browser (inline PDF/image).
 */
const OFFICE_FILES: Record<string, { ext: string; protocol: string }> = {
    'uom-manual':                  { ext: '.ppsx', protocol: 'ms-powerpoint:ofe|u|' },
    'standard-custom-cost-table':  { ext: '.xlsx', protocol: 'ms-excel:ofe|u|' },
    'domestic-agent-price-table':  { ext: '.xlsx', protocol: 'ms-excel:ofe|u|' },
};

export const referenceFileApi = {
    /** Standard API URL (for PDF, images, or direct download). */
    getUrl: (key: string): string => `/api/reference-files/${encodeURIComponent(key)}`,

    /**
     * Build a URL that opens the file directly in the associated Office app.
     * Appends the real file extension so Office recognises the file type.
     * Falls back to a normal API URL for non-Office files (PDF, images).
     */
    getOfficeUrl: (key: string): string => {
        const office = OFFICE_FILES[key];
        if (!office) {
            // Non-Office file → open normally in browser
            return `/api/reference-files/${encodeURIComponent(key)}`;
        }
        // Build full URL with file extension so Office knows the file type
        const apiPath = `/api/reference-files/${encodeURIComponent(key)}${office.ext}`;
        const fullUrl = `${window.location.origin}${apiPath}`;
        return `${office.protocol}${fullUrl}`;
    },

    /** Check whether a given key will use an Office protocol. */
    isOfficeFile: (key: string): boolean => key in OFFICE_FILES,
} as const;
