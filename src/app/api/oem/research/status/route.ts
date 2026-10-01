import { NextResponse } from "next/server";
import type { DamageInput, VehicleInput } from "@/lib/domain/types";
import { resolveApifyAuth } from "@/lib/auth/apify-session";
import {
  getOemWebSearchRun,
  getOemWebSearchSources
} from "@/lib/oem/apify-google";
import { enrichOemSourcesFromPages, rankOemCandidates } from "@/lib/oem/research";
import type { OemResearchJob } from "@/lib/oem/types";
import { parseVehicleYear } from "@/lib/validation/vehicle-year";

type RequestBody = {
  vehicle: VehicleInput;
  damage: DamageInput;
  job: OemResearchJob;
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

    if (
      !body.vehicle?.brand ||
      !body.vehicle?.model ||
      validYear === null ||
      !body.damage?.partName ||
      !body.job?.runId
    ) {
      return NextResponse.json(
        { error: "Datos incompletos para continuar la investigación OEM." },
        { status: 400 }
      );
    }

    const apifyAuth = resolveApifyAuth(request);
    if (!apifyAuth) {
      return NextResponse.json(
        { error: "La conexión con Apify ya no está disponible." },
        { status: 401 }
      );
    }

    const snapshot = await getOemWebSearchRun(
      apifyAuth.apiToken,
      body.job.runId
    );

    if (TERMINAL_FAILURES.has(snapshot.status)) {
      return NextResponse.json(
        {
          error:
            "La investigación OEM falló. Estado: " +
            snapshot.status +
            (snapshot.statusMessage ? " · " + snapshot.statusMessage : "")
        },
        { status: 502 }
      );
    }

    if (snapshot.status !== "SUCCEEDED") {
      return NextResponse.json(
        {
          status: "pending",
          job: body.job,
          providerStatus: snapshot.status
        },
        { status: 202 }
      );
    }

    if (!snapshot.defaultDatasetId) {
      return NextResponse.json(
        {
          status: "complete",
          result: {
            vehicle: { ...body.vehicle, year: validYear },
            damage: body.damage,
            queries: body.job.queries,
            candidates: [],
            sourceCount: 0,
            generatedAt: new Date().toISOString()
          }
        }
      );
    }

    const sources = await getOemWebSearchSources(
      apifyAuth.apiToken,
      snapshot.defaultDatasetId
    );

    const vehicle = { ...body.vehicle, year: validYear };
    const enrichedSources = await enrichOemSourcesFromPages(
      sources,
      vehicle,
      body.damage
    );
    const candidates = rankOemCandidates(
      enrichedSources,
      vehicle,
      body.damage
    );

    return NextResponse.json({
      status: "complete",
      result: {
        vehicle,
        damage: body.damage,
        queries: body.job.queries,
        candidates,
        sourceCount: enrichedSources.length,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo completar la investigación OEM."
      },
      { status: 500 }
    );
  }
}
