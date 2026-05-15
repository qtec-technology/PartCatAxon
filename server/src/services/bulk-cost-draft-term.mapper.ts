export interface DraftTermFreightMappingInput {
    latest: Record<string, unknown>;
    finalResult: Record<string, unknown>;
}

export interface DraftTermFreightFields {
    /** Actual freight input used by CIF/QLC. */
    uFr: number;
    /** Reference Term field: ShipWeightCal * FreightRate. */
    uFreightQtec: number;
}

export function mapDraftTermFreightFields({
    latest,
    finalResult,
}: DraftTermFreightMappingInput): DraftTermFreightFields {
    const shipWeightCal = numberValue(finalResult.shipWeightCal, 0);
    const freightRate = numberValue(latest.freightRate, 0);

    return {
        uFr: numberValue(finalResult.frQTEC, 0),
        uFreightQtec: round6(shipWeightCal * freightRate),
    };
}

function numberValue(value: unknown, fallback = 0): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function round6(value: number): number {
    return Math.round(value * 1000000) / 1000000;
}
