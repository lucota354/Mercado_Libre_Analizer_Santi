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

type RequestBody = {
  vehicle: VehicleInput;
  damages: DamageInput[];
};

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;

    if (!body.vehicle?.brand || !body.vehicle?.model || !body.vehicle?.year) {
      return NextResponse.json(
        { error: "Faltan marca, modelo o año del vehículo." },
        { status: 400 }
      );
    }

    const damages = (body.damages ?? []).filter((damage) => damage.partName?.trim());
    if (!damages.length) {
      return NextResponse.json(
        { error: "Agregá al menos un repuesto/daño." },
        { status: 400 }
      );
    }

    const resolvedSession = await resolveMercadoLibreSession(request);
    if (!resolvedSession) {
      return NextResponse.json(
        {
          error:
            "Mercado Libre no está conectado. Usá el botón Conectar Mercado Libre."
        },
        { status: 401 }
      );
    }

    const client = new MercadoLibreClient(resolvedSession.session.accessToken);

    const groups = [];

    for (const damage of damages) {
      const plan = createSearchPlan(body.vehicle, damage);
      const searchMaps = new Map<
        string,
        { id: string; title: string; permalink: string; price?: number; currencyId?: string }
      >();

      for (const query of plan.queries.slice(0, 4)) {
        const results = await client.searchArgentina(query);
        for (const result of results) {
          if (!searchMaps.has(result.id)) searchMaps.set(result.id, result);
          if (searchMaps.size >= 16) break;
        }
        if (searchMaps.size >= 16) break;
      }

      const searchResults = [...searchMaps.values()];
      const items = await client.getItems(searchResults.map((result) => result.id));
      const searchById = new Map(searchResults.map((result) => [result.id, result]));

      const candidates = await Promise.all(
        items.slice(0, 12).map(async (item) => {
          const search = searchById.get(item.id);

          const [priceResult, compatibility] = await Promise.all([
            client
              .getSalePrice(item.id)
              .catch(() => ({
                amount: Number(search?.price ?? 0),
                currencyId: search?.currencyId ?? "ARS"
              })),
            client.getItemCompatibilityEvidence(item.id, body.vehicle)
          ]);

          const listing = client.toCandidateListing(
            item,
            priceResult,
            compatibility,
            search?.permalink
          );
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

    if (resolvedSession.refreshed) {
      attachMercadoLibreSessionCookie(response, resolvedSession.session);
    }

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
