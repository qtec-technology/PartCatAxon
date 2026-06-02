import * as bulkCostRepo from '#src/repositories/bulk-cost.repository.js';
import * as cwRepo from '#src/repositories/cost-workspace.repository.js';
import {
    assertBulkCostPreviewHasNoCalculationErrors,
    buildAuthoritativeBulkCostDraft,
    type AllocationPreview,
} from '#src/services/bulk-cost-calculation.service.js';
import type {
    BulkCostRunStatus,
    LoadedBulkCostRun,
    SaveBulkCostRunInput,
    SavedBulkCostRun,
} from '#src/types/bulk-cost.types.js';

export type OperationActorType = 'human' | 'service' | 'ai_assistant';

export interface OperationActor {
    type: OperationActorType;
    displayName: string;
    id?: string;
    sourceSystem?: string;
}

export interface ListBulkCostRunsOperationInput {
    status?: BulkCostRunStatus;
    search?: string;
    saleIncharge?: string;
    page?: number;
    pageSize?: number;
}

export function humanActor(displayName: string): OperationActor {
    return {
        type: 'human',
        displayName: displayName || 'Unknown',
        sourceSystem: 'PartCatalogAxon',
    };
}

function actorName(actor: OperationActor): string {
    return actor.displayName || actor.id || actor.type;
}

export async function saveBulkCostDraft(
    input: SaveBulkCostRunInput,
    actor: OperationActor,
): Promise<SavedBulkCostRun> {
    const authoritativeDraft = buildAuthoritativeBulkCostDraft(input);
    assertBulkCostPreviewHasNoCalculationErrors(authoritativeDraft.preview as unknown as AllocationPreview);
    const result = await bulkCostRepo.createBulkCostRun(authoritativeDraft, actorName(actor));

    // Dual-write to new CostWorkspace tables (non-fatal — old flow must not break)
    cwRepo
        .createCwRun(authoritativeDraft, result.runId, actorName(actor))
        .catch((err: unknown) => {
            const message = err instanceof Error ? err.message : String(err);
            console.warn(`[CostWorkspace] dual-write failed for legacy runId=${result.runId}: ${message}`);
        });

    return result;
}

export async function listBulkCostRuns(input: ListBulkCostRunsOperationInput) {
    return bulkCostRepo.listBulkCostRuns(input);
}

export async function loadBulkCostRun(runId: number): Promise<LoadedBulkCostRun | null> {
    return bulkCostRepo.loadBulkCostRun(runId);
}

export async function markBulkCostRunStatus(
    runId: number,
    status: 'AWARDED' | 'LOST',
    actor: OperationActor,
): Promise<void> {
    await bulkCostRepo.updateBulkCostRunStatus(runId, status, actorName(actor));
}
