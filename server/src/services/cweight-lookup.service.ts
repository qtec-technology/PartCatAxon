import { findGraingerCWeightExactMatch } from '#src/repositories/cweight.repository.js';
import { resolveChargeableWeight, type CWeightResolveInput, type CWeightResult, type CWeightLocalResearchMatch } from '#src/services/cweight.service.js';

export interface CWeightLookupInput extends CWeightResolveInput {
    supplierOrderCode?: string | null;
    manufacturerPartNo?: string | null;
    manufacturerName?: string | null;
}

export interface CWeightLookupRepository {
    findGraingerCWeightExactMatch(input: CWeightLookupInput): Promise<CWeightLocalResearchMatch | null>;
}

const defaultRepository: CWeightLookupRepository = {
    findGraingerCWeightExactMatch,
};

export async function resolveCWeightLookup(
    input: CWeightLookupInput,
    repository: CWeightLookupRepository = defaultRepository,
): Promise<CWeightResult> {
    const directResult = resolveChargeableWeight(input);
    if (directResult.source === 'direct_formula') {
        return directResult;
    }

    const localMatch = await repository.findGraingerCWeightExactMatch(input);
    return resolveChargeableWeight({ ...input, localMatch });
}
