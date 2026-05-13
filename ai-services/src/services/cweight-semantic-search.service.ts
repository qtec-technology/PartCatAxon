import type { CsvRecord } from "./cweight-sample-analyzer.service.js";

export interface CWeightSearchDocument {
  id: string;
  description: string;
  row: CsvRecord;
}

export interface CWeightSemanticSearchHit {
  document: CWeightSearchDocument;
  score: number;
  secondScore: number;
  ambiguous: boolean;
  numericTokenCoverage: number;
}

type Vector = Map<string, number>;

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "by",
  "for",
  "line",
  "of",
  "pack",
  "quote",
  "supplier",
  "the",
  "to",
  "with",
]);

const GENERIC_FAMILY_TOKENS = new Set([
  "adapter",
  "blade",
  "brush",
  "cabinet",
  "clamp",
  "coupling",
  "crimp",
  "fitting",
  "cutter",
  "elbow",
  "hose",
  "motor",
  "pex",
  "pipe",
  "ring",
  "saw",
  "screwdriver",
  "set",
  "stub",
  "tape",
  "tee",
  "timer",
  "tube",
  "valve",
  "wrench",
]);

const PRODUCT_ROLE_ALIASES = new Map([
  ["adapters", "adapter"],
  ["blades", "blade"],
  ["brushes", "brush"],
  ["clamps", "clamp"],
  ["couplings", "coupling"],
  ["cutters", "cutter"],
  ["elbows", "elbow"],
  ["fittings", "fitting"],
  ["hoses", "hose"],
  ["motors", "motor"],
  ["pipes", "pipe"],
  ["rings", "ring"],
  ["saws", "saw"],
  ["screwdrivers", "screwdriver"],
  ["stubs", "stub"],
  ["tees", "tee"],
  ["tubes", "tube"],
  ["tubing", "tube"],
  ["valves", "valve"],
  ["wrenches", "wrench"],
]);

const MIN_SCORE = 0.42;
const AMBIGUITY_GAP = 0.06;
const GENERIC_FAMILY_MIN_SCORE = 0.8;

export function searchCWeightDescriptions(
  query: string,
  documents: readonly CWeightSearchDocument[],
): CWeightSemanticSearchHit | null {
  const queryHasNumbers = tokensFor(query).some(isNumericLike);
  const queryVector = buildVector(query, queryHasNumbers);
  if (queryVector.size === 0) return null;

  const scored = documents
    .map((document) => ({
      document,
      score: cosineSimilarity(queryVector, buildVector(document.description, queryHasNumbers)),
      numericTokenCoverage: numericTokenCoverage(query, document.description),
      alphaTokenCoverage: alphaTokenCoverage(query, document.description),
    }))
    .filter((item) => item.numericTokenCoverage >= 0.8)
    .filter((item) => item.alphaTokenCoverage >= 0.5)
    .filter((item) => passesGenericFamilyGate(query, item.document.description, item.score))
    .filter((item) => passesProductRoleGate(query, item.document.description))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (best === undefined || best.score < MIN_SCORE) return null;

  const secondScore = scored[1]?.score ?? 0;
  return {
    document: best.document,
    score: round6(best.score),
    secondScore: round6(secondScore),
    ambiguous: best.score - secondScore < AMBIGUITY_GAP,
    numericTokenCoverage: round6(best.numericTokenCoverage),
  };
}

function passesGenericFamilyGate(query: string, document: string, score: number): boolean {
  const queryFamilies = familyTokens(query);
  if (queryFamilies.size === 0) return true;

  const documentFamilies = familyTokens(document);
  const hasFamilyOverlap = [...queryFamilies].some((token) => documentFamilies.has(token));
  if (!hasFamilyOverlap) return false;

  return score >= GENERIC_FAMILY_MIN_SCORE;
}

function passesProductRoleGate(query: string, document: string): boolean {
  const queryRoles = productRoleTokens(query);
  if (queryRoles.size === 0) return true;

  const documentRoles = productRoleTokens(document);
  if (documentRoles.size === 0) return false;

  return [...queryRoles].every((token) => documentRoles.has(token));
}

export function normalizeSemanticText(value: string): string {
  return tokensFor(value).join(" ");
}

function buildVector(value: string, includeNumeric: boolean): Vector {
  const vector: Vector = new Map();
  const tokens = tokensFor(value).filter((token) => includeNumeric || !isNumericLike(token));

  for (const token of tokens) {
    addWeight(vector, `tok:${token}`, tokenWeight(token));
    for (const gram of charTrigrams(token)) {
      addWeight(vector, `tri:${gram}`, 0.12);
    }
  }

  return normalizeVector(vector);
}

function tokensFor(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/([a-z])([0-9])/g, "$1 $2")
    .replace(/([0-9])([a-z])/g, "$1 $2")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .map(normalizeToken)
    .filter((token) => (token.length > 1 || isNumericLike(token)) && !STOPWORDS.has(token));
}

function normalizeToken(token: string): string {
  return token === "inch" || token === "inches" ? "in" : token;
}

function tokenWeight(token: string): number {
  if (/^[a-z]*[0-9][a-z0-9]*$/.test(token)) return 2.2;
  if (/^[0-9]+$/.test(token)) return 1.6;
  if (token.length >= 6) return 1.25;
  return 1;
}

function numericTokenCoverage(query: string, document: string): number {
  const queryNumbers = new Set(tokensFor(query).filter(isNumericLike));
  const documentNumbers = new Set(tokensFor(document).filter(isNumericLike));
  if (queryNumbers.size === 0) return 1;
  if (documentNumbers.size === 0) return queryNumbers.size >= 2 ? 0 : 1;

  let matched = 0;
  for (const token of documentNumbers) {
    if (queryNumbers.has(token)) matched++;
  }

  return matched / documentNumbers.size;
}

function isNumericLike(token: string): boolean {
  return /[0-9]/.test(token);
}

function alphaTokenCoverage(query: string, document: string): number {
  const queryAlpha = new Set(tokensFor(query).filter((token) => !isNumericLike(token)));
  const documentAlpha = new Set(tokensFor(document).filter((token) => !isNumericLike(token)));
  if (queryAlpha.size === 0) return 1;
  if (documentAlpha.size === 0) return 0;

  let matched = 0;
  for (const token of queryAlpha) {
    if (documentAlpha.has(token)) matched++;
  }

  return matched / queryAlpha.size;
}

function familyTokens(value: string): Set<string> {
  return new Set(tokensFor(value).filter((token) => GENERIC_FAMILY_TOKENS.has(token)));
}

function productRoleTokens(value: string): Set<string> {
  return new Set(
    tokensFor(value)
      .map((token) => PRODUCT_ROLE_ALIASES.get(token) ?? token)
      .filter((token) => GENERIC_FAMILY_TOKENS.has(token)),
  );
}

function charTrigrams(token: string): string[] {
  if (token.length < 5) return [];
  const grams: string[] = [];
  for (let index = 0; index <= token.length - 3; index++) {
    grams.push(token.slice(index, index + 3));
  }
  return grams;
}

function addWeight(vector: Vector, key: string, weight: number): void {
  vector.set(key, (vector.get(key) ?? 0) + weight);
}

function normalizeVector(vector: Vector): Vector {
  const magnitude = Math.sqrt([...vector.values()].reduce((sum, value) => sum + value * value, 0));
  if (magnitude === 0) return vector;
  for (const [key, value] of vector.entries()) {
    vector.set(key, value / magnitude);
  }
  return vector;
}

function cosineSimilarity(left: Vector, right: Vector): number {
  let sum = 0;
  for (const [key, leftValue] of left.entries()) {
    sum += leftValue * (right.get(key) ?? 0);
  }
  return sum;
}

function round6(value: number): number {
  return Math.round(value * 1000000) / 1000000;
}
