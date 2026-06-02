import { findGraingerCWeightExactMatch, findGraingerCWeightNormalizedMatch, findGraingerCWeightByDescription, findGraingerCWeightCandidates, type GraingerCWeightDescriptionInput } from '#src/repositories/cweight.repository.js';
import { resolveChargeableWeight, type CWeightResolveInput, type CWeightResult, type CWeightLocalResearchMatch, type CWeightCandidate } from '#src/services/cweight.service.js';
import { findCWeightVectorCandidates, type CWeightVectorInput, type CWeightVectorCandidate } from '#src/services/cweight-vector.service.js';

export type { CWeightVectorInput, CWeightVectorCandidate, CWeightCandidate };

export interface CWeightLookupInput extends CWeightResolveInput {
    /** Explicit Grainger No (merged with supplierOrderCode when both are present; supplierOrderCode takes priority). */
    graingerNo?: string | null;
    supplierOrderCode?: string | null;
    manufacturerPartNo?: string | null;
    manufacturerName?: string | null;
    /** Product description — used as input for vector search fallback. */
    description?: string | null;
    category1?: string | null;
    category2?: string | null;
    category3?: string | null;
}

export interface CWeightLookupRepository {
    findGraingerCWeightExactMatch(input: CWeightLookupInput): Promise<CWeightLocalResearchMatch | null>;
    /** Normalized MFG Part No fallback (step 3.5). Strips dashes, spaces, dots before comparing. */
    findGraingerCWeightNormalizedMatch?(input: CWeightLookupInput): Promise<CWeightLocalResearchMatch | null>;
    /** Description keyword SQL search (step 4). */
    findGraingerCWeightByDescription?(input: GraingerCWeightDescriptionInput): Promise<CWeightLocalResearchMatch | null>;
    /** Returns up to 5 candidates for ambiguous MFG Part No matches. */
    findGraingerCWeightCandidates?(input: CWeightLookupInput): Promise<CWeightCandidate[]>;
    /** Optional vector search. When omitted, vector fallback is skipped. */
    findCWeightVectorCandidates?(input: CWeightVectorInput): Promise<CWeightVectorCandidate[]>;
}

const defaultRepository: CWeightLookupRepository = {
    findGraingerCWeightExactMatch,
    findGraingerCWeightNormalizedMatch,
    findGraingerCWeightByDescription,
    findGraingerCWeightCandidates,
    findCWeightVectorCandidates,
};

export async function resolveCWeightLookup(
    input: CWeightLookupInput,
    repository: CWeightLookupRepository = defaultRepository,
): Promise<CWeightResult> {
    // 1. Direct formula — fastest path, most reliable; user-supplied dimensions/weight.
    const directResult = resolveChargeableWeight(input);
    if (directResult.source === 'direct_formula') {
        return directResult;
    }

    // 2. Normalise graingerNo as a fallback for supplierOrderCode.
    const effectiveSupplierCode = cleanCode(input.supplierOrderCode) ?? cleanCode(input.graingerNo) ?? null;
    const lookupInput: CWeightLookupInput = effectiveSupplierCode !== cleanCode(input.supplierOrderCode)
        ? { ...input, supplierOrderCode: effectiveSupplierCode }
        : input;

    // 3. Exact lookup — Grainger No or MFG Part No ± Brand.
    const localMatch = await repository.findGraingerCWeightExactMatch(lookupInput);
    if (localMatch !== null) {
        const result = resolveChargeableWeight({ ...lookupInput, localMatch });
        return attachCandidatesIfSemantic(result, lookupInput, repository);
    }

    // 3.5. Normalized MFG Part No — strips dashes, spaces, dots before comparing.
    if (repository.findGraingerCWeightNormalizedMatch && cleanCode(lookupInput.manufacturerPartNo)) {
        const normalizedMatch = await repository.findGraingerCWeightNormalizedMatch(lookupInput);
        if (normalizedMatch !== null) {
            const result = resolveChargeableWeight({ ...lookupInput, localMatch: normalizedMatch });
            return attachCandidatesIfSemantic(result, lookupInput, repository);
        }
    }

    // 4. Description keyword SQL search — uses [SHORT DESC] LIKE patterns.
    if (repository.findGraingerCWeightByDescription && cleanCode(input.description)) {
        const descMatch = await repository.findGraingerCWeightByDescription({
            description: input.description!,
            category1: input.category1,
            manufacturerName: input.manufacturerName,
        });
        if (descMatch !== null) {
            const result = resolveChargeableWeight({ ...lookupInput, localMatch: descMatch });
            return attachCandidatesIfSemantic(result, lookupInput, repository);
        }
    }

    // 5. Vector search fallback — returns Grainger No candidates only; never AUTO_ACCEPT.
    if (repository.findCWeightVectorCandidates) {
        const vectorInput: CWeightVectorInput = {
            description: input.description,
            category1: input.category1,
            category2: input.category2,
            category3: input.category3,
            manufacturerName: input.manufacturerName,
        };
        const candidates = await repository.findCWeightVectorCandidates(vectorInput);
        for (const candidate of candidates) {
            const vectorMatch = await repository.findGraingerCWeightExactMatch({
                supplierOrderCode: candidate.graingerNo,
            });
            if (vectorMatch !== null) {
                const vectorLocalMatch: CWeightLocalResearchMatch = {
                    ...vectorMatch,
                    decision: 'REVIEW_SUGGESTION',
                    source: 'vector_candidate',
                    confidence: Math.min(vectorMatch.confidence, candidate.confidence),
                    reason: `${candidate.reason} Weight data from Grainger No ${candidate.graingerNo}.`,
                };
                return resolveChargeableWeight({ ...lookupInput, localMatch: vectorLocalMatch });
            }
        }
    }

    // 5. NOT_FOUND — return null weights; UI must block CAL or prompt manual entry.
    return resolveChargeableWeight({ ...lookupInput, localMatch: null });
}

function cleanCode(value: string | null | undefined): string | null {
    const s = String(value ?? '').trim();
    return s.length > 0 ? s : null;
}

/** Fetches alternatives for the user to pick when the result is a semantic match and a MFG part no is available. */
async function attachCandidatesIfSemantic(
    result: CWeightResult,
    input: CWeightLookupInput,
    repository: CWeightLookupRepository,
): Promise<CWeightResult> {
    if (result.source !== 'local_semantic_match') return result;
    if (!repository.findGraingerCWeightCandidates) return result;
    if (!cleanCode(input.manufacturerPartNo)) return result;
    const candidates = await repository.findGraingerCWeightCandidates(input);
    return candidates.length > 1 ? { ...result, candidates } : result;
}
