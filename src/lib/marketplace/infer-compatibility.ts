import type {
  CandidateListing,
  CompatibilityEvidence,
  VehicleInput
} from "@/lib/domain/types";

function normalize(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function twoDigitYear(value: number) {
  return value >= 70 ? 1900 + value : 2000 + value;
}

type YearCoverage = {
  min?: number;
  max?: number;
  years: number[];
  explicit: boolean;
  evidence: string[];
};

function extractYearCoverage(text: string): YearCoverage {
  const normalized = normalize(text);
  const years = new Set<number>();
  const evidence: string[] = [];
  const ranges: Array<[number, number]> = [];

  const fullRange = /\b(19\d{2}|20\d{2})\s*(?:\/|-|a|al|hasta)\s*(19\d{2}|20\d{2})\b/g;
  for (const match of normalized.matchAll(fullRange)) {
    const a = Number(match[1]);
    const b = Number(match[2]);
    if (a >= 1950 && a <= 2035 && b >= 1950 && b <= 2035) {
      ranges.push([Math.min(a, b), Math.max(a, b)]);
      years.add(a);
      years.add(b);
      evidence.push(match[0]);
    }
  }

  const shortRange = /\b(\d{2})\s*(?:\/|-|a|al|hasta)\s*(\d{2})\b/g;
  for (const match of normalized.matchAll(shortRange)) {
    const a = twoDigitYear(Number(match[1]));
    const b = twoDigitYear(Number(match[2]));
    if (a >= 1950 && a <= 2035 && b >= 1950 && b <= 2035) {
      ranges.push([Math.min(a, b), Math.max(a, b)]);
      years.add(a);
      years.add(b);
      evidence.push(match[0]);
    }
  }

  const fullYears = normalized.match(/\b(?:19\d{2}|20\d{2})\b/g) ?? [];
  for (const raw of fullYears) {
    const year = Number(raw);
    if (year >= 1950 && year <= 2035) years.add(year);
  }

  // Titles often use "95 96 97 98 99", "00 01 02 a 07", etc.
  // Only promote short numbers to years when several of them occur together,
  // which reduces false positives from part numbers.
  const shortTokens = normalized
    .split(" ")
    .filter((token) => /^\d{2}$/.test(token))
    .map(Number);

  if (shortTokens.length >= 2) {
    for (const value of shortTokens) {
      const year = twoDigitYear(value);
      if (year >= 1950 && year <= 2035) years.add(year);
    }
  }

  const sorted = [...years].sort((a, b) => a - b);

  if (ranges.length) {
    return {
      min: Math.min(...ranges.map(([a]) => a)),
      max: Math.max(...ranges.map(([, b]) => b)),
      years: sorted,
      explicit: true,
      evidence
    };
  }

  if (sorted.length >= 2) {
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const span = max - min;

    // A compact sequence is usually a model-year interval in auto-part titles.
    if (span <= 15) {
      return {
        min,
        max,
        years: sorted,
        explicit: true,
        evidence: [sorted.join(", ")]
      };
    }
  }

  return {
    years: sorted,
    explicit: sorted.length > 0,
    evidence
  };
}

function baseModelTokens(vehicle: VehicleInput) {
  const model = normalize(vehicle.model);
  if (!model) return [];

  const version = new Set(normalize(vehicle.version).split(" ").filter(Boolean));
  const genericTrimTokens = new Set([
    "gti",
    "tsi",
    "tdi",
    "cv",
    "cvti",
    "cvt",
    "active",
    "comfortline",
    "highline",
    "trendline",
    "sport",
    "sr",
    "sv",
    "se",
    "xe",
    "xl",
    "xlt"
  ]);

  const tokens = model
    .split(" ")
    .filter(Boolean)
    .filter((token) => !version.has(token))
    .filter((token) => !genericTrimTokens.has(token));

  return tokens.length ? tokens : model.split(" ").filter(Boolean).slice(0, 1);
}

function modelMentioned(text: string, vehicle: VehicleInput) {
  const normalized = normalize(text);
  const tokens = baseModelTokens(vehicle);
  if (!tokens.length) return false;

  return tokens.every((token) => normalized.includes(token));
}

function generationCompatibility(text: string, vehicle: VehicleInput) {
  const normalized = normalize(text);
  const model = normalize(vehicle.model);
  const year = vehicle.year;

  if (!model.includes("golf")) return null;

  const match = normalized.match(/\b(?:mk|golf\s*)([3-8])\b/);
  if (!match) return null;

  const generation = Number(match[1]);
  const ranges: Record<number, [number, number]> = {
    3: [1991, 1999],
    4: [1997, 2006],
    5: [2003, 2009],
    6: [2008, 2013],
    7: [2012, 2020],
    8: [2019, 2030]
  };

  const range = ranges[generation];
  if (!range) return null;

  return {
    compatible: year >= range[0] && year <= range[1],
    evidence: `Golf Mk${generation} ≈ ${range[0]}–${range[1]}`
  };
}

export function inferCompatibilityFromListingText(
  listing: CandidateListing,
  vehicle: VehicleInput
): CompatibilityEvidence {
  const title = listing.title ?? "";
  const text = [listing.title, listing.description].filter(Boolean).join(" ");
  const checkedAt = new Date().toISOString();

  if (!modelMentioned(text, vehicle)) {
    return {
      status: "unknown",
      source: "listing_text",
      confidence: "low",
      evidence: [],
      checkedAt,
      note:
        "La publicación no menciona con claridad el modelo del vehículo."
    };
  }

  const coverage = extractYearCoverage(title);
  if (coverage.explicit) {
    const inExplicitRange =
      coverage.min != null && coverage.max != null
        ? vehicle.year >= coverage.min && vehicle.year <= coverage.max
        : coverage.years.includes(vehicle.year);

    if (inExplicitRange) {
      return {
        status: "compatible",
        source: "listing_text",
        confidence: "high",
        evidence: [
          `Modelo ${vehicle.model} mencionado`,
          `Año ${vehicle.year} incluido en ${coverage.min ?? coverage.years[0]}–${coverage.max ?? coverage.years[coverage.years.length - 1]}`
        ],
        matchedVehicleName: `${vehicle.brand} ${vehicle.model} ${vehicle.year}`,
        checkedAt,
        note:
          "Compatibilidad inferida por modelo y rango de años publicados."
      };
    }

    return {
      status: "incompatible",
      source: "listing_text",
      confidence: "high",
      evidence: [
        `Modelo ${vehicle.model} mencionado`,
        `La publicación indica años ${coverage.min ?? coverage.years[0]}–${coverage.max ?? coverage.years[coverage.years.length - 1]}, fuera de ${vehicle.year}`
      ],
      checkedAt,
      note:
        "La publicación menciona el modelo, pero el año buscado queda fuera del rango publicado."
    };
  }

  const generation = generationCompatibility(title, vehicle);
  if (generation) {
    return {
      status: generation.compatible ? "compatible" : "incompatible",
      source: "listing_text",
      confidence: "medium",
      evidence: [
        `Modelo ${vehicle.model} mencionado`,
        generation.evidence
      ],
      matchedVehicleName: generation.compatible
        ? `${vehicle.brand} ${vehicle.model} ${vehicle.year}`
        : undefined,
      checkedAt,
      note:
        "Compatibilidad inferida por generación publicada."
    };
  }

  return {
    status: "unknown",
    source: "listing_text",
    confidence: "low",
    evidence: [`Modelo ${vehicle.model} mencionado, sin rango de años suficiente`],
    checkedAt,
    note:
      "El modelo coincide, pero falta evidencia explícita de año/generación."
  };
}

export function resolveCompatibilityEvidence(
  apiEvidence: CompatibilityEvidence | undefined,
  listing: CandidateListing,
  vehicle: VehicleInput
): CompatibilityEvidence {
  if (
    apiEvidence?.status === "compatible" ||
    apiEvidence?.status === "incompatible"
  ) {
    return apiEvidence;
  }

  const inferred = inferCompatibilityFromListingText(listing, vehicle);

  if (inferred.status !== "unknown") {
    return inferred;
  }

  return apiEvidence ?? inferred;
}
