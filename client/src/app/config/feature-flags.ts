const parseBooleanEnv = (raw: string | undefined, defaultValue: boolean): boolean => {
    if (raw === undefined) return defaultValue;
    const normalized = raw.trim().toLowerCase();

    if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;

    return defaultValue;
};

export const featureFlags = {
    // Keep defaults aligned with current behavior unless env overrides.
    readOnlyMode: parseBooleanEnv(import.meta.env.VITE_READ_ONLY_MODE, false),
    enableAddItem: parseBooleanEnv(import.meta.env.VITE_ENABLE_ADD_ITEM, true),
} as const;
