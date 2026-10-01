import type { OemResearchJob, OemSource } from "./types";
import { makeSource } from "./research";

type GoogleOrganicResult = {
  title?: string | null;
  url?: string | null;
  description?: string | null;
  snippet?: string | null;
};

type GooglePage = {
  searchQuery?: {
    term?: string | null;
  };
  query?: string | null;
  organicResults?: GoogleOrganicResult[] | null;
};

type RunSnapshot = {
  id: string;
  status: string;
  defaultDatasetId?: string;
  statusMessage?: string | null;
};

const APIFY_API = "https://api.apify.com/v2";
const ACTOR_ID = "apify~google-search-scraper";

function authHeaders(apiToken: string, extra?: HeadersInit) {
  const headers = new Headers(extra);
  headers.set("Authorization", "Bearer " + apiToken);
  return headers;
}

async function parseJson<T>(response: Response, label: string): Promise<T> {
  const raw = await response.text();

  if (!response.ok) {
    throw new Error(
      label +
        " " +
        response.status +
        ": " +
        (raw.slice(0, 400) || response.statusText)
    );
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(label + " devolvió una respuesta no JSON.");
  }
}

export async function startOemWebSearch(
  apiToken: string,
  damageId: string,
  queries: string[]
): Promise<OemResearchJob> {
  const response = await fetch(
    APIFY_API + "/actors/" + ACTOR_ID + "/runs?timeout=180",
    {
      method: "POST",
      headers: authHeaders(apiToken, {
        "Content-Type": "application/json",
        Accept: "application/json"
      }),
      body: JSON.stringify({
        queries: queries.join("\n"),
        maxPagesPerQuery: 1,
        countryCode: "ar",
        languageCode: "es",
        mobileResults: false,
        includeUnfilteredResults: false,
        saveHtml: false,
        saveHtmlToKeyValueStore: false,
        includeIcons: false
      }),
      cache: "no-store"
    }
  );

  const payload = await parseJson<{ data?: { id?: string } }>(
    response,
    "Apify Google start"
  );

  if (!payload.data?.id) {
    throw new Error("Apify no devolvió un runId para la investigación OEM.");
  }

  return {
    runId: payload.data.id,
    damageId,
    queries
  };
}

export async function getOemWebSearchRun(
  apiToken: string,
  runId: string
): Promise<RunSnapshot> {
  const response = await fetch(
    APIFY_API + "/actor-runs/" + encodeURIComponent(runId),
    {
      headers: authHeaders(apiToken, { Accept: "application/json" }),
      cache: "no-store"
    }
  );

  const payload = await parseJson<{ data?: RunSnapshot }>(
    response,
    "Apify Google status"
  );

  if (!payload.data?.id) {
    throw new Error("Apify no devolvió el estado de la investigación OEM.");
  }

  return payload.data;
}

export async function getOemWebSearchSources(
  apiToken: string,
  datasetId: string
): Promise<OemSource[]> {
  const response = await fetch(
    APIFY_API +
      "/datasets/" +
      encodeURIComponent(datasetId) +
      "/items?format=json&clean=true&limit=20",
    {
      headers: authHeaders(apiToken, { Accept: "application/json" }),
      cache: "no-store"
    }
  );

  const pages = await parseJson<GooglePage[]>(response, "Apify Google dataset");
  const sources: OemSource[] = [];

  for (const page of pages) {
    const query =
      page.searchQuery?.term?.trim() ||
      page.query?.trim() ||
      "Investigación OEM";

    for (const result of page.organicResults ?? []) {
      const url = result.url?.trim();
      if (!url) continue;

      const source = makeSource(
        result.title ?? "",
        url,
        result.description ?? result.snippet ?? "",
        query
      );

      if (source && !sources.some((item) => item.url === source.url)) {
        sources.push(source);
      }
    }
  }

  return sources.slice(0, 50);
}
