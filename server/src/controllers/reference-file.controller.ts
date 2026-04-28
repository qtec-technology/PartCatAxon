import fs from 'node:fs/promises';
import path from 'node:path';
import { Request, Response, NextFunction } from 'express';
import { env } from '#src/config/env.js';
import { error } from '#src/utils/response.js';

type ReferenceFileConfig = {
    filePath: string;
    fileName: string;
};

const referenceFiles: Record<string, ReferenceFileConfig> = {
    'incoterms-2020-pdf': {
        filePath: env.REF_FILE_INCOTERMS_2020_PDF,
        fileName: 'incoterms2020_summary.pdf',
    },
    'incoterms-chart': {
        filePath: env.REF_FILE_INCOTERMS_CHART,
        fileName: 'Incoterms2020.jpg',
    },
    'uom-manual': {
        filePath: env.REF_FILE_UOM_MANUAL,
        fileName: 'UOM.ppsx',
    },
    'standard-custom-cost-table': {
        filePath: env.REF_FILE_STANDARD_CUSTOM_COST_TABLE,
        fileName: 'STD Customs Cost.xlsx',
    },
    'domestic-agent-price-table': {
        filePath: env.REF_FILE_DOMESTIC_AGENT_PRICE_TABLE,
        fileName: 'DomesticAgent.xlsx',
    },
};

function toSafeHeaderFileName(fileName: string): string {
    return String(fileName || 'reference-file')
        .replace(/[^\w .()-]/g, '_')
        .trim() || 'reference-file';
}

export async function openReferenceFile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const rawKey = String(req.params.key || '').trim().toLowerCase();
        const key = rawKey.replace(/\.(xlsx|xls|ppsx|pptx|ppt|pdf|jpg|jpeg|png)$/, '');
        const referenceFile = referenceFiles[key];

        if (!referenceFile) {
            res.status(404).json(error('Reference file is not configured'));
            return;
        }

        const resolvedPath = path.resolve(referenceFile.filePath);
        try {
            await fs.access(resolvedPath);
        } catch {
            res.status(404).json(error('Reference file was not found or cannot be accessed by the API service account'));
            return;
        }

        const safeFileName = toSafeHeaderFileName(referenceFile.fileName);
        res.setHeader('Content-Disposition', `inline; filename="${safeFileName}"`);
        res.sendFile(resolvedPath);
    } catch (err) {
        next(err);
    }
}
