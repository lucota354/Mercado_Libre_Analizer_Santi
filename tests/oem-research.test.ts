import { describe, expect, it } from "vitest";
import { createSearchPlan } from "../src/lib/marketplace/search-plan";
import {
  buildOemResearchQueries,
  extractOemCodes,
  makeSource,
  rankOemCandidates
} from "../src/lib/oem/research";

describe("OEM research", () => {
  const vehicle = {
    brand: "Volkswagen",
    model: "Golf",
    year: 2015,
    version: "GTI",
    engine: "2.0",
    chassisNumber: "3VWTEST123"
  };

  const damage = {
    id: "rear-bumper",
    partName: "Paragolpe",
    position: "Trasero"
  };

  it("builds targeted free-catalog queries and includes the chassis number when available", () => {
    const queries = buildOemResearchQueries(vehicle, damage);

    expect(queries.some((query) => query.includes("rear bumper"))).toBe(true);
    expect(queries.some((query) => query.includes("nemigaparts.com"))).toBe(true);
    expect(queries.some((query) => query.includes("partsouq.com"))).toBe(true);
    expect(queries.some((query) => query.includes("3VWTEST123"))).toBe(true);
  });

  it("extracts common OEM formats", () => {
    const codes = extractOemCodes(
      "Rear bumper part number 5G0 807 421 H. Nissan OEM 85022-6LE0H. Renault 7701474484."
    );

    expect(codes).toContain("5G0 807 421 H");
    expect(codes).toContain("85022-6LE0H");
    expect(codes).toContain("7701474484");
  });

  it("prioritizes a selected OEM when returning to Mercado Libre", () => {
    const plan = createSearchPlan(vehicle, {
      ...damage,
      oemCode: "5G6 807 421 H"
    });

    expect(plan.queries[0]).toBe("5G6 807 421 H");
    expect(plan.queries[1]).toContain("Volkswagen");
    expect(plan.queries[2]).toContain("Paragolpe");
  });

  it("ranks codes from trusted technical sources above weak generic mentions", () => {
    const trusted = makeSource(
      "Volkswagen Golf (2013 - 2017) - bumper",
      "https://nemigaparts.com/cat_spares/etka/volkswagen/go/769/807500/",
      "rear bumper OEM part number 5G6 807 421 H for Volkswagen Golf 2015",
      "Volkswagen Golf 2015 rear bumper OEM site:nemigaparts.com"
    );

    const generic = makeSource(
      "Discussion",
      "https://example.com/forum",
      "someone mentioned 12345678 near a Golf",
      "Volkswagen Golf 2015 rear bumper OEM"
    );

    const ranked = rankOemCandidates(
      [trusted, generic].filter(Boolean) as NonNullable<typeof trusted>[],
      vehicle,
      damage
    );

    expect(ranked[0]?.normalizedCode).toBe("5G6807421H");
    expect(ranked[0]?.confidence).not.toBe("low");
  });
});
