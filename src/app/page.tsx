"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  CandidateListing,
  DamageInput,
  EvaluationResult,
  PriceSummary,
  VehicleInput
} from "@/lib/domain/types";
import { getLaborRatesForVehicleYear } from "@/lib/pricing/labor-rates";
import { calculateWorkshopEstimate } from "@/lib/pricing/workshop-estimate";
import { parseVehicleYear } from "@/lib/validation/vehicle-year";
import ApifyOnboarding from "@/components/ApifyOnboarding";

type CandidateResult = {
  listing: CandidateListing;
  evaluation: EvaluationResult;
};

type AnalysisGroup = {
  damage: DamageInput;
  candidates: CandidateResult[];
  foundCount?: number;
  detailedCount?: number;
  validCount: number;
  providerDiagnostics?: {
    query: string;
    runId: string;
    runStatus: string;
    rawRows: number;
    mappedCount: number;
    note?: string;
  };
  priceSummary: PriceSummary | null;
  purchaseReference: number | null;
  customerQuote: {
    purchaseReference: number;
    markupPercent: number;
    rawQuote: number;
    quotedPrice: number;
    roundTo: number;
  } | null;
};

type AnalysisResponse = {
  status?: "pending" | "complete";
  vehicle: VehicleInput;
  groups: AnalysisGroup[];
  generatedAt: string;
  error?: string;
};

type SearchJob = {
  damageId: string;
  runId: string;
  query: string;
  queryIndex: number;
};

type PendingResponse = {
  status: "pending";
  jobs: SearchJob[];
  providerRuns?: Array<{
    damageId: string;
    query: string;
    runId: string;
    status: string;
  }>;
  message?: string;
  error?: string;
};

const money = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0
});

const emptyVehicle: VehicleInput = {
  brand: "",
  model: "",
  year: 2013,
  version: "",
  engine: ""
};

const newDamage = (): DamageInput => ({
  id: crypto.randomUUID(),
  partName: "",
  position: "",
  notes: ""
});

function numberValue(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export default function HomePage() {
  const [vehicle, setVehicle] = useState<VehicleInput>(emptyVehicle);
  const [damages, setDamages] = useState<DamageInput[]>([newDamage()]);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState("");
  const [error, setError] = useState("");
  const [bodyworkDays, setBodyworkDays] = useState(0);
  const [paintPanels, setPaintPanels] = useState(0);
  const [mechanicHours, setMechanicHours] = useState(0);
  const [other, setOther] = useState(0);
  const [meliConnected, setMeliConnected] = useState<boolean | null>(null);
  const [apifyConnected, setApifyConnected] = useState<boolean | null>(null);
  const [apifyUsername, setApifyUsername] = useState<string | null>(null);
  const [apifySource, setApifySource] = useState<"browser" | "environment" | "none">("none");
  const [meliConnectionState, setMeliConnectionState] = useState<
    "connected" | "invalid_session" | "no_session" | null
  >(null);
  const [apifySetupOpen, setApifySetupOpen] = useState(false);
  const [yearInput, setYearInput] = useState(String(emptyVehicle.year));

  async function refreshConnectionStatus() {
    const [meliResult, apifyResult] = await Promise.allSettled([
      fetch("/api/auth/mercadolibre/status", { cache: "no-store" }),
      fetch("/api/auth/apify/status", { cache: "no-store" })
    ]);

    if (meliResult.status === "fulfilled" && meliResult.value.ok) {
      const data = (await meliResult.value.json()) as {
        connected?: boolean;
        connectionState?: "connected" | "invalid_session" | "no_session";
      };
      setMeliConnected(Boolean(data.connected));
      setMeliConnectionState(data.connectionState ?? null);
    } else {
      setMeliConnected(false);
    }

    if (apifyResult.status === "fulfilled" && apifyResult.value.ok) {
      const data = (await apifyResult.value.json()) as {
        connected?: boolean;
        source?: "browser" | "environment" | "none";
        username?: string | null;
      };

      setApifyConnected(Boolean(data.connected));
      setApifySource(data.source ?? "none");
      setApifyUsername(data.username ?? null);

      if (!data.connected || data.source === "environment") {
        setApifySetupOpen(true);
      }
    } else {
      setApifyConnected(false);
      setApifySource("none");
      setApifySetupOpen(true);
    }
  }

  useEffect(() => {
    refreshConnectionStatus();

    const params = new URLSearchParams(window.location.search);
    if (params.has("meli")) {
      window.history.replaceState({}, "", window.location.pathname);
      refreshConnectionStatus();
    }
  }, []);

  const validVehicleYear = useMemo(
    () => parseVehicleYear(yearInput),
    [yearInput]
  );

  const laborRates = useMemo(
    () =>
      validVehicleYear === null
        ? null
        : getLaborRatesForVehicleYear(validVehicleYear),
    [validVehicleYear]
  );

  const partsQuoted = useMemo(
    () =>
      analysis?.groups.reduce(
        (sum, group) => sum + (group.customerQuote?.quotedPrice ?? 0),
        0
      ) ?? 0,
    [analysis]
  );

  const workshop = useMemo(
    () =>
      validVehicleYear === null
        ? null
        : calculateWorkshopEstimate({
            vehicleYear: validVehicleYear,
            partsBodywork: partsQuoted,
            bodyworkDays,
            paintPanels,
            mechanicHours,
            other
          }),
    [
      validVehicleYear,
      partsQuoted,
      bodyworkDays,
      paintPanels,
      mechanicHours,
      other
    ]
  );

  const updateDamage = (id: string, patch: Partial<DamageInput>) => {
    setAnalysis(null);
    setDamages((current) =>
      current.map((damage) => (damage.id === id ? { ...damage, ...patch } : damage))
    );
  };

  async function readJsonResponse<T>(response: Response): Promise<T> {
    const raw = await response.text();

    try {
      return JSON.parse(raw) as T;
    } catch {
      throw new Error(
        "El servidor devolvió una respuesta inesperada (HTTP " +
          response.status +
          "): " +
          raw.slice(0, 180)
      );
    }
  }

  async function analyze() {
    setLoading(true);
    setLoadingStatus("Iniciando búsqueda en Mercado Libre…");
    setError("");
    setAnalysis(null);

    try {
      const startResponse = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicle, damages })
      });

      const startData = await readJsonResponse<PendingResponse | AnalysisResponse>(
        startResponse
      );

      if (!startResponse.ok && startResponse.status !== 202) {
        throw new Error(
          startData.error ||
            "No se pudo iniciar la búsqueda (HTTP " +
              startResponse.status +
              ")."
        );
      }

      if (startData.status !== "pending" || !("jobs" in startData)) {
        setAnalysis(startData as AnalysisResponse);
        return;
      }

      let jobs = startData.jobs;
      const startedAt = Date.now();
      const maxWaitMs = 4 * 60 * 1000;

      while (Date.now() - startedAt < maxWaitMs) {
        await new Promise((resolve) => setTimeout(resolve, 2500));

        const statusResponse = await fetch("/api/analyze/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vehicle, damages, jobs })
        });

        const statusData = await readJsonResponse<
          PendingResponse | AnalysisResponse
        >(statusResponse);

        if (!statusResponse.ok && statusResponse.status !== 202) {
          throw new Error(
            statusData.error ||
              "Falló el scraper (HTTP " + statusResponse.status + ")."
          );
        }

        if (statusData.status === "pending" && "jobs" in statusData) {
          jobs = statusData.jobs;

          const statuses =
            statusData.providerRuns
              ?.map((run) => run.status)
              .filter(Boolean)
              .join(", ") || "RUNNING";

          setLoadingStatus(
            "Buscando publicaciones reales… Estado: " + statuses
          );
          continue;
        }

        setAnalysis(statusData as AnalysisResponse);
        setLoadingStatus("");
        return;
      }

      throw new Error(
        "El scraper sigue ejecutándose después de 4 minutos. Revisá la ejecución en Apify e intentá nuevamente."
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Error inesperado.");
    } finally {
      setLoading(false);
      setLoadingStatus("");
    }
  }

  return (
    <main className="shell">
      <section className="hero">
        <span className="eyebrow">Cotizador · Mercado Libre Argentina · v0.2</span>
        <h1>Mercado Libre Analyzer Santi</h1>
        <p>
          Cargá el vehículo y las piezas dañadas. El sistema busca publicaciones,
          valida originalidad, condición y compatibilidad, calcula el valor de los
          repuestos y completa la mano de obra según el año del vehículo.
        </p>
      </section>

      <section className="connectionBar">
        <div>
          <strong>Conexiones</strong>
          <span>
            {meliConnected === null || apifyConnected === null
              ? "Verificando conexiones…"
              : apifyConnected && meliConnected
                ? "Todo listo para buscar repuestos y validar publicaciones."
                : apifyConnected
                  ? meliConnectionState === "invalid_session"
                    ? "Apify está listo. Reconectá Mercado Libre para sumar la validación adicional."
                    : "Apify está listo. Mercado Libre puede conectarse para sumar validaciones."
                  : "Falta conectar Apify para habilitar la búsqueda de repuestos."}
          </span>
        </div>
        <div className="connectionActions">
          <button
            className={apifyConnected ? "status valid statusButton" : "status pending statusButton"}
            type="button"
            onClick={() => setApifySetupOpen((current) => !current)}
          >
            {apifyConnected
              ? apifySource === "environment"
                ? "CONFIGURAR TU APIFY"
                : "APIFY CONECTADO"
              : "CONFIGURAR APIFY"}
          </button>
          {meliConnected ? (
            <span className="status valid">ML CONECTADO</span>
          ) : (
            <a className="primary connectButton" href="/api/auth/mercadolibre/start">
              Conectar Mercado Libre
            </a>
          )}
        </div>
      </section>

      {apifyConnected !== null && (
        <ApifyOnboarding
          connected={Boolean(apifyConnected)}
          username={apifyUsername}
          source={apifySource}
          open={apifySetupOpen || apifyConnected === false}
          onClose={() => setApifySetupOpen(false)}
          onConnected={refreshConnectionStatus}
        />
      )}

      <section className="card">
        <div className="sectionTitle">
          <div>
            <span className="step">01</span>
            <h2>Vehículo</h2>
          </div>
          <span className="badge">Argentina · MLA</span>
        </div>

        <div className="grid vehicle">
          <label>
            Marca
            <input
              placeholder="Peugeot"
              value={vehicle.brand}
              onChange={(event) => {
                setAnalysis(null);
                setVehicle({ ...vehicle, brand: event.target.value });
              }}
            />
          </label>
          <label>
            Modelo
            <input
              placeholder="206"
              value={vehicle.model}
              onChange={(event) => {
                setAnalysis(null);
                setVehicle({ ...vehicle, model: event.target.value });
              }}
            />
          </label>
          <label>
            Año
            <input
              type="number"
              min="1900"
              max="2100"
              inputMode="numeric"
              value={yearInput}
              aria-invalid={validVehicleYear === null}
              onChange={(event) => {
                const nextValue = event.target.value;
                setAnalysis(null);
                setYearInput(nextValue);

                const parsed = parseVehicleYear(nextValue);
                if (parsed !== null) {
                  setVehicle((current) => ({ ...current, year: parsed }));
                }
              }}
            />
            {validVehicleYear === null && (
              <small className="fieldError">
                Ingresá un año de 4 dígitos entre 1900 y 2100.
              </small>
            )}
          </label>
          <label>
            Versión
            <input
              placeholder="1.4 Active 75cv"
              value={vehicle.version ?? ""}
              onChange={(event) => {
                setAnalysis(null);
                setVehicle({ ...vehicle, version: event.target.value });
              }}
            />
          </label>
          <label>
            Motor
            <input
              placeholder="1.4"
              value={vehicle.engine ?? ""}
              onChange={(event) => {
                setAnalysis(null);
                setVehicle({ ...vehicle, engine: event.target.value });
              }}
            />
          </label>
        </div>

        {laborRates && validVehicleYear !== null ? (
          <div className="rateBar">
            <strong>Tarifa automática para {validVehicleYear}</strong>
            <span>Chapa {money.format((laborRates?.bodyworkPerDay ?? 0))}/día</span>
            <span>Pintura {money.format((laborRates?.paintPerPanel ?? 0))}/panel</span>
            <span>Mecánica {money.format((laborRates?.mechanicPerHour ?? 0))}/hora</span>
          </div>
        ) : (
          <div className="rateBar rateBarWarning">
            <strong>Completá un año válido para calcular la mano de obra.</strong>
          </div>
        )}
      </section>

      <section className="card">
        <div className="sectionTitle">
          <div>
            <span className="step">02</span>
            <h2>Daños / repuestos</h2>
          </div>
          <button
            className="secondary"
            type="button"
            onClick={() => setDamages([...damages, newDamage()])}
          >
            + Agregar pieza
          </button>
        </div>

        <div className="damageList">
          {damages.map((damage, index) => (
            <article className="damage" key={damage.id}>
              <div className="damageHeader">
                <strong>Pieza {index + 1}</strong>
                {damages.length > 1 && (
                  <button
                    type="button"
                    className="linkButton"
                    onClick={() => {
                      setAnalysis(null);
                      setDamages(damages.filter((item) => item.id !== damage.id));
                    }}
                  >
                    Eliminar
                  </button>
                )}
              </div>
              <div className="grid three">
                <label>
                  Repuesto
                  <input
                    placeholder="Paragolpe"
                    value={damage.partName}
                    onChange={(event) =>
                      updateDamage(damage.id, { partName: event.target.value })
                    }
                  />
                </label>
                <label>
                  Posición
                  <input
                    placeholder="Trasero"
                    value={damage.position ?? ""}
                    onChange={(event) =>
                      updateDamage(damage.id, { position: event.target.value })
                    }
                  />
                </label>
                <label>
                  Observaciones
                  <input
                    placeholder="Roto por impacto"
                    value={damage.notes ?? ""}
                    onChange={(event) =>
                      updateDamage(damage.id, { notes: event.target.value })
                    }
                  />
                </label>
              </div>
            </article>
          ))}
        </div>

        <button
          className="primary"
          type="button"
          disabled={
            loading ||
            apifyConnected !== true ||
            validVehicleYear === null ||
            !vehicle.brand ||
            !vehicle.model ||
            damages.every((damage) => !damage.partName.trim())
          }
          onClick={analyze}
        >
          {loading ? "Analizando Mercado Libre…" : "Buscar, validar y cotizar"}
        </button>

        {loadingStatus && <div className="loadingBox">{loadingStatus}</div>}
        {error && <div className="errorBox">{error}</div>}
      </section>

      {analysis && (
        <section className="card">
          <div className="sectionTitle">
            <div>
              <span className="step">03</span>
              <h2>Repuestos encontrados</h2>
            </div>
            <span className="badge green">Análisis realizado</span>
          </div>

          <div className="resultGroups">
            {analysis.groups.map((group) => (
              <article className="resultGroup" key={group.damage.id}>
                <div className="resultHeading">
                  <div>
                    <h3>
                      {group.damage.partName} {group.damage.position}
                    </h3>
                    <p>
                      {group.foundCount ?? group.candidates.length} publicación/es encontradas ·{" "}
                      {group.validCount} pasan todos los filtros.
                    </p>
                    {group.providerDiagnostics && (
                      <p className="providerDiagnostic">
                        Apify: {group.providerDiagnostics.rawRows} filas ·{" "}
                        {group.providerDiagnostics.mappedCount} publicaciones mapeadas ·{" "}
                        consulta: “{group.providerDiagnostics.query}”
                        {group.providerDiagnostics.note
                          ? " · " + group.providerDiagnostics.note
                          : ""}
                      </p>
                    )}
                  </div>
                  <div className="quoteNumbers">
                    <span>Costo confiable</span>
                    <strong>
                      {group.purchaseReference
                        ? money.format(group.purchaseReference)
                        : "Revisión manual"}
                    </strong>
                    <span>Cotización sugerida</span>
                    <strong className="quotePrice">
                      {group.customerQuote
                        ? money.format(group.customerQuote.quotedPrice)
                        : "—"}
                    </strong>
                  </div>
                </div>

                <div className="candidateList">
                  {group.candidates.map(({ listing, evaluation }) => (
                    <div className="candidate" key={listing.itemId}>
                      <div className="candidateMain">
                        <div className="candidateTop">
                          <span
                            className={
                              evaluation.valid ? "status valid" : "status rejected"
                            }
                          >
                            {evaluation.valid ? "APTA" : "DESCARTADA"}
                          </span>
                          <span
                            className={
                              listing.compatibility?.status === "compatible"
                                ? "status valid"
                                : listing.compatibility?.status === "incompatible"
                                  ? "status rejected"
                                  : "status pending"
                            }
                          >
                            Compatibilidad: {listing.compatibility?.status ?? "unknown"}
                          </span>
                        </div>
                        <strong>{listing.title}</strong>
                        <div className="candidateMeta">
                          <span>{money.format(listing.price)}</span>
                          <span>Marca: {listing.brand || "sin confirmar"}</span>
                          <span>OEM: {listing.oemCode || "—"}</span>
                          <span>Score: {evaluation.score}/100</span>
                        </div>
                        {!evaluation.valid && evaluation.rejectionReasons.length > 0 && (
                          <p className="rejectReason">
                            {evaluation.rejectionReasons.join(" · ")}
                          </p>
                        )}
                        {listing.compatibility?.note && (
                          <p className="compatNote">{listing.compatibility.note}</p>
                        )}
                      </div>
                      <a
                        href={listing.url}
                        target="_blank"
                        rel="noreferrer"
                        className="openLink"
                      >
                        Ver publicación
                      </a>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="card">
        <div className="sectionTitle">
          <div>
            <span className="step">04</span>
            <h2>Mano de obra y total</h2>
          </div>
          <span className="badge">Tarifas por año</span>
        </div>

        <div className="grid work">
          <label>
            Chapa · días
            <input
              type="number"
              min="0"
              step="0.5"
              value={bodyworkDays}
              onChange={(event) => setBodyworkDays(numberValue(event.target.value))}
            />
            <small>
              {bodyworkDays} × {money.format((laborRates?.bodyworkPerDay ?? 0))} ={" "}
              {money.format((workshop?.bodyworkSubtotal ?? 0))}
            </small>
          </label>
          <label>
            Pintura · paneles
            <input
              type="number"
              min="0"
              step="1"
              value={paintPanels}
              onChange={(event) => setPaintPanels(numberValue(event.target.value))}
            />
            <small>
              {paintPanels} × {money.format((laborRates?.paintPerPanel ?? 0))} ={" "}
              {money.format((workshop?.paintSubtotal ?? 0))}
            </small>
          </label>
          <label>
            Mecánica · horas
            <input
              type="number"
              min="0"
              step="0.5"
              value={mechanicHours}
              onChange={(event) => setMechanicHours(numberValue(event.target.value))}
            />
            <small>
              {mechanicHours} × {money.format((laborRates?.mechanicPerHour ?? 0))} ={" "}
              {money.format((workshop?.mechanicSubtotal ?? 0))}
            </small>
          </label>
          <label>
            Otros
            <input
              type="number"
              min="0"
              step="1000"
              value={other}
              onChange={(event) => setOther(numberValue(event.target.value))}
            />
          </label>
        </div>

        <div className="totals">
          <div>
            <span>Repuestos cotizados</span>
            <strong>{money.format(partsQuoted)}</strong>
          </div>
          <div>
            <span>Mano de obra chapa</span>
            <strong>{money.format((workshop?.bodyworkSubtotal ?? 0))}</strong>
          </div>
          <div>
            <span>Mano de obra pintura</span>
            <strong>{money.format((workshop?.paintSubtotal ?? 0))}</strong>
          </div>
          <div>
            <span>Mano de obra mecánica</span>
            <strong>{money.format((workshop?.mechanicSubtotal ?? 0))}</strong>
          </div>
          <div>
            <span>Otros</span>
            <strong>{money.format(other)}</strong>
          </div>
          <div className="grandTotal">
            <span>TOTAL PRESUPUESTADO</span>
            <strong>{money.format((workshop?.total ?? 0))}</strong>
          </div>
        </div>
      </section>

      <section className="notice">
        <strong>Regla crítica:</strong> una publicación con compatibilidad desconocida
        no entra al cálculo automático. Se conserva el link para revisión manual.
      </section>
    </main>
  );
}
