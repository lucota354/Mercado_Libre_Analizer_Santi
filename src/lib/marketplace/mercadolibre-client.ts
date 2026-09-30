import type {
  CandidateListing,
  CompatibilityEvidence,
  VehicleInput
} from "@/lib/domain/types";
import type {
  MarketplaceSearchItem,
  MercadoLibreGateway,
  VehicleCatalogValue,
  VehicleKnownAttribute
} from "./mercadolibre-gateway";

type MeliItem = {
  id: string;
  title?: string;
  permalink?: string;
  condition?: string;
  category_id?: string;
  attributes?: Array<{
    id?: string;
    value_name?: string | null;
    values?: Array<{ name?: string | null }>;
  }>;
  [key: string]: unknown;
};

type CompatibilityProduct = {
  id?: string | null;
  catalog_product_id?: string | null;
  catalog_product_name?: string | null;
  source?: string | null;
  note?: string | null;
  restrictions?: unknown;
  reputation?: { level?: string | null } | null;
};

type CompatibilitiesResponse = {
  products?: CompatibilityProduct[];
  catalog_compatibilities_count?: number;
  total?: number;
  [key: string]: unknown;
};

const API = "https://api.mercadolibre.com";

function normalize(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function vehicleCoreTokens(vehicle: VehicleInput) {
  return [vehicle.brand, vehicle.model, String(vehicle.year)]
    .map(normalize)
    .filter(Boolean);
}

function detailedCompatibilityMatches(name: string, vehicle: VehicleInput) {
  const normalized = normalize(name);
  return vehicleCoreTokens(vehicle).every((token) => normalized.includes(token));
}

function extractRestrictionText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

export function attributeValue(item: MeliItem, ids: string[]) {
  const wanted = new Set(ids.map((id) => id.toUpperCase()));
  const attr = item.attributes?.find((candidate) =>
    candidate.id ? wanted.has(candidate.id.toUpperCase()) : false
  );
  return attr?.value_name ?? attr?.values?.[0]?.name ?? undefined;
}

export class MercadoLibreClient implements MercadoLibreGateway {
  constructor(private readonly accessToken = process.env.MELI_ACCESS_TOKEN) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers);
    headers.set("Accept", "application/json");

    if (this.accessToken) {
      headers.set("Authorization", `Bearer ${this.accessToken}`);
    }

    if (init?.body) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetch(`${API}${path}`, {
      ...init,
      headers,
      cache: "no-store"
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Mercado Libre API ${response.status}: ${body.slice(0, 400)}`
      );
    }

    return response.json() as Promise<T>;
  }

  async searchArgentina(query: string): Promise<MarketplaceSearchItem[]> {
    const data = await this.request<{
      results?: Array<{
        id: string;
        title?: string;
        permalink?: string;
        price?: number;
        currency_id?: string;
      }>;
    }>(`/sites/MLA/search?q=${encodeURIComponent(query)}&limit=20`);

    return (data.results ?? []).map((item) => ({
      id: item.id,
      title: item.title ?? item.id,
      permalink: item.permalink ?? `https://articulo.mercadolibre.com.ar/${item.id}`,
      price: item.price,
      currencyId: item.currency_id
    }));
  }

  async getItems(ids: string[]): Promise<MeliItem[]> {
    const unique = [...new Set(ids)].slice(0, 20);
    if (!unique.length) return [];

    const data = await this.request<
      Array<{ id?: string; status_code?: number; body?: MeliItem }>
    >(`/items/bulk?ids=${encodeURIComponent(unique.join(","))}`);

    return data
      .filter((entry) => entry.status_code === 200 && entry.body)
      .map((entry) => entry.body as MeliItem);
  }

  async getSalePrice(itemId: string) {
    const data = await this.request<{
      amount: number;
      currency_id: string;
    }>(
      `/items/${encodeURIComponent(itemId)}/sale_price?context=channel_marketplace`
    );

    return {
      amount: data.amount,
      currencyId: data.currency_id
    };
  }

  async getVehicleValues(
    attributeId: VehicleKnownAttribute["id"],
    knownAttributes: VehicleKnownAttribute[]
  ): Promise<VehicleCatalogValue[]> {
    const body = {
      known_attributes: knownAttributes
        .filter((attribute) => attribute.valueId || attribute.valueName)
        .map((attribute) => ({
          id: attribute.id,
          ...(attribute.valueId
            ? { value_id: attribute.valueId }
            : { value_name: attribute.valueName })
        }))
    };

    return this.request<VehicleCatalogValue[]>(
      `/catalog_domains/MLA-CARS_AND_VANS/attributes/${attributeId}/top_values?limit=1000`,
      {
        method: "POST",
        body: JSON.stringify(body)
      }
    );
  }

  async getItemCompatibilityEvidence(
    itemId: string,
    vehicle: VehicleInput
  ): Promise<CompatibilityEvidence> {
    const checkedAt = new Date().toISOString();

    let data: CompatibilitiesResponse;
    try {
      data = await this.request<CompatibilitiesResponse>(
        `/items/${encodeURIComponent(itemId)}/compatibilities?extended=true`
      );
    } catch {
      return {
        status: "unknown",
        source: "meli_catalog",
        checkedAt,
        note: "La API no permitió obtener compatibilidades detalladas para este ítem."
      };
    }

    const products = data.products ?? [];
    const sellerProducts = products.filter(
      (product) => normalize(product.source) === "seller" || product.id
    );

    const matching = sellerProducts.find((product) =>
      detailedCompatibilityMatches(product.catalog_product_name ?? "", vehicle)
    );

    if (matching) {
      const restrictions = extractRestrictionText(matching.restrictions);
      return {
        status: "compatible",
        source: "meli_seller",
        matchedVehicleName: matching.catalog_product_name ?? undefined,
        compatibleVehicleNames: sellerProducts
          .map((product) => product.catalog_product_name)
          .filter((name): name is string => Boolean(name)),
        note: matching.note ?? restrictions || undefined,
        reputationLevel: matching.reputation?.level ?? undefined,
        catalogCompatibilityCount: data.catalog_compatibilities_count,
        checkedAt
      };
    }

    const catalogCount =
      data.catalog_compatibilities_count ??
      products
        .filter((product) => normalize(product.source) === "catalogo")
        .reduce((sum, product) => sum + Number((product as { total?: number }).total ?? 0), 0);

    if (sellerProducts.length > 0 && !catalogCount) {
      return {
        status: "incompatible",
        source: "meli_seller",
        compatibleVehicleNames: sellerProducts
          .map((product) => product.catalog_product_name)
          .filter((name): name is string => Boolean(name)),
        note: "Hay compatibilidades detalladas del vendedor, pero ninguna coincide con el vehículo.",
        checkedAt
      };
    }

    return {
      status: "unknown",
      source: "meli_catalog",
      compatibleVehicleNames: sellerProducts
        .map((product) => product.catalog_product_name)
        .filter((name): name is string => Boolean(name)),
      catalogCompatibilityCount: catalogCount || undefined,
      note: catalogCount
        ? "Mercado Libre informó compatibilidades de catálogo resumidas; falta confirmar el vehículo exacto."
        : "No hay evidencia suficiente para confirmar la compatibilidad exacta.",
      checkedAt
    };
  }

  async verifyCompatibilityInListingPage(
    _itemUrl: string,
    _vehicle: VehicleInput
  ): Promise<CompatibilityEvidence> {
    return {
      status: "unknown",
      source: "meli_page_selector",
      checkedAt: new Date().toISOString(),
      note:
        "El selector web requiere una sesión/navegador. Hasta conectar browser automation, se deriva a revisión manual."
    };
  }

  toCandidateListing(
    item: MeliItem,
    price: { amount: number; currencyId: string },
    compatibility: CompatibilityEvidence,
    fallbackUrl?: string
  ): CandidateListing {
    return {
      itemId: item.id,
      title: item.title ?? item.id,
      url:
        (typeof item.permalink === "string" && item.permalink) ||
        fallbackUrl ||
        `https://articulo.mercadolibre.com.ar/${item.id}`,
      price: price.amount,
      currency: price.currencyId,
      condition: item.condition,
      brand: attributeValue(item, ["BRAND"]),
      oemCode: attributeValue(item, [
        "OEM",
        "OEM_CODE",
        "PART_NUMBER",
        "ORIGINAL_PART_NUMBER"
      ]),
      compatibility
    };
  }
}
