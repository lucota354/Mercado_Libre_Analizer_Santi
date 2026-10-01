import * as cheerio from "cheerio";
import type { DamageInput, VehicleInput } from "@/lib/domain/types";
import type { OemCandidate, OemSource } from "./types";

const TRUSTED_DOMAINS = [
  "nemigaparts.com",
  "partsouq.com",
  "catcar.info",
  "amayama.com"
];

const PART_TRANSLATIONS: Array<[RegExp, string]> = [
  [/paragolpes?|parachoques?|bumper/i, "bumper"],
  [/port[oó]n|tapa de ba[uú]l|ba[uú]l/i, "rear hatch tailgate"],
  [/luneta|vidrio trasero/i, "rear glass"],
  [/parabrisas/i, "windshield"],
  [/faro|[oó]ptica/i, "headlight"],
  [/guardabarros/i, "fender"],
  [/cap[oó]t/i, "hood"],
  [/puerta/i, "door"],
  [/espejo/i, "mirror"],
  [/parrilla/i, "grille"],
  [/radiador/i, "radiator"],
  [/condensador/i, "condenser"],
  [/amortiguador/i, "shock absorber"],
  [/llanta/i, "wheel"],
  [/semieje/i, "drive shaft"],
  [/caja de direcci[oó]n/i, "steering rack"]
];

const POSITION_TRANSLATIONS: Array<[RegExp, string]> = [
  [/traser[oa]/i, "rear"],
  [/delanter[oa]/i, "front"],
  [/izquierd[oa]/i, "left"],
  [/derech[oa]/i, "right"]
];

function normalizeText(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function englishPart(value: string) {
  for (const [pattern, translated] of PART_TRANSLATIONS) {
    if (pattern.test(value)) return translated;
  }
  return value.trim();
}

function englishPosition(value?: string) {
  if (!value) return "";
  const terms: string[] = [];
  for (const [pattern, translated] of POSITION_TRANSLATIONS) {
    if (pattern.test(value)) terms.push(translated);
  }
  return terms.join(" ");
}

export function buildOemResearchQueries(
  vehicle: VehicleInput,
  damage: DamageInput
) {
  const brand = vehicle.brand.trim();
  const model = vehicle.model.trim();
  const year = String(vehicle.year);
  const version = vehicle.version?.trim() ?? "";
  const engine = vehicle.engine?.trim() ?? "";
  const chassisNumber = vehicle.chassisNumber?.trim() ?? "";
  const partEs = [damage.partName, damage.position].filter(Boolean).join(" ");
  const partEn = [englishPosition(damage.position), englishPart(damage.partName)]
    .filter(Boolean)
    .join(" ");
  const vehicleCore = [brand, model, year, version, engine]
    .filter(Boolean)
    .join(" ");

  const base = [
    vehicleCore + " " + partEn + " OEM part number",
    brand + " " + model + " " + year + " " + partEs + " numero de pieza OEM",
    chassisNumber
      ? chassisNumber + " " + partEn + " OEM part number"
      : ""
  ].filter(Boolean);

  const targeted = TRUSTED_DOMAINS.map(
    (domain) =>
      brand + " " + model + " " + year + " " + partEn + " OEM site:" + domain
  );

  return [...new Set([...base, ...targeted])].slice(0, 6);
}

function normalizeCode(raw: string) {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function displayCode(raw: string) {
  return raw
    .toUpperCase()
    .replace(/\s+/g, " ")
    .replace(/^(?:OEM|OE|PN|P\/N|PART\s*(?:NO|NUMBER))\s*[:#-]?\s*/i, "")
    .replace(/^[-\s]+|[-\s]+$/g, "")
    .trim();
}

function plausibleCode(raw: string) {
  const normalized = normalizeCode(raw);
  if (normalized.length < 6 || normalized.length > 18) return false;
  if (/^(19|20)\d{2}$/.test(normalized)) return false;
  if (/^\d{1,6}$/.test(normalized)) return false;
  if (/\b(?:19|20)\d{2}\s*[-\/]\s*(?:19|20)\d{2}\b/.test(raw)) {
    return false;
  }
  if (/^\d{3,5}(?:CC|HP|KW|CV|KG|MM|CM)$/i.test(normalized)) {
    return false;
  }

  const digitCount = (normalized.match(/\d/g) ?? []).length;
  const letterCount = (normalized.match(/[A-Z]/g) ?? []).length;

  if (digitCount < 4) return false;
  if (letterCount === 0 && normalized.length < 8) return false;
  return true;
}

export function extractOemCodes(text: string) {
  const candidates = new Set<string>();
  const patterns = [
    /\b[A-Z0-9]{2,5}(?:[\s-][A-Z0-9]{2,6}){1,3}(?:[\s-][A-Z])?\b/gi,
    /\b[A-Z0-9]{7,18}\b/gi
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const raw = displayCode(match[0]);
      if (plausibleCode(raw)) candidates.add(raw);
    }
  }

  return [...candidates];
}

function sourceDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function trustedDomainScore(domain: string) {
  if (domain.endsWith("nemigaparts.com")) return 26;
  if (domain.endsWith("partsouq.com")) return 26;
  if (domain.endsWith("catcar.info")) return 24;
  if (domain.endsWith("amayama.com")) return 22;
  return 6;
}

function contextualScore(
  source: OemSource,
  vehicle: VehicleInput,
  damage: DamageInput
) {
  const raw = source.title + " " + source.snippet;
  const text = normalizeText(raw);
  let score = trustedDomainScore(source.domain);

  const model = normalizeText(vehicle.model);
  const brand = normalizeText(vehicle.brand);
  const part = normalizeText(damage.partName);
  const position = normalizeText(damage.position);
  const partEn = normalizeText(englishPart(damage.partName));
  const positionEn = normalizeText(englishPosition(damage.position));

  if (brand && text.includes(brand)) score += 8;
  if (model && text.includes(model)) score += 14;
  if (text.includes(String(vehicle.year))) score += 8;
  if (part && text.includes(part)) score += 10;
  if (partEn && text.includes(partEn)) score += 10;
  if (position && text.includes(position)) score += 6;
  if (positionEn && text.includes(positionEn)) score += 6;

  if (/\\boem\\b|part number|part no|numero de pieza|número de pieza/i.test(raw)) {
    score += 10;
  }

  return score;
}

function codeProximityScore(code: string, source: OemSource) {
  const text = source.title + " " + source.snippet;
  const normalized = normalizeCode(code);
  const textNormalized = normalizeCode(text);
  const index = textNormalized.indexOf(normalized);
  if (index < 0) return 0;

  return /oem|part number|part no|numero de pieza|número de pieza/i.test(text)
    ? 18
    : 8;
}

export function rankOemCandidates(
  sources: OemSource[],
  vehicle: VehicleInput,
  damage: DamageInput
): OemCandidate[] {
  const map = new Map<
    string,
    {
      display: string;
      score: number;
      evidence: string[];
      sources: OemSource[];
    }
  >();

  for (const source of sources) {
    const text = source.title + " " + source.snippet;
    const codes = extractOemCodes(text);

    for (const rawCode of codes) {
      const normalized = normalizeCode(rawCode);
      const existing = map.get(normalized) ?? {
        display: rawCode,
        score: 0,
        evidence: [],
        sources: []
      };

      existing.score +=
        contextualScore(source, vehicle, damage) +
        codeProximityScore(rawCode, source);

      if (!existing.sources.some((item) => item.url === source.url)) {
        existing.sources.push(source);
      }

      if (source.domain) {
        existing.evidence.push("Código encontrado en " + source.domain);
      }

      const normalizedSource = normalizeText(source.title + " " + source.snippet);
      if (
        normalizeText(vehicle.model) &&
        normalizedSource.includes(normalizeText(vehicle.model))
      ) {
        existing.evidence.push("La fuente menciona " + vehicle.model);
      }

      if ((source.title + source.snippet).includes(String(vehicle.year))) {
        existing.evidence.push("La fuente menciona el año " + vehicle.year);
      }

      map.set(normalized, existing);
    }
  }

  return [...map.entries()]
    .map(([normalizedCode, item]) => {
      const sourceBonus = Math.min(20, item.sources.length * 6);
      const score = item.score + sourceBonus;
      const confidence =
        score >= 95 ? "high" : score >= 60 ? "medium" : "low";

      return {
        code: item.display,
        normalizedCode,
        confidence,
        score,
        evidence: [...new Set(item.evidence)].slice(0, 6),
        sources: item.sources.slice(0, 5)
      } satisfies OemCandidate;
    })
    .filter((candidate) => candidate.score >= 35)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

export function makeSource(
  title: string,
  url: string,
  snippet: string,
  query: string
): OemSource | null {
  const domain = sourceDomain(url);
  if (!url.startsWith("http")) return null;

  return {
    title: title.trim(),
    url,
    domain,
    snippet: snippet.trim(),
    query
  };
}


function isTrustedSource(domain: string) {
  return TRUSTED_DOMAINS.some(
    (trusted) => domain === trusted || domain.endsWith("." + trusted)
  );
}

function focusedCatalogText(
  rawText: string,
  vehicle: VehicleInput,
  damage: DamageInput
) {
  const text = rawText.replace(/\s+/g, " ").trim();
  if (!text) return "";

  const needles = [
    vehicle.brand,
    vehicle.model,
    String(vehicle.year),
    damage.partName,
    damage.position ?? "",
    englishPart(damage.partName),
    englishPosition(damage.position)
  ]
    .map((value) => normalizeText(value))
    .filter((value) => value.length >= 3);

  const lower = normalizeText(text);
  const windows: string[] = [];

  for (const needle of needles) {
    let cursor = 0;
    let count = 0;

    while (count < 3) {
      const index = lower.indexOf(needle, cursor);
      if (index < 0) break;

      const start = Math.max(0, index - 450);
      const end = Math.min(text.length, index + needle.length + 900);
      windows.push(text.slice(start, end));

      cursor = index + needle.length;
      count += 1;
    }
  }

  if (!windows.length) {
    return text.slice(0, 6000);
  }

  return [...new Set(windows)].join(" · ").slice(0, 12000);
}

export async function enrichOemSourcesFromPages(
  sources: OemSource[],
  vehicle: VehicleInput,
  damage: DamageInput
): Promise<OemSource[]> {
  const targets = sources
    .filter((source) => isTrustedSource(source.domain))
    .slice(0, 8);

  const enriched = new Map<string, OemSource>();

  await Promise.all(
    targets.map(async (source) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7000);

      try {
        const response = await fetch(source.url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154 Safari/537.36",
            Accept: "text/html,application/xhtml+xml"
          },
          cache: "no-store",
          signal: controller.signal
        });

        if (!response.ok) return;

        const html = await response.text();
        if (!html || html.length > 4_000_000) return;

        const $ = cheerio.load(html);
        $("script,style,noscript,svg").remove();

        const pageText = focusedCatalogText(
          $("body").text(),
          vehicle,
          damage
        );

        if (!pageText) return;

        enriched.set(source.url, {
          ...source,
          snippet: [source.snippet, pageText]
            .filter(Boolean)
            .join(" · ")
            .slice(0, 14000)
        });
      } catch {
        // Best effort only: Google snippets remain usable when the catalog
        // blocks direct requests.
      } finally {
        clearTimeout(timeout);
      }
    })
  );

  return sources.map((source) => enriched.get(source.url) ?? source);
}
