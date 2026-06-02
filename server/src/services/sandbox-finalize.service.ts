/**
 * Sandbox Finalize Service
 *
 * Orchestrates: Load DraftItem/DraftTerm → Validate → Write to PART_CATALOG_AIX mirror.
 * This is a "Sandbox Finalize / Dry-run Master Write" — NOT production
 * PartCatalog/SAP. Production PartCatalog Item/Term writes target SBOQTEC.
 *
 * SAFETY: The repository layer (sandbox-master.repository) enforces the AIX guard.
 */

import * as bulkCostRepo from '#src/repositories/bulk-cost.repository.js';
import * as sandboxMasterRepo from '#src/repositories/sandbox-master.repository.js';
import { getPool, sql } from '#src/config/database.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SandboxFinalizeError {
    lineKey: string;
    message: string;
    field?: string;
}

export interface SandboxFinalizeWritten {
    lineKey: string;
    sandboxItemId: number;
    sandboxTermId: number;
    reused?: boolean;
}

export interface SandboxFinalizeResult {
    success: boolean;
    written: SandboxFinalizeWritten[];
    errors: SandboxFinalizeError[];
    sandboxDb: string;
}

// ─── Validation ───────────────────────────────────────────────────────────────

interface ValidationError {
    field: string;
    message: string;
}

function text(value: unknown): string {
    if (value === null || value === undefined) return '';
    return String(value).trim();
}

function numberValue(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function isPositive(value: unknown): boolean {
    return numberValue(value) > 0;
}

function isIntegerLike(value: unknown): boolean {
    const parsed = Number(value);
    return Number.isInteger(parsed);
}

function validateSandboxLine(
    latest: Record<string, unknown>,
    runCosts: Record<string, unknown>,
    finalResult: Record<string, unknown>,
): ValidationError[] {
    const errors: ValidationError[] = [];

    // Item required fields
    if (!text(latest.sapDescription)) errors.push({ field: 'sapDescription', message: 'Item Description is required' });
    if (!text(latest.itemGroup)) errors.push({ field: 'itemGroup', message: 'Item Group is required' });
    if (text(latest.itemGroup) && !isIntegerLike(latest.itemGroup)) errors.push({ field: 'itemGroup', message: 'Item Group must be a valid code' });
    if (!text(latest.manufacturer)) errors.push({ field: 'manufacturer', message: 'Mfr Brand is required' });
    if (!text(latest.mfgPartNumber)) errors.push({ field: 'mfgPartNumber', message: 'Mfr Catalog No is required' });
    if (!text(latest.stockUOM) && !text(latest.uom)) errors.push({ field: 'stockUOM', message: 'Stock UOM is required' });

    // Term required fields
    const vendorCode = text(latest.vendorCode) || text(runCosts.supplierCode);
    if (!vendorCode) errors.push({ field: 'vendorCode', message: 'Supplier / Vendor Code is required' });
    if (!text(latest.currency)) errors.push({ field: 'currency', message: 'Currency is required' });
    if (!isPositive(runCosts.exchangeRate)) errors.push({ field: 'exchangeRate', message: 'Exchange Rate must be > 0' });
    if (numberValue(latest.unitPrice) <= 0) errors.push({ field: 'unitPrice', message: 'Unit Price must be > 0' });
    if (!text(latest.orderTerm)) errors.push({ field: 'orderTerm', message: 'Purchase Term is required' });
    if (!text(latest.location)) errors.push({ field: 'location', message: 'Term Location is required' });
    const subLocation = text(latest.subLocation) || text(runCosts.subLocation);
    if (!subLocation) errors.push({ field: 'subLocation', message: 'Sub Location is required' });
    if (!isIntegerLike(latest.shipModeNo)) errors.push({ field: 'shipModeNo', message: 'Ship Mode is required' });
    if (!text(latest.purchaseUOM)) errors.push({ field: 'purchaseUOM', message: 'Purchase UOM is required' });
    if (!text(latest.saleUOM)) errors.push({ field: 'saleUOM', message: 'Sales UOM is required' });
    if (!isPositive(latest.stockConversion)) errors.push({ field: 'stockConversion', message: 'Stock Conv. must be > 0' });
    if (!isPositive(latest.saleConversion)) errors.push({ field: 'saleConversion', message: 'Sales Conv. must be > 0' });
    if (!isPositive(finalResult.roundUp)) errors.push({ field: 'salesPrice', message: 'Calculated Sales Price must be > 0; run CAL and save revision first' });

    return errors;
}

// ─── Service ─────────────────────────────────────────────────────────────────

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

export async function sandboxFinalizeRun(
    runId: number,
    writtenBy: string,
): Promise<SandboxFinalizeResult> {
    const { env } = await import('#src/config/env.js');
    const sandboxDb = env.DB_NAME_SANDBOX;

    // Load the saved run from QTEC DB
    const run = await bulkCostRepo.loadBulkCostRun(runId);
    if (!run) {
        const err = new Error(`Run #${runId} not found`) as Error & { statusCode?: number };
        err.statusCode = 404;
        throw err;
    }

    const runCosts = asRecord(asRecord(run.inputSnapshot).costs);
    const previewLines: Record<string, Record<string, unknown>> = {};
    for (const previewLine of (asRecord(run.previewSnapshot).lines ?? []) as Record<string, unknown>[]) {
        const key = String(previewLine.lineKey ?? '');
        if (key) previewLines[key] = previewLine;
    }

    const written: SandboxFinalizeWritten[] = [];
    const errors: SandboxFinalizeError[] = [];
    const writtenAt = new Date().toISOString();

    for (const line of run.lines) {
        const latest = asRecord(line.latestSnapshot);
        const finalResult = asRecord(asRecord(previewLines[line.lineKey] ?? {}).finalResult);

        // Validate
        const validationErrors = validateSandboxLine(latest, runCosts, finalResult);
        if (validationErrors.length > 0) {
            for (const ve of validationErrors) {
                errors.push({ lineKey: line.lineKey, message: ve.message, field: ve.field });
            }
            continue;
        }

        const trace: sandboxMasterRepo.SandboxWriteTrace = {
            runId,
            revisionGroupId: run.revisionGroupId,
            revisionNo: run.revisionNo,
            lineKey: line.lineKey,
            writtenBy,
            writtenAt,
        };

        let transaction: sql.Transaction | null = null;
        try {
            const existing = await sandboxMasterRepo.findExistingSandboxFinalize(trace);
            if (existing?.sandboxItemId) {
                if (existing.sandboxTermId) {
                    written.push({
                        lineKey: line.lineKey,
                        sandboxItemId: existing.sandboxItemId,
                        sandboxTermId: existing.sandboxTermId,
                        reused: true,
                    });
                } else {
                    errors.push({
                        lineKey: line.lineKey,
                        message: `Existing sandbox item found for this revision/line without a matching term (ItemID ${existing.sandboxItemId}). Review AIX mirror data before retrying.`,
                    });
                }
                continue;
            }

            const pool = await getPool();
            transaction = new sql.Transaction(pool);
            await transaction.begin();

            // 1. INSERT item into AIX [@POITM]
            const { sandboxItemId } = await sandboxMasterRepo.insertSandboxItem(latest, trace, transaction);

            // 2. INSERT term into AIX [@PITM1]
            const { sandboxTermId } = await sandboxMasterRepo.insertSandboxTerm(
                sandboxItemId,
                latest,
                finalResult,
                runCosts,
                trace,
                transaction,
            );

            await transaction.commit();
            transaction = null;

            written.push({ lineKey: line.lineKey, sandboxItemId, sandboxTermId });
        } catch (err) {
            if (transaction) {
                try {
                    await transaction.rollback();
                } catch {
                    // Preserve the original write error; rollback failure is secondary.
                }
            }
            errors.push({
                lineKey: line.lineKey,
                message: err instanceof Error ? err.message : String(err),
            });
        }
    }

    return {
        success: errors.length === 0,
        written,
        errors,
        sandboxDb,
    };
}
