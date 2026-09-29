import type { DamageInput, SearchPlan, VehicleInput } from "@/lib/domain/types";

function normalize(value?: string) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function unique(values: string[]) {
  return [...new Set(values.map(normalize).filter(Boolean))];
}

export function createSearchPlan(vehicle: VehicleInput, damage: DamageInput): SearchPlan {
  const brand = normalize(vehicle.brand);
  const model = normalize(vehicle.model);
  const year = vehicle.year ? String(vehicle.year) : "";
  const version = normalize(vehicle.version);
  const engine = normalize(vehicle.engine);
  const part = normalize(damage.partName);
  const position = normalize(damage.position);

  const base = unique([part, position, brand, model, year, version]).join(" ");

  const queries = unique([
    `${base} original`,
    `${base} genuino`,
    `${part} ${position} ${brand} ${model} ${year} OEM`,
    `${brand} ${model} ${year} ${part} ${position} original`,
    version ? `${brand} ${model} ${version} ${year} ${part} ${position}` : "",
    engine ? `${brand} ${model} ${year} ${engine} ${part} ${position} original` : ""
  ]).slice(0, 6);

  return {
    damageId: damage.id,
    displayName: unique([part, position]).join(" "),
    queries,
    siteId: "MLA"
  };
}
