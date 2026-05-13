export const readFileAsDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
        const result = reader.result;
        if (typeof result === 'string' && result.length > 0) {
            resolve(result);
            return;
        }
        reject(new Error('Failed to read file'));
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
});

export const hasAllowedFileExtension = (fileName: string, allowedExtensions: string[]): boolean => {
    const normalizedName = String(fileName || '').trim().toLowerCase();
    return allowedExtensions.some((ext) => normalizedName.endsWith(ext.toLowerCase()));
};
