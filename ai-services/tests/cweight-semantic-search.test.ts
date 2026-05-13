import { describe, expect, it } from "vitest";
import { normalizeSemanticText, searchCWeightDescriptions } from "../src/index.js";

describe("local CWeight semantic search", () => {
  const documents = [
    {
      id: "gauge",
      description: "Taper Gauge Set: 1 1/16 in to 1/16 in Flat Leaf Gauge",
      row: { id: "gauge" },
    },
    {
      id: "cutter",
      description: "Bolt Cutters Steel For 5/16 in Max Dia Soft Steel",
      row: { id: "cutter" },
    },
  ];

  it("removes supplier noise and ranks the closest description", () => {
    const hit = searchCWeightDescriptions("flat leaf taper gauge quote line supplier pack", documents);

    expect(hit?.document.id).toBe("gauge");
    expect(hit?.score).toBeGreaterThan(0.42);
    expect(hit?.ambiguous).toBe(false);
  });

  it("rejects candidates missing important numeric tokens", () => {
    const hit = searchCWeightDescriptions("floor squeegee set black 24 l", [
      {
        id: "wrong",
        description: "Floor Squeegee Set Black 24 L x 18 W",
        row: { id: "wrong" },
      },
    ]);

    expect(hit).toBeNull();
  });

  it("rejects weak generic-family matches", () => {
    const hit = searchCWeightDescriptions("air hose 1 4 id x", [
      {
        id: "guide",
        description: "Hose Roller Guide For 1/4 to 3/8 ID Hose",
        row: { id: "guide" },
      },
    ]);

    expect(hit).toBeNull();
  });

  it("rejects a different product role inside the same material family", () => {
    const hit = searchCWeightDescriptions("pex tubing low lead brass 1 2 in", [
      {
        id: "valve",
        description: "Plastic Ball Valve PEX x FNPT 1/2 in",
        row: { id: "valve" },
      },
    ]);

    expect(hit).toBeNull();
  });

  it("normalizes text deterministically", () => {
    expect(normalizeSemanticText("Supplier quote: Bolt-Cutters 5/16 in pack")).toBe("bolt cutters 5 16 in");
  });
});
