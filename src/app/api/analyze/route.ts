import { NextResponse } from "next/server";
import type { DamageInput, VehicleInput } from "@/lib/domain/types";
import { createSearchPlan } from "@/lib/marketplace/search-plan";
import { startMercadoLibreApifySearch } from "@/lib/marketplace/apify-mercadolibre";
import { parseVehicleYear } from "@/lib/validation/vehicle-year";
import { resolveApifyAuth } from "@/lib/auth/apify-session";

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

    const apifyAuth = resolveApifyAuth(request);
    if (!apifyAuth) {
      return NextResponse.json(
        {
          error:
            "Apify no está conectado. Completá la configuración inicial y pegá tu API token."
        },
        { status: 401 }
      );
    }

    const damages = (body.damages ?? []).filter((damage) =>
      damage.partName?.trim()
    );

    if (!damages.length) {
      return NextResponse.json(
        { error: "Agregá al menos un repuesto/daño." },
        { status: 400 }
      );
    }

    const vehicle = { ...body.vehicle, year: validYear };

    const jobs = await Promise.all(
      damages.map(async (damage) => {
        const plan = createSearchPlan(vehicle, damage);
        const primaryQuery = plan.queries[0];

        if (!primaryQuery) {
          throw new Error(`No se pudo construir la búsqueda para ${damage.partName}.`);
        }

        return startMercadoLibreApifySearch(
          apifyAuth.apiToken,
          damage.id,
          primaryQuery,
          0
        );
      })
    );

    return NextResponse.json(
      {
        status: "pending",
        jobs,
        message: "Mercado Libre está siendo consultado. El análisis continuará automáticamente."
      },
      { status: 202 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error desconocido al iniciar la búsqueda.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
