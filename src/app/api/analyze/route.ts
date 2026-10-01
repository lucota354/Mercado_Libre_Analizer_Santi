import { NextResponse } from "next/server";
import type { DamageInput, PriceSummary, VehicleInput } from "@/lib/domain/types";
import { evaluateListing } from "@/lib/marketplace/evaluate-listing";
import {
  attachMercadoLibreSessionCookie,
  resolveMercadoLibreSession
} from "@/lib/auth/resolve-meli-session";
import { MercadoLibreClient } from "@/lib/marketplace/mercadolibre-client";
import { createSearchPlan } from "@/lib/marketplace/search-plan";
import { calculateCustomerQuote } from "@/lib/pricing/customer-quote";
import { calculateRobustPrice } from "@/lib/pricing/robust-price";
import { parseVehicleYear } from "@/lib/validation/vehicle-year";

type RequestBody = {
  vehicle: VehicleInput;
  damages: DamageInput[];
};

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;

    if (!body.vehicle?.brand || !body.vehicle?.model || body.vehicle?.year == null) {
      return NextResponse.json(
        { error: "Faltan marca, modelo o año del vehículo." },
        { status: 400 }
      );
    }

    const validYear = parseVehicleYear(body.vehicle.year);
    if (validYear === null) {
      return NextResponse.json(
        { error: "El año del vehículo debe tener 4 dígitos y estar entre 1900 y 2100." },
        { status: 400 }
      );
    }

    body.vehicle.year = validYear;

    const damages = (body.damages ?? []).filter((damage) => damage.partName?.trim());
    if (!damages.length) {
      return NextResponse.json(
        { error: "Agregá al menos un repuesto/daño." },
        { status: 400 }
      );
    }

    if (!process.env.APIFY_TOKEN) {
      return NextResponse.json(
        {
          error:
            "La búsqueda robusta no está configurada. Falta APIFY_TOKEN en Vercel Production."
        },
        { status: 503 }
      );
    }

    const resolvedSession = await resolveMercadoLibreSession(request);
    const client = new MercadoLibreClient(resolvedSession?.session.accessToken);

    const groups = [];

    for (const damage of damages) {
      const plan = createSearchPlan(body.vehicle, damage);
      const searchMaps = new Map<
        string,
        {
          id: string;
          title: string;
          permalink: string;
          price?: number;
          currencyId?: string;
          condition?: string;
          brand?: string;
          description?: string;
          oemCode?: string;
          source?: string;
        }
      >();

      for (const [queryIndex, query] of plan.queries.slice(0, 4).entries()) {
        const results = await client.searchArgentina(query, {
          useApify: queryIndex === 0
        });

        for (const result of results) {
          if (!searchMaps.has(result.id)) searchMaps.set(result.id, result);
          if (searchMaps.size >= 8) break;
        }

        if (searchMaps.size >= 8) break;
      }

      const searchResults = [...searchMaps.values()];
      const items = await client.getItems(searchResults.map((result) => result.id));
      const searchById = new Map(searchResults.map((result) => [result.id, result]));
      const itemById = new Map(items.map((item) => [item.id, item]));

      // Never hide discovery results just because the item-detail endpoint did
      // not return that particular listing. Keep a minimal candidate so the
      // operator can see and open what Mercado Libre search actually found.
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
            apiItemId
              ? client.getItemCompatibilityEvidence(item.id, body.vehicle)
              : Promise.resolve({
                  status: "unknown" as const,
                  source: "manual" as const,
                  checkedAt: new Date().toISOString(),
                  note:
                    "Publicación descubierta por búsqueda web; compatibilidad pendiente de validación."
                })
          ]);

          const listing = client.toCandidateListing(
            item,
            priceResult,
            compatibility,
            search?.permalink
          );

          // Search scrapers can know more than the item API for traditional
          // listings. Preserve those public fields instead of discarding them.
          listing.condition = listing.condition ?? search?.condition;
          listing.brand = listing.brand ?? search?.brand;
          listing.oemCode = listing.oemCode ?? search?.oemCode;
          listing.description = listing.description ?? search?.description;

          const evaluation = evaluateListing(listing, body.vehicle, damage);

          return { listing, evaluation };
        })
      );

      const valid = candidates.filter(
        (candidate) => candidate.evaluation.valid && candidate.listing.price > 0
      );

      let priceSummary: PriceSummary | null = null;
      let purchaseReference = null;
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
        plan,
        candidates,
        foundCount: searchResults.length,
        detailedCount: items.length,
        validCount: valid.length,
        priceSummary,
        purchaseReference,
        customerQuote
      });
    }

    const response = NextResponse.json({
      vehicle: body.vehicle,
      groups,
      generatedAt: new Date().toISOString()
    });

    if (resolvedSession?.refreshed) {
      attachMercadoLibreSessionCookie(response, resolvedSession.session);
    }

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
