import * as cheerio from "cheerio";
import { searchMercadoLibreWithApify } from "./apify-mercadolibre";
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


function searchSlug(query: string) {
  return normalize(query)
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parsePriceText(value?: string | null) {
  if (!value) return undefined;
  const digits = value.replace(/[^0-9]/g, "");
  if (!digits) return undefined;
  const parsed = Number(digits);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function itemIdFromHref(href: string) {
  try {
    const url = new URL(href, "https://www.mercadolibre.com.ar");
    const wid = url.searchParams.get("wid");
    if (wid && /^MLA\d+$/i.test(wid)) return wid.toUpperCase();
  } catch {
    // Continue with regex extraction.
  }

  const decoded = decodeURIComponent(href);
  const match = decoded.match(/\bMLA-?(\d{6,})\b/i);
  return match ? `MLA${match[1]}` : null;
}

export function parseMarketplaceSearchHtml(
  html: string
): MarketplaceSearchItem[] {
  const $ = cheerio.load(html);
  const results = new Map<string, MarketplaceSearchItem>();

  const cardSelectors = [
    ".ui-search-layout__item",
    ".poly-card",
    "li.ui-search-layout__item",
    "[class*='poly-card']"
  ];

  $(cardSelectors.join(",")).each((_, element) => {
    const card = $(element);
    const anchor = card
      .find(
        "a.poly-component__title, a.ui-search-link, a[href*='mercadolibre.com.ar']"
      )
      .filter((__, link) => Boolean($(link).attr("href")))
      .first();

    const href = anchor.attr("href");
    if (!href) return;

    const itemId = itemIdFromHref(href);
    if (!itemId || results.has(itemId)) return;

    const title =
      anchor.text().trim() ||
      card.find("h2, h3, [class*='title']").first().text().trim() ||
      itemId;

    const fraction = card
      .find(".andes-money-amount__fraction")
      .first()
      .text()
      .trim();
    const price = parsePriceText(fraction);

    results.set(itemId, {
      id: itemId,
      title,
      permalink: href,
      price,
      currencyId: "ARS"
    });
  });

  // Defensive fallback for markup changes: collect links containing a concrete
  // MLA item ID or a wid query parameter, even when the card class changed.
  if (results.size === 0) {
    $("a[href]").each((_, element) => {
      const anchor = $(element);
      const href = anchor.attr("href");
      if (!href) return;

      const itemId = itemIdFromHref(href);
      if (!itemId || results.has(itemId)) return;

      const title = anchor.text().trim();
      if (!title) return;

      const container = anchor.closest("li, article, div");
      const price = parsePriceText(
        container.find(".andes-money-amount__fraction").first().text().trim()
      );

      results.set(itemId, {
        id: itemId,
        title,
        permalink: href,
        price,
        currencyId: "ARS"
      });
    });
  }

  return [...results.values()].slice(0, 30);
}

function normalizeExternalResultUrl(value: string) {
  try {
    const url = new URL(value);
    const uddg = url.searchParams.get("uddg");
    if (uddg) return decodeURIComponent(uddg);
    return url.toString();
  } catch {
    return value;
  }
}

function userProductIdFromHref(href: string) {
  const decoded = decodeURIComponent(href);
  const match = decoded.match(/\bMLAU\d+\b/i);
  return match ? match[0].toUpperCase() : null;
}

function publicationItemIdFromText(value: string) {
  const match = value.match(/Publicaci[oó]n\s*#?\s*(\d{6,})/i);
  return match ? "MLA" + match[1] : null;
}

function queryTitleLooksRelevant(title: string, query: string) {
  const normalizedTitle = normalize(title);
  const tokens = normalize(query)
    .split(" ")
    .filter((token) => token.length >= 4)
    .filter((token) => !["original", "genuino", "genuina", "oem", "nuevo", "nueva"].includes(token));

  if (!tokens.length) return true;
  const matched = tokens.filter((token) => normalizedTitle.includes(token));
  return matched.length >= Math.min(3, tokens.length);
}

export function parseMarketplaceProductHtml(
  html: string,
  sourceUrl: string
): MarketplaceSearchItem | null {
  const $ = cheerio.load(html);
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const title =
    $("h1.ui-pdp-title").first().text().trim() ||
    $("meta[property='og:title']").attr("content")?.trim() ||
    $("title").text().trim();

  if (!title) return null;

  let price: number | undefined;
  const metaPrice =
    $("meta[itemprop='price']").attr("content") ||
    $("meta[property='product:price:amount']").attr("content");

  if (metaPrice) {
    const parsed = Number(String(metaPrice).replace(",", "."));
    if (Number.isFinite(parsed) && parsed > 0) price = Math.round(parsed);
  }

  if (!price) {
    const fraction = $(".andes-money-amount__fraction").first().text().trim();
    price = parsePriceText(fraction);
  }

  if (!price) {
    const jsonLd = $("script[type='application/ld+json']")
      .map((_, element) => $(element).html())
      .get();

    for (const raw of jsonLd) {
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as { offers?: { price?: string | number }; price?: string | number };
        const candidate = parsed.offers?.price ?? parsed.price;
        if (candidate != null) {
          const numeric = Number(candidate);
          if (Number.isFinite(numeric) && numeric > 0) {
            price = Math.round(numeric);
            break;
          }
        }
      } catch {
        // Ignore invalid JSON-LD blocks.
      }
    }
  }

  const publicationId = publicationItemIdFromText(bodyText) || itemIdFromHref(sourceUrl);
  const userProductId = userProductIdFromHref(sourceUrl);
  const id = publicationId || userProductId;
  if (!id) return null;

  return {
    id,
    title,
    permalink: sourceUrl,
    price,
    currencyId: "ARS"
  };
}

function parseBingRssLinks(xml: string) {
  const $ = cheerio.load(xml, { xmlMode: true });
  const results: Array<{ title: string; url: string }> = [];
  $("item").each((_, element) => {
    const item = $(element);
    const title = item.find("title").first().text().trim();
    const url = item.find("link").first().text().trim();
    if (title && url) results.push({ title, url });
  });
  return results;
}

function parseDuckDuckGoLinks(html: string) {
  const $ = cheerio.load(html);
  const results: Array<{ title: string; url: string }> = [];
  $("a.result__a, a[href]").each((_, element) => {
    const anchor = $(element);
    const href = anchor.attr("href");
    const title = anchor.text().trim();
    if (!href || !title) return;
    const url = normalizeExternalResultUrl(href);
    if (!/mercadolibre\.com\.ar/i.test(url)) return;
    results.push({ title, url });
  });
  return results;
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

  private async searchCatalog(
    query: string
  ): Promise<MarketplaceSearchItem[]> {
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

  private async searchMarketplaceWeb(
    query: string
  ): Promise<MarketplaceSearchItem[]> {
    const slug = searchSlug(query);
    if (!slug) return [];

    const response = await fetch(
      `https://listado.mercadolibre.com.ar/${encodeURIComponent(slug)}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36",
          "Accept":
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "es-AR,es;q=0.9,en;q=0.6",
          "Cache-Control": "no-cache"
        },
        redirect: "follow",
        cache: "no-store"
      }
    );

    if (!response.ok) {
      return [];
    }

    const html = await response.text();
    return parseMarketplaceSearchHtml(html);
  }

  private async fetchMarketplaceProductPage(
    url: string
  ): Promise<MarketplaceSearchItem | null> {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36",
          "Accept":
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "es-AR,es;q=0.9,en;q=0.6",
          "Cache-Control": "no-cache"
        },
        redirect: "follow",
        cache: "no-store"
      });

      if (!response.ok) return null;
      const html = await response.text();
      return parseMarketplaceProductHtml(html, response.url || url);
    } catch {
      return null;
    }
  }

  private async searchExternalIndex(
    query: string
  ): Promise<MarketplaceSearchItem[]> {
    const searchQuery = "site:mercadolibre.com.ar " + query;
    const discoveredLinks = new Map<string, { title: string; url: string }>();

    const addLinks = (items: Array<{ title: string; url: string }>) => {
      for (const item of items) {
        const normalizedUrl = normalizeExternalResultUrl(item.url);
        try {
          const url = new URL(normalizedUrl);
          if (!url.hostname.endsWith("mercadolibre.com.ar")) continue;

          const isConcreteProduct =
            /\/up\/MLAU\d+/i.test(url.pathname) ||
            /\/p\/MLA\d+/i.test(url.pathname) ||
            /MLA-\d{6,}/i.test(url.pathname);

          if (!isConcreteProduct) continue;
          if (!queryTitleLooksRelevant(item.title, query)) continue;

          discoveredLinks.set(normalizedUrl, {
            title: item.title,
            url: normalizedUrl
          });
        } catch {
          // Ignore malformed result URLs.
        }

        if (discoveredLinks.size >= 10) break;
      }
    };

    try {
      const response = await fetch(
        "https://www.bing.com/search?format=rss&q=" + encodeURIComponent(searchQuery),
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153 Safari/537.36",
            "Accept": "application/rss+xml,application/xml,text/xml,*/*",
            "Accept-Language": "es-AR,es;q=0.9"
          },
          redirect: "follow",
          cache: "no-store"
        }
      );
      if (response.ok) addLinks(parseBingRssLinks(await response.text()));
    } catch {
      // Continue with the secondary index.
    }

    if (discoveredLinks.size < 3) {
      try {
        const response = await fetch("https://html.duckduckgo.com/html/", {
          method: "POST",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153 Safari/537.36",
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "text/html,*/*",
            "Accept-Language": "es-AR,es;q=0.9"
          },
          body: new URLSearchParams({ q: searchQuery }).toString(),
          redirect: "follow",
          cache: "no-store"
        });
        if (response.ok) addLinks(parseDuckDuckGoLinks(await response.text()));
      } catch {
        // Best-effort fallback.
      }
    }

    const linkResults = [...discoveredLinks.values()].slice(0, 8);
    if (!linkResults.length) return [];

    const pages = await Promise.all(
      linkResults.map(async (result) => {
        const parsed = await this.fetchMarketplaceProductPage(result.url);
        if (parsed) return parsed;

        const userProductId = userProductIdFromHref(result.url);
        const itemId = itemIdFromHref(result.url);
        if (!userProductId && !itemId) return null;

        return {
          id: itemId || userProductId!,
          title: result.title,
          permalink: result.url,
          currencyId: "ARS"
        } satisfies MarketplaceSearchItem;
      })
    );

    return pages.filter(
      (item): item is MarketplaceSearchItem => Boolean(item)
    );
  }
  /**
   * Hybrid discovery:
   * 1. Mercado Libre web listings: includes traditional/non-catalog parts.
   * 2. Official catalog API: adds catalog-linked sellers and structured data.
   *
   * Autoparts are often not fully represented in catalog, so using only
   * /products/search can incorrectly return zero marketplace publications.
   */
  async searchArgentina(
    query: string,
    options?: { useApify?: boolean }
  ): Promise<MarketplaceSearchItem[]> {
    const useApify = options?.useApify ?? true;

    const [apifyResult, webResult, catalogResult] = await Promise.allSettled([
      useApify ? searchMercadoLibreWithApify(query) : Promise.resolve([]),
      this.searchMarketplaceWeb(query),
      this.searchCatalog(query)
    ]);

    const merged = new Map<string, MarketplaceSearchItem>();

    const add = (items: MarketplaceSearchItem[]) => {
      for (const item of items) {
        const existing = merged.get(item.id);
        if (!existing) {
          merged.set(item.id, item);
          continue;
        }

        merged.set(item.id, {
          ...existing,
          title:
            existing.title && existing.title !== existing.id
              ? existing.title
              : item.title,
          permalink: existing.permalink || item.permalink,
          price: existing.price ?? item.price,
          currencyId: existing.currencyId ?? item.currencyId,
          condition: existing.condition ?? item.condition,
          brand: existing.brand ?? item.brand,
          description: existing.description ?? item.description,
          oemCode: existing.oemCode ?? item.oemCode,
          source: existing.source ?? item.source
        });
      }
    };

    if (apifyResult.status === "fulfilled") add(apifyResult.value);
    if (webResult.status === "fulfilled") add(webResult.value);
    if (catalogResult.status === "fulfilled") add(catalogResult.value);

    if (merged.size < 5) {
      try {
        add(await this.searchExternalIndex(query));
      } catch {
        // Discovery must degrade gracefully.
      }
    }

    return [...merged.values()].slice(0, 30);
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
