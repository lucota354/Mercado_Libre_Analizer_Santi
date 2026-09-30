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

type CatalogProductSearchResult = {
  id: string;
  name?: string;
  permalink?: string;
  children_ids?: string[];
};

type CatalogProductItem = {
  item_id: string;
  price?: number;
  currency_id?: string;
  condition?: string;
  permalink?: string;
};

type CatalogProductDetail = CatalogProductSearchResult & {
  buy_box_winner?: {
    item_id?: string;
    price?: number;
    currency_id?: string;
    condition?: string;
  } | null;
  children_ids?: string[];
};

type AuthMode = "required" | "optional" | "none";

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

export class MercadoLibreApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
    public readonly responseBody: string
  ) {
    super(
      `Mercado Libre API ${status} en ${path}: ${responseBody.slice(0, 300)}`
    );
    this.name = "MercadoLibreApiError";
  }
}

export class MercadoLibreClient implements MercadoLibreGateway {
  constructor(private readonly accessToken = process.env.MELI_ACCESS_TOKEN) {}

  private async request<T>(
    path: string,
    init?: RequestInit,
    authMode: AuthMode = "required"
  ): Promise<T> {
    const headers = new Headers(init?.headers);
    headers.set("Accept", "application/json");

    if (authMode !== "none" && this.accessToken) {
      headers.set("Authorization", `Bearer ${this.accessToken}`);
    } else if (authMode === "required" && !this.accessToken) {
      throw new Error("Mercado Libre no está autenticado.");
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
      throw new MercadoLibreApiError(response.status, path, body);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Marketplace search is a public Mercado Libre resource. Do not attach the
   * OAuth bearer token here: an app with restricted/minimal scopes can receive
   * 403 before Mercado Libre evaluates the otherwise-public query.
   */
  /**
   * Mercado Libre retired/blocked the old free-text marketplace search
   * /sites/MLA/search?q=... for general discovery. Current V1 discovery uses
   * the documented catalog flow:
   *
   *   /products/search?q=...
   *      -> /products/{product_id}/items
   *
   * The second endpoint returns listings from all sellers competing on that
   * product page, including item_id, price and condition.
   */
  async searchArgentina(query: string): Promise<MarketplaceSearchItem[]> {
    const search = await this.request<{
      results?: CatalogProductSearchResult[];
    }>(
      `/products/search?status=active&site_id=MLA&q=${encodeURIComponent(
        query
      )}&limit=8`,
      undefined,
      "required"
    );

    const products = (search.results ?? []).slice(0, 8);
    const discovered = new Map<string, MarketplaceSearchItem>();

    for (const product of products) {
      if (discovered.size >= 20) break;

      const productIds = [product.id];

      // If the search returned a parent/umbrella product, its direct items may
      // be empty. Product detail lets us inspect child product IDs as fallback.
      let detail: CatalogProductDetail | null = null;

      try {
        detail = await this.request<CatalogProductDetail>(
          `/products/${encodeURIComponent(product.id)}`,
          undefined,
          "required"
        );
      } catch {
        detail = null;
      }

      if (detail?.children_ids?.length) {
        productIds.push(...detail.children_ids.slice(0, 4));
      }

      for (const productId of productIds) {
        if (discovered.size >= 20) break;

        try {
          const itemsResponse = await this.request<{
            results?: CatalogProductItem[];
          }>(
            `/products/${encodeURIComponent(productId)}/items?limit=20`,
            undefined,
            "required"
          );

          for (const item of itemsResponse.results ?? []) {
            if (!item.item_id || discovered.has(item.item_id)) continue;

            discovered.set(item.item_id, {
              id: item.item_id,
              title: product.name ?? item.item_id,
              permalink:
                item.permalink ??
                `https://articulo.mercadolibre.com.ar/${item.item_id}`,
              price: item.price,
              currencyId: item.currency_id
            });

            if (discovered.size >= 20) break;
          }
        } catch {
          // Some product pages may not expose their competitors to this app.
          // In that case keep the current buy-box winner as a usable candidate.
          const winner =
            productId === product.id ? detail?.buy_box_winner : undefined;

          if (winner?.item_id && !discovered.has(winner.item_id)) {
            discovered.set(winner.item_id, {
              id: winner.item_id,
              title: product.name ?? winner.item_id,
              permalink: `https://articulo.mercadolibre.com.ar/${winner.item_id}`,
              price: winner.price,
              currencyId: winner.currency_id
            });
          }
        }
      }
    }

    return [...discovered.values()].slice(0, 20);
  }

  async getItems(ids: string[]): Promise<MeliItem[]> {
    const unique = [...new Set(ids)].slice(0, 20);
    if (!unique.length) return [];

    const bulkPath = `/items/bulk?ids=${encodeURIComponent(unique.join(","))}`;

    for (const authMode of ["required", "none"] as const) {
      try {
        const data = await this.request<
          Array<{ id?: string; status_code?: number; body?: MeliItem }>
        >(bulkPath, undefined, authMode);

        const items = data
          .filter((entry) => entry.status_code === 200 && entry.body)
          .map((entry) => entry.body as MeliItem);

        if (items.length > 0) return items;
      } catch {
        // Continue to the next supported retrieval strategy.
      }
    }

    const individual = await Promise.all(
      unique.map(async (id) => {
        for (const authMode of ["required", "none"] as const) {
          try {
            return await this.request<MeliItem>(
              `/items/${encodeURIComponent(id)}`,
              undefined,
              authMode
            );
          } catch {
            // Try the next mode.
          }
        }

        return null;
      })
    );

    return individual.filter((item): item is MeliItem => Boolean(item));
  }

  async getSalePrice(itemId: string) {
    const data = await this.request<{
      amount: number;
      currency_id: string;
    }>(
      `/items/${encodeURIComponent(
        itemId
      )}/sale_price?context=channel_marketplace`,
      undefined,
      "required"
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
      },
      "required"
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
        `/items/${encodeURIComponent(itemId)}/compatibilities?extended=true`,
        undefined,
        "required"
      );
    } catch (error) {
      const detail =
        error instanceof MercadoLibreApiError
          ? `HTTP ${error.status} en compatibilidades.`
          : "No se pudieron consultar compatibilidades.";

      return {
        status: "unknown",
        source: "meli_catalog",
        checkedAt,
        note: `${detail} La publicación queda para revisión manual y no entra al precio automático.`
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
        note: matching.note ?? (restrictions || undefined),
        reputationLevel: matching.reputation?.level ?? undefined,
        catalogCompatibilityCount: data.catalog_compatibilities_count,
        checkedAt
      };
    }

    const catalogCount =
      data.catalog_compatibilities_count ??
      products
        .filter((product) => normalize(product.source) === "catalogo")
        .reduce(
          (sum, product) =>
            sum + Number((product as { total?: number }).total ?? 0),
          0
        );

    if (sellerProducts.length > 0 && !catalogCount) {
      return {
        status: "incompatible",
        source: "meli_seller",
        compatibleVehicleNames: sellerProducts
          .map((product) => product.catalog_product_name)
          .filter((name): name is string => Boolean(name)),
        note:
          "Hay compatibilidades detalladas del vendedor, pero ninguna coincide con el vehículo.",
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
