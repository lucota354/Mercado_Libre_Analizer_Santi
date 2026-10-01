import { NextResponse } from "next/server";
import type {
  DamageInput,
  PriceSummary,
  VehicleInput
} from "@/lib/domain/types";
import {
  getApifyDatasetRows,
  getApifyRunSnapshot,
  mapApifyRowsToMarketplaceItems,
  startMercadoLibreApifySearch,
  type ApifySearchJob
} from "@/lib/marketplace/apify-mercadolibre";
import { createSearchPlan } from "@/lib/marketplace/search-plan";
import { MercadoLibreClient } from "@/lib/marketplace/mercadolibre-client";
import { evaluateListing } from "@/lib/marketplace/evaluate-listing";
import { resolveCompatibilityEvidence } from "@/lib/marketplace/infer-compatibility";
import { calculateCustomerQuote } from "@/lib/pricing/customer-quote";
import { calculateRobustPrice } from "@/lib/pricing/robust-price";
import {
  attachMercadoLibreSessionCookie,
  resolveMercadoLibreSession
} from "@/lib/auth/resolve-meli-session";
import { parseVehicleYear } from "@/lib/validation/vehicle-year";

type RequestBody = {
  vehicle: VehicleInput;
  damages: DamageInput[];
  jobs: ApifySearchJob[];
};

const TERMINAL_FAILURES = new Set([
  "FAILED",
  "TIMED-OUT",
  "ABORTED"
]);

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;

    const validYear = parseVehicleYear(body.vehicle?.year);
    if (!body.vehicle?.brand || !body.vehicle?.model || validYear === null) {
      return NextResponse.json(
        { error: "Datos del vehículo inválidos al continuar el análisis." },
        { status: 400 }
      );
    }

    const damages = (body.damages ?? []).filter((damage) =>
      damage.partName?.trim()
    );

    if (!damages.length || !body.jobs?.length) {
      return NextResponse.json(
        { error: "Faltan daños o trabajos de búsqueda." },
        { status: 400 }
      );
    }

    const snapshots = await Promise.all(
      body.jobs.map(async (job) => ({
        job,
        snapshot: await getApifyRunSnapshot(job.runId)
      }))
    );

    const failed = snapshots.find(({ snapshot }) =>
      TERMINAL_FAILURES.has(snapshot.status)
    );

    if (failed) {
      return NextResponse.json(
        {
          error:
            `El scraper falló para "${failed.job.query}". Estado: ${failed.snapshot.status}. ` +
            (failed.snapshot.statusMessage || "")
        },
        { status: 502 }
      );
    }

    const pending = snapshots.filter(
      ({ snapshot }) => snapshot.status !== "SUCCEEDED"
    );

    if (pending.length) {
      return NextResponse.json(
        {
          status: "pending",
          jobs: body.jobs,
          providerRuns: snapshots.map(({ job, snapshot }) => ({
            damageId: job.damageId,
            query: job.query,
            runId: job.runId,
            status: snapshot.status
          }))
        },
        { status: 202 }
      );
    }

    const vehicle = { ...body.vehicle, year: validYear };

    // Before enrichment, inspect successful datasets. If a broad query truly
    // produced zero usable listings, automatically try the next search-plan
    // variant instead of returning a misleading final zero.
    const datasetCache = new Map<
      string,
      {
        rows: Awaited<ReturnType<typeof getApifyDatasetRows>>;
        mapped: ReturnType<typeof mapApifyRowsToMarketplaceItems>;
      }
    >();

    const replacementJobs = new Map<string, ApifySearchJob>();

    for (const damage of damages) {
      const run = snapshots.find(({ job }) => job.damageId === damage.id);
      if (!run?.snapshot.defaultDatasetId) continue;

      const rows = await getApifyDatasetRows(run.snapshot.defaultDatasetId);
      const mapped = mapApifyRowsToMarketplaceItems(rows);
      datasetCache.set(damage.id, { rows, mapped });

      if (mapped.length === 0 && run.job.queryIndex < 2) {
        const plan = createSearchPlan(vehicle, damage);
        const nextQueryIndex = run.job.queryIndex + 1;
        const nextQuery = plan.queries[nextQueryIndex];

        if (nextQuery) {
          const nextJob = await startMercadoLibreApifySearch(
            damage.id,
            nextQuery,
            nextQueryIndex
          );
          replacementJobs.set(damage.id, nextJob);
        }
      }
    }

    if (replacementJobs.size > 0) {
      const jobs = body.jobs.map(
        (job) => replacementJobs.get(job.damageId) ?? job
      );

      return NextResponse.json(
        {
          status: "pending",
          jobs,
          providerRuns: jobs.map((job) => ({
            damageId: job.damageId,
            query: job.query,
            runId: job.runId,
            status: replacementJobs.has(job.damageId)
              ? "READY"
              : "SUCCEEDED"
          })),
          message:
            "La primera búsqueda no devolvió publicaciones. Probando una variante automática."
        },
        { status: 202 }
      );
    }

    const resolvedSession = await resolveMercadoLibreSession(request);
    const client = new MercadoLibreClient(resolvedSession?.session.accessToken);

    const groups = [];

    for (const damage of damages) {
      const run = snapshots.find(
        ({ job }) => job.damageId === damage.id
      );

      if (!run?.snapshot.defaultDatasetId) {
        groups.push({
          damage,
          candidates: [],
          foundCount: 0,
          detailedCount: 0,
          validCount: 0,
          priceSummary: null,
          purchaseReference: null,
          customerQuote: null,
          providerDiagnostics: {
            query: run?.job.query ?? "",
            runId: run?.job.runId ?? "",
            runStatus: run?.snapshot.status ?? "missing",
            rawRows: 0,
            mappedCount: 0,
            note: "Apify terminó sin dataset asociado."
          }
        });
        continue;
      }

      const cached = datasetCache.get(damage.id);
      const rows =
        cached?.rows ??
        (await getApifyDatasetRows(run.snapshot.defaultDatasetId));
      const searchResults = (
        cached?.mapped ?? mapApifyRowsToMarketplaceItems(rows)
      ).slice(0, 20);

      const apiIds = searchResults
        .map((item) => item.id)
        .filter((id) => /^MLA\d+$/i.test(id));

      const items = await client.getItems(apiIds);
      const itemById = new Map(items.map((item) => [item.id, item]));
      const searchById = new Map(
        searchResults.map((result) => [result.id, result])
      );

      const candidateItems = searchResults.slice(0, 16).map((search) => {
        return (
          itemById.get(search.id) ?? {
            id: search.id,
            title: search.title,
            permalink: search.permalink
          }
        );
      });

      const candidates = await Promise.all(
        candidateItems.map(async (item) => {
          const search = searchById.get(item.id);
          const apiItemId = /^MLA\d+$/i.test(item.id);

          const [priceResult, compatibility] = await Promise.all([
            apiItemId
              ? client
                  .getSalePrice(item.id)
                  .catch(() => ({
                    amount: Number(search?.price ?? 0),
                    currencyId: search?.currencyId ?? "ARS"
                  }))
              : Promise.resolve({
                  amount: Number(search?.price ?? 0),
                  currencyId: search?.currencyId ?? "ARS"
                }),
            apiItemId && resolvedSession
              ? client.getItemCompatibilityEvidence(item.id, vehicle)
              : Promise.resolve({
                  status: "unknown" as const,
                  source: "manual" as const,
                  checkedAt: new Date().toISOString(),
                  note:
                    "Compatibilidad automática pendiente de Mercado Libre."
                })
          ]);

          const listing = client.toCandidateListing(
            item,
            priceResult,
            compatibility,
            search?.permalink
          );

          listing.condition = listing.condition ?? search?.condition;
          listing.brand = listing.brand ?? search?.brand;
          listing.oemCode = listing.oemCode ?? search?.oemCode;
          listing.description = listing.description ?? search?.description;
          listing.compatibility = resolveCompatibilityEvidence(
            compatibility,
            listing,
            vehicle
          );

          return {
            listing,
            evaluation: evaluateListing(listing, vehicle, damage)
          };
        })
      );

      const valid = candidates.filter(
        (candidate) =>
          candidate.evaluation.valid && candidate.listing.price > 0
      );

      let priceSummary: PriceSummary | null = null;
      let purchaseReference: number | null = null;
      let customerQuote = null;

      if (valid.length) {
        const prices = valid.map((candidate) => candidate.listing.price);
        priceSummary = calculateRobustPrice(prices);

        const acceptedPrices = prices.filter(
          (price) => !priceSummary?.removedOutliers.includes(price)
        );

        purchaseReference = Math.min(...acceptedPrices);
        customerQuote = calculateCustomerQuote(purchaseReference);
      }

      groups.push({
        damage,
        candidates,
        foundCount: searchResults.length,
        detailedCount: items.length,
        validCount: valid.length,
        priceSummary,
        purchaseReference,
        customerQuote,
        providerDiagnostics: {
          query: run.job.query,
          runId: run.job.runId,
          runStatus: run.snapshot.status,
          rawRows: rows.length,
          mappedCount: searchResults.length
        }
      });
    }

    const response = NextResponse.json({
      status: "complete",
      vehicle,
      groups,
      generatedAt: new Date().toISOString()
    });

    if (resolvedSession?.refreshed) {
      attachMercadoLibreSessionCookie(response, resolvedSession.session);
    }

    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error desconocido al continuar la búsqueda.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
