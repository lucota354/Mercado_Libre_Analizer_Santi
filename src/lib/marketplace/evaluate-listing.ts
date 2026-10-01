import type {
  CandidateListing,
  DamageInput,
  EvaluationResult,
  VehicleInput
} from "@/lib/domain/types";
import {
  canonicalizeVehicleBrand,
  isKnownVehicleBrand
} from "@/lib/marketplace/search-plan";

const alternativeTerms = [
  "generico",
  "genérico",
  "alternativo",
  "tipo original",
  "simil original",
  "símil original"
];

const usedTerms = [
  "usado",
  "desarme",
  "recuperado",
  "reparado",
  "repintado",
  "retirado de vehiculo",
  "retirado de vehículo",
  "como nuevo"
];

function textOf(listing: CandidateListing) {
  return `${listing.title} ${listing.description ?? ""}`.toLowerCase();
}

function normalize(value?: string) {
  return value?.trim().toLocaleLowerCase("es-AR") ?? "";
}

export function evaluateListing(
  listing: CandidateListing,
  vehicle: VehicleInput,
  damage: DamageInput
): EvaluationResult {
  const reasons: string[] = [];
  const rejectionReasons: string[] = [];
  const text = textOf(listing);
  let score = 0;

  const requestedBrandRaw = damage.requestedBrand || vehicle.brand;
  const requestedBrand = normalize(canonicalizeVehicleBrand(requestedBrandRaw));
  const requestedBrandIsKnown = isKnownVehicleBrand(
    canonicalizeVehicleBrand(requestedBrandRaw)
  );
  const listingBrand = normalize(
    listing.brand ? canonicalizeVehicleBrand(listing.brand) : undefined
  );

  if (!listing.condition) {
    rejectionReasons.push(
      "Condición nuevo/usado no confirmada. Requiere revisión manual."
    );
  } else if (
    normalize(listing.condition) !== "new" &&
    normalize(listing.condition) !== "nuevo"
  ) {
    rejectionReasons.push("La publicación no está declarada como nueva.");
  } else {
    score += 15;
    reasons.push("Condición declarada nueva.");
  }

  if (listingBrand) {
    if (requestedBrandIsKnown && listingBrand === requestedBrand) {
      score += 35;
      reasons.push("La marca del repuesto coincide con la requerida.");
    } else if (requestedBrandIsKnown && listingBrand !== requestedBrand) {
      rejectionReasons.push(
        `Marca del repuesto incompatible: ${listing.brand} en lugar de ${damage.requestedBrand || vehicle.brand}.`
      );
    } else {
      score += 10;
      reasons.push(
        "La marca ingresada del vehículo no es una marca reconocida; no se usa para descartar automáticamente."
      );
    }
  }

  const expectedPosition = normalize(damage.position);
  const titleText = normalize(listing.title);

  const oppositePositionTerms: Array<[string, string[]]> = [
    ["trasero", ["delantero", "frontal", "frente"]],
    ["delantero", ["trasero"]],
    ["derecho", ["izquierdo"]],
    ["izquierdo", ["derecho"]]
  ];

  for (const [expected, opposites] of oppositePositionTerms) {
    if (
      expectedPosition.includes(expected) &&
      opposites.some((term) => titleText.includes(term))
    ) {
      rejectionReasons.push(
        `La posición publicada no coincide: se pidió ${damage.position}.`
      );
      break;
    }
  }

  const componentTerms = [
    "spoiler",
    "moldura",
    "soporte",
    "alma",
    "refuerzo",
    "rejilla",
    "puntera",
    "absorbedor",
    "absorvedor"
  ];

  const requestedPart = normalize(damage.partName);
  const componentHit = componentTerms.find(
    (term) =>
      titleText.includes(term) &&
      !requestedPart.includes(term)
  );

  if (componentHit && requestedPart.includes("paragolpe")) {
    rejectionReasons.push(
      `La publicación parece ser un componente del paragolpe (${componentHit}), no el paragolpe completo.`
    );
  }

  if (/\boriginal\b|\bgenuin[oa]\b/i.test(text)) {
    score += 10;
    reasons.push("La publicación declara original/genuino.");
  }

  if (listing.oemCode) {
    score += 15;
    reasons.push("Incluye código OEM.");
  }

  const alternativeHit = alternativeTerms.find((term) => text.includes(term));
  if (alternativeHit) {
    rejectionReasons.push(`Texto incompatible con originalidad estricta: "${alternativeHit}".`);
  }

  const usedHit = usedTerms.find((term) => text.includes(term));
  if (usedHit) {
    rejectionReasons.push(`Texto compatible con pieza usada o intervenida: "${usedHit}".`);
  }

  if (listing.visualCondition === "used" || listing.visualCondition === "probably_used") {
    rejectionReasons.push("Las imágenes presentan señales de uso.");
  } else if (listing.visualCondition === "new") {
    score += 10;
    reasons.push("La inspección visual es consistente con una pieza nueva.");
  }

  if (damage.packageType && listing.packageType && damage.packageType !== listing.packageType) {
    rejectionReasons.push("La presentación no es equivalente (unidad/par/kit).");
  }

  const compatibility = listing.compatibility;
  if (!compatibility || compatibility.status === "unknown") {
    rejectionReasons.push(
      "Compatibilidad con el vehículo no confirmada. No entra al precio automático."
    );
  } else if (compatibility.status === "incompatible") {
    rejectionReasons.push("Mercado Libre indica que la pieza no es compatible con este vehículo.");
  } else {
    score += 25;
    reasons.push(
      compatibility.matchedVehicleName
        ? `Compatibilidad confirmada: ${compatibility.matchedVehicleName}.`
        : "Compatibilidad con el vehículo confirmada."
    );
  }

  if (compatibility?.positionCompatible === false) {
    rejectionReasons.push("La restricción de posición no coincide con la pieza buscada.");
  }

  if (compatibility?.reputationLevel === "RED") {
    rejectionReasons.push(
      "La compatibilidad tiene nivel RED por reclamos de incompatibilidad."
    );
  }

  const model = normalize(vehicle.model);
  if (model && !text.includes(model) && compatibility?.status !== "compatible") {
    score -= 10;
    reasons.push("El modelo no aparece explícitamente en título/descripción.");
  }

  return {
    valid: rejectionReasons.length === 0 && score >= 60,
    score: Math.max(0, Math.min(100, score)),
    reasons,
    rejectionReasons
  };
}
