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

export type ApifySearchJob = {
  damageId: string;
  runId: string;
  query: string;
  queryIndex: number;
};

export type ApifyRunSnapshot = {
  id: string;
  status:
    | "READY"
    | "RUNNING"
    | "SUCCEEDED"
    | "FAILED"
    | "TIMING-OUT"
    | "TIMED-OUT"
    | "ABORTING"
    | "ABORTED"
    | string;
  defaultDatasetId?: string;
  statusMessage?: string | null;
};

const ACTOR_ID = "karamelo~mercadolibre-scraper-espanol-castellano";
const APIFY_API = "https://api.apify.com/v2";

function token() {
  const value = process.env.APIFY_TOKEN;
  if (!value) {
    throw new Error("APIFY_TOKEN no está configurado.");
  }
  return value;
}

function authHeaders(extra?: HeadersInit) {
  const headers = new Headers(extra);
  headers.set("Authorization", `Bearer ${token()}`);
  return headers;
}

async function parseJsonResponse<T>(response: Response, label: string): Promise<T> {
  const raw = await response.text();

  if (!response.ok) {
    throw new Error(
      `${label} ${response.status}: ${raw.slice(0, 400) || response.statusText}`
    );
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(
      `${label} devolvió una respuesta no JSON: ${raw.slice(0, 300)}`
    );
  }
}

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

  if (Array.isArray(features)) {
    for (const feature of features) {
      if (!feature || typeof feature !== "object") continue;
      const record = feature as Record<string, unknown>;
      const label = [
        record.nombre,
        record.name,
        record.label,
        record.id,
        record.key
      ].find(
        (value) => typeof value === "string" && isOemLabel(String(value))
      );

      if (!label) continue;

      for (const key of ["valor", "value", "value_name", "contenido", "text"]) {
        const code = codeFrom(record[key]);
        if (code) return code;
      }
    }
  }

  return undefined;
}

function featuresText(features: unknown) {
  if (!features) return undefined;

  const parts: string[] = [];
  const walk = (node: unknown, key = "") => {
    if (node == null) return;

    if (Array.isArray(node)) {
      for (const item of node) walk(item, key);
      return;
    }

    if (typeof node === "object") {
      for (const [childKey, value] of Object.entries(
        node as Record<string, unknown>
      )) {
        walk(value, childKey);
      }
      return;
    }

    if (typeof node === "string" || typeof node === "number") {
      const value = String(node).trim();
      if (!value) return;
      parts.push(key ? `${key}: ${value}` : value);
    }
  };

  walk(features);

  return parts.slice(0, 80).join(" · ") || undefined;
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
      description: [row.descripcion?.trim(), featuresText(row.caracteristicas)]
        .filter(Boolean)
        .join(" · ") || undefined,
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

export async function startMercadoLibreApifySearch(
  damageId: string,
  query: string,
  queryIndex = 0
): Promise<ApifySearchJob> {
  const response = await fetch(
    `${APIFY_API}/actors/${ACTOR_ID}/runs?maxItems=80&timeout=180`,
    {
      method: "POST",
      headers: authHeaders({
        "Content-Type": "application/json",
        Accept: "application/json"
      }),
      body: JSON.stringify({
        keyword: query,
        country: "https://listado.mercadolibre.com.ar/",
        sort: "relevance",
        maxPages: 1,
        promoted: false,
        extractProductDetails: true,
        maxProductDetails: 20,
        includeReviews: false
      }),
      cache: "no-store"
    }
  );

  const payload = await parseJsonResponse<{
    data?: { id?: string };
  }>(response, "Apify start");

  const runId = payload.data?.id;
  if (!runId) {
    throw new Error("Apify inició la búsqueda pero no devolvió un runId.");
  }

  return { damageId, runId, query, queryIndex };
}

export async function getApifyRunSnapshot(
  runId: string
): Promise<ApifyRunSnapshot> {
  const response = await fetch(`${APIFY_API}/actor-runs/${encodeURIComponent(runId)}`, {
    headers: authHeaders({ Accept: "application/json" }),
    cache: "no-store"
  });

  const payload = await parseJsonResponse<{
    data?: ApifyRunSnapshot;
  }>(response, "Apify run status");

  if (!payload.data?.id) {
    throw new Error("Apify no devolvió el estado del run.");
  }

  return payload.data;
}

export async function getApifyDatasetRows(
  datasetId: string
): Promise<ApifyMercadoLibreRow[]> {
  const response = await fetch(
    `${APIFY_API}/datasets/${encodeURIComponent(
      datasetId
    )}/items?format=json&clean=true&limit=80`,
    {
      headers: authHeaders({ Accept: "application/json" }),
      cache: "no-store"
    }
  );

  return parseJsonResponse<ApifyMercadoLibreRow[]>(
    response,
    "Apify dataset"
  );
}
