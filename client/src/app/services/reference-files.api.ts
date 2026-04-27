export const referenceFileApi = {
    getUrl: (key: string): string => `/api/reference-files/${encodeURIComponent(key)}`,
} as const;
