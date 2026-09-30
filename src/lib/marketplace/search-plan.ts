import type { DamageInput, SearchPlan, VehicleInput } from "@/lib/domain/types";

function normalize(value?: string) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function unique(values: string[]) {
  return [...new Set(values.map(normalize).filter(Boolean))];
}

export function createSearchPlan(
  vehicle: VehicleInput,
  damage: DamageInput
): SearchPlan {
  const brand = normalize(vehicle.brand);
  const model = normalize(vehicle.model);
  const year = vehicle.year ? String(vehicle.year) : "";
  const version = normalize(vehicle.version);
  const engine = normalize(vehicle.engine);
  const part = normalize(damage.partName);
  const position = normalize(damage.position);

  /**
   * Search broad -> specific.
   *
   * Mercado Libre titles for autoparts frequently omit trim/engine and may use
   * year ranges (e.g. 2020-2024). Starting with the full trim + "original"
   * can therefore hide perfectly relevant listings.
   */
  const queries = unique([
    `${part} ${position} ${brand} ${model}`,
    `${part} ${brand} ${model}`,
    `${part} ${position} ${brand} ${model} ${year}`,
    `${part} ${position} ${brand} ${model} original`,
    `${part} ${position} ${brand} ${model} ${year} original`,
    `${part} ${position} ${brand} ${model} OEM`,
    version
      ? `${part} ${position} ${brand} ${model} ${version}`
      : "",
    engine
      ? `${part} ${position} ${brand} ${model} ${engine}`
      : ""
  ]).slice(0, 8);

  return {
    damageId: damage.id,
    displayName: unique([part, position]).join(" "),
    queries,
    siteId: "MLA"
  };
}
