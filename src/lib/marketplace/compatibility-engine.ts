import type {
  CompatibilityEvidence,
  VehicleInput
} from "@/lib/domain/types";
import type { MercadoLibreGateway } from "./mercadolibre-gateway";

export type CompatibilityCheckResult = {
  evidence: CompatibilityEvidence;
  method: "api" | "page_selector";
};

/**
 * Compatibilidad es una condición de inclusión, no un bonus.
 *
 * 1. Se consulta primero la API oficial.
 * 2. Si la API confirma compatible/incompatible, se usa esa evidencia.
 * 3. Si la API devuelve sólo un resumen de catálogo o no alcanza para el
 *    vehículo exacto, se verifica el selector de compatibilidad de la publicación.
 * 4. Si tampoco puede confirmarse, queda UNKNOWN y la publicación NO entra
 *    al cálculo automático.
 */
export async function verifyListingCompatibility(
  gateway: MercadoLibreGateway,
  itemId: string,
  itemUrl: string,
  vehicle: VehicleInput
): Promise<CompatibilityCheckResult> {
  const apiEvidence = await gateway.getItemCompatibilityEvidence(itemId, vehicle);

  if (apiEvidence.status !== "unknown") {
    return { evidence: apiEvidence, method: "api" };
  }

  const pageEvidence = await gateway.verifyCompatibilityInListingPage(itemUrl, vehicle);
  return { evidence: pageEvidence, method: "page_selector" };
}

export function vehicleLabel(vehicle: VehicleInput) {
  return [
    vehicle.brand,
    vehicle.model,
    vehicle.year,
    vehicle.version,
    vehicle.engine
  ]
    .filter(Boolean)
    .join(" ");
}
