import { NextResponse } from "next/server";
import { MercadoLibreClient } from "@/lib/marketplace/mercadolibre-client";
import type { VehicleKnownAttribute } from "@/lib/marketplace/mercadolibre-gateway";

type RequestBody = {
  attributeId: VehicleKnownAttribute["id"];
  knownAttributes?: VehicleKnownAttribute[];
};

const allowed = new Set(["BRAND", "MODEL", "VEHICLE_YEAR", "SHORT_VERSION", "ENGINE"]);

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;

    if (!allowed.has(body.attributeId)) {
      return NextResponse.json({ error: "Atributo de vehículo inválido." }, { status: 400 });
    }

    const client = new MercadoLibreClient();
    const values = await client.getVehicleValues(
      body.attributeId,
      body.knownAttributes ?? []
    );

    return NextResponse.json({ values });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
