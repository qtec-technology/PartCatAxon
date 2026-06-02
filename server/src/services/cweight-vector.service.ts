/**
 * CWeight Vector Search - prototype interface.
 *
 * Scope: description / category / brand token matching only.
 * Output: ranked Grainger No candidates - NO weight data.
 * Callers must query the SQL weight table for each candidate to obtain actual weight.
 *
 * Rules:
 * - Never returns AUTO_ACCEPT; best possible result after SQL lookup is REVIEW_SUGGESTION.
 * - No internet calls; no API keys.
 * - Empty array = NOT_FOUND at this layer.
 */

export interface CWeightVectorInput {
    description?: string | null;
    category1?: string | null;
    category2?: string | null;
    category3?: string | null;
    manufacturerName?: string | null;
}

export interface CWeightVectorCandidate {
    /** Grainger No to look up in the SQL weight table. */
    graingerNo: string;
    /** Confidence score in [0, 1]. Must stay below the AUTO_ACCEPT threshold. */
    confidence: number;
    /** Human-readable reason describing why this candidate was suggested. */
    reason: string;
}

/**
 * Prototype stub - returns an empty candidate list until a local vector index is built.
 *
 * Future implementation steps:
 * 1. Build a TF-IDF or embedding index from @GRAINGER_CWEIGHT description + category columns.
 * 2. Score the input tokens against the index.
 * 3. Return top-N candidates above a minimum confidence threshold.
 * 4. Cap confidence at < 0.85 so downstream decisions stay REVIEW_SUGGESTION.
 */
export async function findCWeightVectorCandidates(
    _input: CWeightVectorInput,
): Promise<CWeightVectorCandidate[]> {
    return [];
}
