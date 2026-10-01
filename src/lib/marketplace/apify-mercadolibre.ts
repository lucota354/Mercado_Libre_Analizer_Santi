import type { MarketplaceSearchItem } from "./mercadolibre-gateway";

type ApifyMercadoLibreRow = {
  articuloTitulo?: string | null;
  nuevoPrecio?: string | number | null;
  Moneda?: string | null;
  zProductoLink?: string | null;
  SKU?: string | null;
  idPublicacion?: string | null;
  idProductoCatalogo?: string | null;
  idProductoUsuario?: string | null;
  productoMarca?: string | null;
  condicion?: string | null;
  descripcion?: string | null;
  caracteristicas?: unknown;
  tipoRegistro?: string | null;
  tipoResultado?: string | null;
  promovido?: string | boolean | null;
  [key: string]: unknown;
};

const ACTOR_ENDPOINT =
  "https://api.apify.com/v2/acts/karamelo~mercadolibre-scraper-espanol-castellano/run-sync-get-dataset-items?format=json&clean=true&timeout=30&maxItems=60";

function normalizeItemId(value?: string | null) {
  if (!value) return null;
  const normalized = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const match = normalized.match(/MLA(?:U)?\d+/);
  return match?.[0] ?? null;
}

function itemIdFromUrl(value?: string | null) {
  if (!value) return null;

  try {
    const url = new URL(value);
    const wid = url.searchParams.get("wid");
    const fromWid = normalizeItemId(wid);
    if (fromWid?.startsWith("MLA") && !fromWid.startsWith("MLAU")) {
      return fromWid;
    }
  } catch {
    // Continue with text matching.
  }

  const publication = value.match(/\bMLA-?(\d{6,})\b/i);
  if (publication) return `MLA${publication[1]}`;

  const userProduct = value.match(/\bMLAU\d+\b/i);
  return userProduct?.[0]?.toUpperCase() ?? null;
}

function parsePrice(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? Math.round(value) : undefined;
  }

  if (typeof value !== "string") return undefined;

  const raw = value.trim();
  if (!raw) return undefined;

  // Mercado Libre ARS is normally rendered without meaningful decimals.
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return undefined;

  const parsed = Number(digits);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function normalizeCondition(value?: string | null) {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "nuevo" || normalized === "new") return "new";
  if (normalized === "usado" || normalized === "used") return "used";
  if (normalized === "recondicionado" || normalized === "refurbished") {
    return "refurbished";
  }
  return undefined;
}

function extractOemFromFeatures(features: unknown) {
  if (!features) return undefined;

  const isOemLabel = (value: string) => {
    const text = value.toLowerCase();
    return (
      text.includes("oem") ||
      text.includes("part number") ||
      text.includes("numero de pieza") ||
      text.includes("número de pieza")
    );
  };

  const codeFrom = (value: unknown) => {
    if (typeof value !== "string" && typeof value !== "number") return undefined;
    const text = String(value).trim();
    const match = text.match(/[A-Z0-9][A-Z0-9-]{4,}/i);
    return match?.[0]?.toUpperCase();
  };

  const inspectObject = (node: unknown): string | undefined => {
    if (!node || typeof node !== "object" || Array.isArray(node)) return undefined;
    const record = node as Record<string, unknown>;

    const labelCandidate = [
      record.nombre,
      record.name,
      record.label,
      record.id,
      record.key
    ].find((value) => typeof value === "string" && isOemLabel(value));

    if (typeof labelCandidate === "string") {
      for (const key of ["valor", "value", "value_name", "contenido", "text"]) {
        const code = codeFrom(record[key]);
        if (code) return code;
      }
    }

    return undefined;
  };

  if (Array.isArray(features)) {
    for (const feature of features) {
      const direct = inspectObject(feature);
      if (direct) return direct;
    }
  } else {
    const direct = inspectObject(features);
    if (direct) return direct;
  }

  const values: Array<{ key: string; value: string }> = [];

  const walk = (node: unknown, parentKey = "") => {
    if (node == null) return;

    if (Array.isArray(node)) {
      for (const item of node) walk(item, parentKey);
      return;
    }

    if (typeof node === "object") {
      for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        if (typeof value === "string" || typeof value === "number") {
          values.push({ key: `${parentKey} ${key}`.trim(), value: String(value) });
        } else {
          walk(value, `${parentKey} ${key}`.trim());
        }
      }
      return;
    }

    if (typeof node === "string" || typeof node === "number") {
      values.push({ key: parentKey, value: String(node) });
    }
  };

  walk(features);

  for (let index = 0; index < values.length; index += 1) {
    const current = values[index];
    if (!isOemLabel(`${current.key} ${current.value}`)) continue;

    const directValueCode = codeFrom(current.value);
    if (directValueCode && !["NOMBRE", "VALUE", "VALOR"].includes(directValueCode)) {
      return directValueCode;
    }

    for (let offset = 1; offset <= 3; offset += 1) {
      const neighbor = values[index + offset];
      if (!neighbor) break;
      const code = codeFrom(neighbor.value);
      if (code) return code;
    }
  }

  return undefined;
}

function rowId(row: ApifyMercadoLibreRow) {
  return (
    normalizeItemId(row.idPublicacion) ||
    normalizeItemId(row.SKU) ||
    itemIdFromUrl(row.zProductoLink) ||
    normalizeItemId(row.idProductoUsuario) ||
    normalizeItemId(row.idProductoCatalogo)
  );
}

export function mapApifyRowsToMarketplaceItems(
  rows: ApifyMercadoLibreRow[]
): MarketplaceSearchItem[] {
  const items = new Map<string, MarketplaceSearchItem>();

  for (const row of rows) {
    const id = rowId(row);
    const title = row.articuloTitulo?.trim();
    const permalink = row.zProductoLink?.trim();

    if (!id || !title || !permalink) continue;

    const next: MarketplaceSearchItem = {
      id,
      title,
      permalink,
      price: parsePrice(row.nuevoPrecio),
      currencyId: row.Moneda?.trim() || "ARS",
      condition: normalizeCondition(row.condicion),
      brand: row.productoMarca?.trim() || undefined,
      description: row.descripcion?.trim() || undefined,
      oemCode: extractOemFromFeatures(row.caracteristicas),
      source: "apify"
    };

    const existing = items.get(id);
    if (!existing) {
      items.set(id, next);
      continue;
    }

    items.set(id, {
      ...existing,
      title: existing.title || next.title,
      permalink: existing.permalink || next.permalink,
      price: existing.price ?? next.price,
      currencyId: existing.currencyId ?? next.currencyId,
      condition: existing.condition ?? next.condition,
      brand: existing.brand ?? next.brand,
      description: existing.description ?? next.description,
      oemCode: existing.oemCode ?? next.oemCode,
      source: "apify"
    });
  }

  return [...items.values()];
}

export async function searchMercadoLibreWithApify(
  query: string
): Promise<MarketplaceSearchItem[]> {
  const token = process.env.APIFY_TOKEN;
  if (!token) return [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 35_000);

  try {
    const response = await fetch(ACTOR_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        keyword: query,
        country: "https://listado.mercadolibre.com.ar/",
        sort: "relevance",
        maxPages: 1,
        promoted: false,
        // Keep discovery fast. Product-page enrichment is done after we know
        // which listings are relevant; opening many product pages here can
        // exceed Vercel's request window.
        extractProductDetails: false
      }),
      cache: "no-store",
      signal: controller.signal
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Apify Mercado Libre scraper ${response.status}: ${body.slice(0, 400)}`
      );
    }

    const raw = await response.text();
    let rows: ApifyMercadoLibreRow[];

    try {
      rows = JSON.parse(raw) as ApifyMercadoLibreRow[];
    } catch {
      throw new Error(
        `Apify devolvió una respuesta no JSON: ${raw.slice(0, 250)}`
      );
    }

    return mapApifyRowsToMarketplaceItems(rows).slice(0, 30);
  } finally {
    clearTimeout(timeout);
  }
}
