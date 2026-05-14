import { describe, expect, it } from "vitest";
import { checkImportPermit } from "../src/services/permit-check.service.js";

describe("checkImportPermit", () => {
  it("flags chemical items from HS chapter 28", async () => {
    const result = await checkImportPermit({
      description: "Hydrochloric acid 35 percent",
      hsCode: "2806.10.00",
      itemCategory: "Chemical",
      countryOfOrigin: "CN",
    });

    expect(result).toEqual({
      permitRequired: true,
      permitType: "กรมโรงงาน",
      shelfLifeRequired: false,
      hazardous: true,
      notes: "Chemical chapter/category/description indicates permit and hazardous-goods review should be applied.",
      confidence: 0.78,
    });
  });

  it("flags high-voltage electrical items", async () => {
    const result = await checkImportPermit({
      description: "High-voltage transformer 11kV",
      hsCode: "8504.34.00",
      itemCategory: "Electrical",
    });

    expect(result).toEqual({
      permitRequired: true,
      permitType: "ใบอนุญาตอุปกรณ์ไฟฟ้าแรงสูง",
      shelfLifeRequired: false,
      hazardous: false,
      notes: "Electrical chapter/category plus high-voltage description indicates permit review may be required.",
      confidence: 0.68,
    });
  });

  it("returns no permit trigger for ordinary mechanical items", async () => {
    const result = await checkImportPermit({
      description: "Stainless steel mounting bracket",
      hsCode: "7326.90.99",
      itemCategory: "Mechanical",
    });

    expect(result).toEqual({
      permitRequired: false,
      shelfLifeRequired: false,
      hazardous: false,
      notes: "No chemical, food, pharma, weapon, radioactive, or high-voltage permit trigger is apparent from the available data.",
      confidence: 0.6,
    });
  });
});
