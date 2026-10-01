import type { DamageInput, SearchPlan, VehicleInput } from "@/lib/domain/types";

function normalize(value?: string) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function canonicalToken(value?: string) {
  return normalize(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function levenshtein(a: string, b: string) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let i = 0; i < rows; i += 1) matrix[i][0] = i;
  for (let j = 0; j < cols; j += 1) matrix[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}

export const KNOWN_VEHICLE_BRANDS = [
  "Audi",
  "BMW",
  "Chery",
  "Chevrolet",
  "Citroën",
  "Dodge",
  "Fiat",
  "Ford",
  "Geely",
  "Honda",
  "Hyundai",
  "Jeep",
  "Kia",
  "Mercedes-Benz",
  "Mitsubishi",
  "Nissan",
  "Peugeot",
  "RAM",
  "Renault",
  "Subaru",
  "Suzuki",
  "Toyota",
  "Volkswagen",
  "Volvo"
];

export function isKnownVehicleBrand(value?: string) {
  const token = canonicalToken(value);
  return KNOWN_VEHICLE_BRANDS.some(
    (brand) => canonicalToken(brand) === token
  );
}

export function canonicalizeVehicleBrand(value?: string) {
  const raw = normalize(value);
  if (!raw) return "";

  const token = canonicalToken(raw);

  const exact = KNOWN_VEHICLE_BRANDS.find(
    (brand) => canonicalToken(brand) === token
  );
  if (exact) return exact;

  let best: { brand: string; distance: number } | null = null;

  for (const brand of KNOWN_VEHICLE_BRANDS) {
    const distance = levenshtein(token, canonicalToken(brand));
    if (!best || distance < best.distance) {
      best = { brand, distance };
    }
  }

  const allowedDistance = token.length <= 5 ? 1 : 2;
  return best && best.distance <= allowedDistance ? best.brand : raw;
}

function unique(values: string[]) {
  return [...new Set(values.map(normalize).filter(Boolean))];
}

export function createSearchPlan(
  vehicle: VehicleInput,
  damage: DamageInput
): SearchPlan {
  const rawBrand = normalize(vehicle.brand);
  const brand = canonicalizeVehicleBrand(vehicle.brand);
  const model = normalize(vehicle.model);
  const year = vehicle.year ? String(vehicle.year) : "";
  const version = normalize(vehicle.version);
  const engine = normalize(vehicle.engine);
  const chassisNumber = normalize(vehicle.chassisNumber);
  const requestedOem = normalize(damage.oemCode);
  const part = normalize(damage.partName);
  const position = normalize(damage.position);

  /**
   * Search broad -> specific and typo-tolerant.
   *
   * Important:
   * - Auto-part titles frequently omit trim, engine or exact year.
   * - Users can mistype the brand ("nissa" -> "Nissan").
   * - Some results use year ranges (2020/2024) instead of the exact year.
   *
   * For those reasons we include model-first queries that do not depend on the
   * brand being correct, then progressively add canonical brand/year/OEM hints.
   */
  const queries = unique([
    requestedOem ? requestedOem : "",
    requestedOem ? `${requestedOem} ${brand}` : "",
    requestedOem ? `${part} ${position} ${requestedOem}` : "",
    `${part} ${position} ${model}`,
    `${part} ${position} ${brand} ${model}`,
    `${part} ${brand} ${model}`,
    `${part} ${position} ${brand} ${model} ${year}`,
    `${part} ${position} ${brand} ${model} original`,
    `${part} ${position} ${brand} ${model} ${year} original`,
    `${part} ${position} ${brand} ${model} OEM`,
    rawBrand && canonicalToken(rawBrand) !== canonicalToken(brand)
      ? `${part} ${position} ${rawBrand} ${model}`
      : "",
    version
      ? `${part} ${position} ${brand} ${model} ${version}`
      : "",
    engine
      ? `${part} ${position} ${brand} ${model} ${engine}`
      : "",
    chassisNumber
      ? `${part} ${position} ${brand} ${model} ${chassisNumber}`
      : ""
  ]).slice(0, 12);

  return {
    damageId: damage.id,
    displayName: unique([part, position]).join(" "),
    queries,
    siteId: "MLA"
  };
}
