import { describe, expect, it } from "vitest";
import { parseVehicleYear } from "../src/lib/validation/vehicle-year";
import { getLaborRatesForVehicleYear } from "../src/lib/pricing/labor-rates";
import { calculateWorkshopEstimate } from "../src/lib/pricing/workshop-estimate";
import { calculateCustomerQuote } from "../src/lib/pricing/customer-quote";
import { calculateRobustPrice } from "../src/lib/pricing/robust-price";
import { evaluateListing } from "../src/lib/marketplace/evaluate-listing";
import { canonicalizeVehicleBrand, createSearchPlan } from "../src/lib/marketplace/search-plan";

describe("vehicle year input", () => {
  it("does not treat intermediate typing states as valid years", () => {
    expect(parseVehicleYear("")).toBeNull();
    expect(parseVehicleYear("2")).toBeNull();
    expect(parseVehicleYear("20")).toBeNull();
    expect(parseVehicleYear("201")).toBeNull();
    expect(parseVehicleYear("2013")).toBe(2013);
  });

  it("rejects malformed or out-of-range years", () => {
    expect(parseVehicleYear("abc")).toBeNull();
    expect(parseVehicleYear("1899")).toBeNull();
    expect(parseVehicleYear("2101")).toBeNull();
  });
});

describe("labor rates", () => {
  it.each([
    [2015, 200_000, 100_000],
    [2014, 190_000, 90_000],
    [2010, 190_000, 90_000],
    [2009, 180_000, 80_000],
    [2002, 180_000, 80_000],
    [2001, 170_000, 70_000]
  ])("uses the correct rate band for %i", (year, bodywork, mechanic) => {
    const rates = getLaborRatesForVehicleYear(year);
    expect(rates.bodyworkPerDay).toBe(bodywork);
    expect(rates.paintPerPanel).toBe(bodywork);
    expect(rates.mechanicPerHour).toBe(mechanic);
  });

  it("rejects invalid years instead of silently pricing them", () => {
    expect(() => getLaborRatesForVehicleYear(0)).toThrow();
  });
});

describe("workshop valuation regression", () => {
  it("reproduces the real Peugeot 206 2006 estimate", () => {
    const result = calculateWorkshopEstimate({
      vehicleYear: 2006,
      partsBodywork: 1_600_000,
      bodyworkDays: 3,
      paintPanels: 6,
      mechanicHours: 2
    });

    expect(result.bodyworkSubtotal).toBe(540_000);
    expect(result.paintSubtotal).toBe(1_080_000);
    expect(result.mechanicSubtotal).toBe(160_000);
    expect(result.total).toBe(3_380_000);
  });
});

describe("customer quote calibration", () => {
  it("quotes 600k purchase reference at 900k", () => {
    expect(calculateCustomerQuote(600_000).quotedPrice).toBe(900_000);
  });

  it("rounds 380,780 purchase reference to 600k", () => {
    expect(calculateCustomerQuote(380_780).quotedPrice).toBe(600_000);
  });
});

describe("robust part pricing", () => {
  it("removes a high outlier and keeps the market median", () => {
    const result = calculateRobustPrice([
      585_000,
      600_000,
      620_000,
      640_000,
      650_000,
      1_380_000
    ]);

    expect(result.removedOutliers).toEqual([1_380_000]);
    expect(result.referencePrice).toBe(620_000);
  });
});

describe("listing filters", () => {
  const vehicle = {
    brand: "Peugeot",
    model: "206",
    year: 2013,
    version: "1.4 Active 75cv"
  };

  const damage = {
    id: "damage-1",
    partName: "Paragolpe",
    position: "Trasero"
  };

  it("accepts a new original compatible Peugeot part", () => {
    const result = evaluateListing(
      {
        itemId: "MLA1",
        title: "Paragolpe Trasero Peugeot 206 Original",
        url: "https://example.com",
        price: 400_000,
        currency: "ARS",
        condition: "new",
        brand: "Peugeot",
        oemCode: "7410L6",
        compatibility: {
          status: "compatible",
          source: "meli_seller",
          matchedVehicleName: "Peugeot 206 2013 1.4 Active 75cv"
        }
      },
      vehicle,
      damage
    );

    expect(result.valid).toBe(true);
  });

  it("rejects unknown compatibility", () => {
    const result = evaluateListing(
      {
        itemId: "MLA2",
        title: "Paragolpe Trasero Peugeot 206 Original",
        url: "https://example.com",
        price: 400_000,
        currency: "ARS",
        condition: "new",
        brand: "Peugeot",
        oemCode: "7410L6",
        compatibility: {
          status: "unknown",
          source: "meli_catalog"
        }
      },
      vehicle,
      damage
    );

    expect(result.valid).toBe(false);
  });

  it("rejects used parts even when the listing says original", () => {
    const result = evaluateListing(
      {
        itemId: "MLA3",
        title: "Paragolpe Trasero Peugeot 206 Original usado",
        url: "https://example.com",
        price: 200_000,
        currency: "ARS",
        condition: "new",
        brand: "Peugeot",
        oemCode: "7410L6",
        compatibility: {
          status: "compatible",
          source: "meli_seller"
        }
      },
      vehicle,
      damage
    );

    expect(result.valid).toBe(false);
  });
});


describe("autopart search plan", () => {
  it("starts broad so year ranges and missing trims do not hide listings", () => {
    const plan = createSearchPlan(
      {
        brand: "Nissan",
        model: "Sentra",
        year: 2021,
        version: "SR CVT",
        engine: "2.0"
      },
      {
        id: "damage-1",
        partName: "Paragolpe",
        position: "Trasero"
      }
    );

    expect(plan.queries[0]).toBe("Paragolpe Trasero Sentra");
    expect(plan.queries[1]).toBe("Paragolpe Trasero Nissan Sentra");
    expect(plan.queries).toContain("Paragolpe Trasero Nissan Sentra 2021");
  });
});

describe("unknown item condition", () => {
  it("requires manual review instead of assuming the part is new", () => {
    const result = evaluateListing(
      {
        itemId: "MLA4",
        title: "Paragolpe Trasero Peugeot 206 Original",
        url: "https://example.com",
        price: 400000,
        currency: "ARS",
        brand: "Peugeot",
        oemCode: "7410L6",
        compatibility: {
          status: "compatible",
          source: "meli_seller"
        }
      },
      {
        brand: "Peugeot",
        model: "206",
        year: 2013
      },
      {
        id: "damage-1",
        partName: "Paragolpe",
        position: "Trasero"
      }
    );

    expect(result.valid).toBe(false);
    expect(result.rejectionReasons.join(" ")).toContain("Condición nuevo/usado no confirmada");
  });
});


describe("vehicle brand typo tolerance", () => {
  it("normalizes nissa to Nissan and still searches without relying on the brand", () => {
    expect(canonicalizeVehicleBrand("nissa")).toBe("Nissan");

    const plan = createSearchPlan(
      {
        brand: "nissa",
        model: "sentra",
        year: 2021,
        version: "sr cvt",
        engine: "2.0"
      },
      {
        id: "damage-nissan",
        partName: "paragolpe",
        position: "trasero"
      }
    );

    expect(plan.queries[0].toLowerCase()).toBe("paragolpe trasero sentra");
    expect(
      plan.queries.some((query) =>
        query.toLowerCase().includes("paragolpe trasero nissan sentra")
      )
    ).toBe(true);
  });
});
