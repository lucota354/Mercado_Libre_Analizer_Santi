import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    ok: true,
    mercadoLibreTokenConfigured: Boolean(process.env.MELI_ACCESS_TOKEN),
    timestamp: new Date().toISOString()
  });
}
