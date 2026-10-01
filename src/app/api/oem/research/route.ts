import { NextResponse } from "next/server";
import type { DamageInput, VehicleInput } from "@/lib/domain/types";
import { resolveApifyAuth } from "@/lib/auth/apify-session";
import { buildOemResearchQueries } from "@/lib/oem/research";
import { startOemWebSearch } from "@/lib/oem/apify-google";
import { parseVehicleYear } from "@/lib/validation/vehicle-year";

type RequestBody = {
  vehicle: VehicleInput;
  damage: DamageInput;
};

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    const validYear = parseVehicleYear(body.vehicle?.year);

    if (
      !body.vehicle?.brand ||
      !body.vehicle?.model ||
      validYear === null ||
      !body.damage?.partName
    ) {
      return NextResponse.json(
        { error: "Faltan datos del vehículo o de la pieza." },
        { status: 400 }
      );
    }

    const apifyAuth = resolveApifyAuth(request);
    if (!apifyAuth) {
      return NextResponse.json(
        {
          error:
            "Apify no está conectado. Configurá Apify antes de investigar el OEM."
        },
        { status: 401 }
      );
    }

    const vehicle = { ...body.vehicle, year: validYear };
    const queries = buildOemResearchQueries(vehicle, body.damage);

    const job = await startOemWebSearch(
      apifyAuth.apiToken,
      body.damage.id,
      queries
    );

    return NextResponse.json(
      {
        status: "pending",
        job,
        message:
          "Investigando catálogos OEM y fuentes técnicas. Esto puede tardar unos segundos."
      },
      { status: 202 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo iniciar la investigación OEM."
      },
      { status: 500 }
    );
  }
}
