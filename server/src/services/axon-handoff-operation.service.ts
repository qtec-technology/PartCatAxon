import * as axonHandoffRepo from '#src/repositories/axon-handoff.repository.js';
import type { AxonComparison, LoadAxonComparisonInput } from '#src/types/axon-handoff.types.js';

export async function loadAxonComparison(input: LoadAxonComparisonInput): Promise<AxonComparison | null> {
    return axonHandoffRepo.loadAxonComparison(input);
}
