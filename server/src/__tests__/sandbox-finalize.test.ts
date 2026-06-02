import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from '#src/config/env.js';
import * as bulkCostRepo from '#src/repositories/bulk-cost.repository.js';
import * as sandboxMasterRepo from '#src/repositories/sandbox-master.repository.js';
import { sandboxFinalizeRun } from '#src/services/sandbox-finalize.service.js';

vi.mock('#src/config/database.js', () => {
    class MockTransaction {
        begin = vi.fn().mockResolvedValue(undefined);
        commit = vi.fn().mockResolvedValue(undefined);
        rollback = vi.fn().mockResolvedValue(undefined);
    }

    return {
        getPool: vi.fn().mockResolvedValue({}),
        sql: {
            BigInt: 'BigInt',
            Date: 'Date',
            Decimal: vi.fn(() => 'Decimal'),
            Int: 'Int',
            NVarChar: vi.fn(() => 'NVarChar'),
            Request: vi.fn(),
            Transaction: MockTransaction,
        },
    };
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('Sandbox Finalize safety guards', () => {
    const originalSandboxDb = env.DB_NAME_SANDBOX;
    const originalSapDb = env.DB_NAME_SAP;

    beforeEach(() => {
        // Reset DB env values before each test
        (env as any).DB_NAME_SANDBOX = originalSandboxDb;
        (env as any).DB_NAME_SAP = originalSapDb;
    });

    it('assertNotSapTarget() rejects when DB_NAME_SANDBOX matches PartCatalog/SAP production DB', async () => {
        (env as any).DB_NAME_SANDBOX = 'SBOQTEC';
        (env as any).DB_NAME_SAP = 'SBOQTEC';

        const mockLatest = {
            itemGroup: 104,
            manufacturer: 'Toyota',
            mfgPartNumber: 'CAT-123',
            sapDescription: 'Test Item',
            stockUOM: 'PCS',
        };

        const mockTrace = {
            runId: 999,
            lineKey: 'MANUAL-1',
            writtenBy: 'test-user',
            writtenAt: new Date().toISOString(),
        };

        await expect(
            sandboxMasterRepo.insertSandboxItem(mockLatest, mockTrace),
        ).rejects.toThrow('[SANDBOX GUARD] Refusing write: DB_NAME_SANDBOX must be "PART_CATALOG_AIX"');
    });

    it('assertNotSapTarget() rejects when DB_NAME_SANDBOX is some other DB name', async () => {
        (env as any).DB_NAME_SANDBOX = 'PART_CATALOG_QA';

        const mockLatest = {
            itemGroup: 104,
            manufacturer: 'Toyota',
            mfgPartNumber: 'CAT-123',
            sapDescription: 'Test Item',
            stockUOM: 'PCS',
        };

        const mockTrace = {
            runId: 999,
            lineKey: 'MANUAL-1',
            writtenBy: 'test-user',
            writtenAt: new Date().toISOString(),
        };

        await expect(
            sandboxMasterRepo.insertSandboxItem(mockLatest, mockTrace),
        ).rejects.toThrow('[SANDBOX GUARD] Refusing write: DB_NAME_SANDBOX must be "PART_CATALOG_AIX"');
    });
});

describe('Sandbox Finalize validation rules', () => {
    it('blocks finalize and returns validation errors for missing fields', async () => {
        const mockRun: any = {
            runId: 100,
            revisionGroupId: 100,
            revisionNo: 1,
            inputSnapshot: {
                costs: {
                    supplierCode: 'V1000',
                    exchangeRate: 34.5,
                },
            },
            previewSnapshot: {
                lines: [
                    {
                        lineKey: 'LINE-1',
                        finalResult: {
                            roundUp: 0, // Invalid sales price
                        },
                    },
                ],
            },
            lines: [
                {
                    lineKey: 'LINE-1',
                    latestSnapshot: {
                        // All required fields are missing
                        sapDescription: '',
                        itemGroup: '',
                        manufacturer: '',
                        mfgPartNumber: '',
                        stockUOM: '',
                    },
                },
            ],
        };

        vi.spyOn(bulkCostRepo, 'loadBulkCostRun').mockResolvedValue(mockRun);
        const insertItemSpy = vi.spyOn(sandboxMasterRepo, 'insertSandboxItem');

        const result = await sandboxFinalizeRun(100, 'test-user');

        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(insertItemSpy).not.toHaveBeenCalled();

        // Check specific validation error messages
        const messages = result.errors.map(e => e.message);
        expect(messages).toContain('Item Description is required');
        expect(messages).toContain('Item Group is required');
        expect(messages).toContain('Mfr Brand is required');
        expect(messages).toContain('Mfr Catalog No is required');
        expect(messages).toContain('Stock UOM is required');
        expect(messages).toContain('Calculated Sales Price must be > 0; run CAL and save revision first');
    });

    it('passes validation when subLocation is defined in runCosts fallback', async () => {
        const mockRun: any = {
            runId: 101,
            revisionGroupId: 101,
            revisionNo: 1,
            inputSnapshot: {
                costs: {
                    supplierCode: 'V1000',
                    exchangeRate: 34.5,
                    subLocation: 'Bangkok WH', // Fallback subLocation
                },
            },
            previewSnapshot: {
                lines: [
                    {
                        lineKey: 'LINE-2',
                        finalResult: {
                            roundUp: 1500, // Valid sales price
                        },
                    },
                ],
            },
            lines: [
                {
                    lineKey: 'LINE-2',
                    latestSnapshot: {
                        sapDescription: 'Valid Description',
                        itemGroup: 104,
                        manufacturer: 'Toyota',
                        mfgPartNumber: 'CAT-123',
                        stockUOM: 'PCS',
                        vendorCode: 'V1000',
                        currency: 'USD',
                        unitPrice: 100,
                        orderTerm: 'EXW',
                        location: 'JP',
                        shipModeNo: 1,
                        purchaseUOM: 'PCS',
                        saleUOM: 'PCS',
                        stockConversion: 1,
                        saleConversion: 1,
                        // latestSnapshot.subLocation is undefined, falls back to Bangkok WH
                    },
                },
            ],
        };

        vi.spyOn(bulkCostRepo, 'loadBulkCostRun').mockResolvedValue(mockRun);
        // Spy and stub repo inserts so we do not hit real database pool
        const mockItemId = 12345;
        vi.spyOn(sandboxMasterRepo, 'findExistingSandboxFinalize').mockResolvedValue(null);
        vi.spyOn(sandboxMasterRepo, 'insertSandboxItem').mockResolvedValue({ sandboxItemId: mockItemId });
        vi.spyOn(sandboxMasterRepo, 'insertSandboxTerm').mockResolvedValue({ sandboxTermId: 67890 });

        const result = await sandboxFinalizeRun(101, 'test-user');

        // Validation should succeed, so it will call sandboxMasterRepo insert
        expect(result.errors.length).toBe(0);
        expect(result.success).toBe(true);
        expect(result.written[0]?.sandboxItemId).toBe(mockItemId);
    });

    it('reuses existing sandbox finalize rows for the same run revision line instead of inserting duplicates', async () => {
        const mockRun: any = {
            runId: 102,
            revisionGroupId: 102,
            revisionNo: 1,
            inputSnapshot: {
                costs: {
                    supplierCode: 'V1000',
                    exchangeRate: 34.5,
                    subLocation: 'Bangkok WH',
                },
            },
            previewSnapshot: {
                lines: [
                    {
                        lineKey: 'LINE-3',
                        finalResult: {
                            roundUp: 1500,
                        },
                    },
                ],
            },
            lines: [
                {
                    lineKey: 'LINE-3',
                    latestSnapshot: {
                        sapDescription: 'Valid Description',
                        itemGroup: 104,
                        manufacturer: 'Toyota',
                        mfgPartNumber: 'CAT-123',
                        stockUOM: 'PCS',
                        vendorCode: 'V1000',
                        currency: 'USD',
                        unitPrice: 100,
                        orderTerm: 'EXW',
                        location: 'JP',
                        shipModeNo: 1,
                        purchaseUOM: 'PCS',
                        saleUOM: 'PCS',
                        stockConversion: 1,
                        saleConversion: 1,
                    },
                },
            ],
        };

        vi.spyOn(bulkCostRepo, 'loadBulkCostRun').mockResolvedValue(mockRun);
        vi.spyOn(sandboxMasterRepo, 'findExistingSandboxFinalize').mockResolvedValue({
            sandboxItemId: 222,
            sandboxTermId: 333,
        });
        const insertItemSpy = vi.spyOn(sandboxMasterRepo, 'insertSandboxItem');
        const insertTermSpy = vi.spyOn(sandboxMasterRepo, 'insertSandboxTerm');

        const result = await sandboxFinalizeRun(102, 'test-user');

        expect(result.success).toBe(true);
        expect(result.written).toEqual([
            { lineKey: 'LINE-3', sandboxItemId: 222, sandboxTermId: 333, reused: true },
        ]);
        expect(insertItemSpy).not.toHaveBeenCalled();
        expect(insertTermSpy).not.toHaveBeenCalled();
    });

    it('blocks retry when an existing sandbox item is found without a matching sandbox term', async () => {
        const mockRun: any = {
            runId: 103,
            revisionGroupId: 103,
            revisionNo: 1,
            inputSnapshot: {
                costs: {
                    supplierCode: 'V1000',
                    exchangeRate: 34.5,
                    subLocation: 'Bangkok WH',
                },
            },
            previewSnapshot: {
                lines: [
                    {
                        lineKey: 'LINE-4',
                        finalResult: {
                            roundUp: 1500,
                        },
                    },
                ],
            },
            lines: [
                {
                    lineKey: 'LINE-4',
                    latestSnapshot: {
                        sapDescription: 'Valid Description',
                        itemGroup: 104,
                        manufacturer: 'Toyota',
                        mfgPartNumber: 'CAT-123',
                        stockUOM: 'PCS',
                        vendorCode: 'V1000',
                        currency: 'USD',
                        unitPrice: 100,
                        orderTerm: 'EXW',
                        location: 'JP',
                        shipModeNo: 1,
                        purchaseUOM: 'PCS',
                        saleUOM: 'PCS',
                        stockConversion: 1,
                        saleConversion: 1,
                    },
                },
            ],
        };

        vi.spyOn(bulkCostRepo, 'loadBulkCostRun').mockResolvedValue(mockRun);
        vi.spyOn(sandboxMasterRepo, 'findExistingSandboxFinalize').mockResolvedValue({
            sandboxItemId: 444,
            sandboxTermId: null,
        });
        const insertItemSpy = vi.spyOn(sandboxMasterRepo, 'insertSandboxItem');

        const result = await sandboxFinalizeRun(103, 'test-user');

        expect(result.success).toBe(false);
        expect(result.errors[0]?.message).toContain('Existing sandbox item found');
        expect(insertItemSpy).not.toHaveBeenCalled();
    });
});
