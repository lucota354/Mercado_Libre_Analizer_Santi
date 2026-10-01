"use client";

import { useState } from "react";
import type { DamageInput, VehicleInput } from "@/lib/domain/types";
import type { OemResearchJob, OemResearchResult } from "@/lib/oem/types";

type Props = {
  vehicle: VehicleInput;
  damage: DamageInput;
  apifyConnected: boolean;
  autoOpen?: boolean;
  onUseOem: (code: string) => void;
};

type PendingResponse = {
  status: "pending";
  job: OemResearchJob;
  providerStatus?: string;
  error?: string;
};

type CompleteResponse = {
  status: "complete";
  result: OemResearchResult;
  error?: string;
};

const confidenceLabel = {
  high: "Alta",
  medium: "Media",
  low: "Baja"
} as const;

export default function OemResearchPanel({
  vehicle,
  damage,
  apifyConnected,
  autoOpen = false,
  onUseOem
}: Props) {
  const [open, setOpen] = useState(autoOpen);
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<OemResearchResult | null>(null);

  async function readJson<T>(response: Response): Promise<T> {
    const raw = await response.text();
    try {
      return JSON.parse(raw) as T;
    } catch {
      throw new Error(
        "El servidor devolvió una respuesta inesperada (HTTP " +
          response.status +
          ")."
      );
    }
  }

  async function research() {
    if (!apifyConnected) {
      setError("Conectá Apify antes de investigar el OEM.");
      return;
    }

    setOpen(true);
    setLoading(true);
    setError("");
    setResult(null);
    setStatusText("Buscando el número de pieza original…");

    try {
      const startResponse = await fetch("/api/oem/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicle, damage })
      });

      const startData = await readJson<PendingResponse | CompleteResponse>(
        startResponse
      );

      if (!startResponse.ok && startResponse.status !== 202) {
        throw new Error(
          startData.error || "No se pudo iniciar la investigación OEM."
        );
      }

      if (startData.status === "complete") {
        setResult(startData.result);
        return;
      }

      const job = startData.job;
      const startedAt = Date.now();
      const maxWaitMs = 3 * 60 * 1000;

      while (Date.now() - startedAt < maxWaitMs) {
        await new Promise((resolve) => setTimeout(resolve, 2200));

        const response = await fetch("/api/oem/research/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vehicle, damage, job })
        });

        const data = await readJson<PendingResponse | CompleteResponse>(
          response
        );

        if (!response.ok && response.status !== 202) {
          throw new Error(
            data.error || "Falló la investigación del número OEM."
          );
        }

        if (data.status === "pending") {
          setStatusText(
            "Investigando catálogos OEM… " +
              (data.providerStatus ? "Estado: " + data.providerStatus : "")
          );
          continue;
        }

        setResult(data.result);
        setStatusText("");
        return;
      }

      throw new Error(
        "La investigación OEM sigue ejecutándose después de 3 minutos."
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo completar la investigación OEM."
      );
    } finally {
      setLoading(false);
      setStatusText("");
    }
  }

  return (
    <div className="oemResearch">
      <div className="oemResearchActions">
        <button
          type="button"
          className="secondary"
          disabled={loading}
          onClick={() => {
            if (result) {
              setOpen((current) => !current);
            } else {
              research();
            }
          }}
        >
          {loading
            ? "Investigando OEM…"
            : result
              ? open
                ? "Ocultar investigación OEM"
                : "Ver investigación OEM"
              : "🔎 Investigar pieza original / OEM"}
        </button>

        {damage.oemCode && (
          <span className="oemSelected">
            OEM usado en la búsqueda: <strong>{damage.oemCode}</strong>
          </span>
        )}
      </div>

      {statusText && <div className="loadingBox">{statusText}</div>}
      {error && <div className="errorBox compactBox">{error}</div>}

      {open && result && (
        <div className="oemResearchResult">
          <div className="oemResearchHeader">
            <div>
              <strong>Investigación OEM</strong>
              <p>
                {result.sourceCount} fuentes técnicas analizadas para{" "}
                {vehicle.brand} {vehicle.model} {vehicle.year} ·{" "}
                {damage.partName} {damage.position ?? ""}
              </p>
            </div>
            <span className="badge">
              {vehicle.chassisNumber
                ? "N.º de chasis incluido"
                : "Sin N.º de chasis"}
            </span>
          </div>

          {result.candidates.length === 0 ? (
            <div className="manualReviewBox">
              <strong>No encontramos un OEM con evidencia suficiente.</strong>
              <p>
                Podés completar el N.º de chasis o revisar las fuentes
                manualmente. El sistema no inventa un código cuando la evidencia
                es débil.
              </p>
            </div>
          ) : (
            <div className="oemCandidateList">
              {result.candidates.map((candidate, index) => (
                <article
                  className="oemCandidate"
                  key={candidate.normalizedCode}
                >
                  <div className="oemCandidateTop">
                    <div>
                      <span className="oemRank">Opción {index + 1}</span>
                      <h4>{candidate.code}</h4>
                      <span
                        className={
                          candidate.confidence === "high"
                            ? "badge green"
                            : candidate.confidence === "medium"
                              ? "badge amber"
                              : "badge"
                        }
                      >
                        Confianza {confidenceLabel[candidate.confidence]}
                      </span>
                    </div>
                    {candidate.confidence === "low" ? (
                      <span className="oemLowConfidence">
                        Revisar fuentes antes de usar este código
                      </span>
                    ) : (
                      <button
                        className="primary"
                        type="button"
                        onClick={() => onUseOem(candidate.code)}
                      >
                        Buscar este OEM en Mercado Libre
                      </button>
                    )}
                  </div>

                  <div className="oemEvidence">
                    {candidate.evidence.map((evidence) => (
                      <span key={evidence}>✓ {evidence}</span>
                    ))}
                  </div>

                  <div className="oemSources">
                    {candidate.sources.map((source) => (
                      <a
                        key={source.url}
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {source.domain || "Fuente"} ↗
                      </a>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}

          <div className="oemResearchFootnote">
            Los códigos se obtienen de fuentes públicas y se puntúan por
            coincidencia de vehículo, pieza, año y fuente. Antes de cotizar, el
            OEM elegido vuelve a buscarse en Mercado Libre.
          </div>
        </div>
      )}
    </div>
  );
}
