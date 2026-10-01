"use client";

import { useState } from "react";

type Props = {
  connected: boolean;
  username?: string | null;
  source?: "browser" | "environment" | "none";
  open: boolean;
  onClose: () => void;
  onConnected: () => Promise<void> | void;
};

export default function ApifyOnboarding({
  connected,
  username,
  source,
  open,
  onClose,
  onConnected
}: Props) {
  const [credential, setCredential] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function connect() {
    const value = credential.trim();
    if (!value) {
      setError("Pegá tu API token de Apify antes de continuar.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/auth/apify/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: value })
      });

      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        username?: string | null;
      };

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "No se pudo conectar Apify.");
      }

      setCredential("");
      setSuccess(
        data.username
          ? `Apify conectado correctamente como ${data.username}.`
          : "Apify conectado correctamente."
      );
      await onConnected();
      onClose();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "No se pudo conectar Apify."
      );
    } finally {
      setLoading(false);
    }
  }

  async function disconnect() {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await fetch("/api/auth/apify/disconnect", { method: "POST" });
      await onConnected();
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <section className="card onboardingCard">
      <div className="sectionTitle">
        <div>
          <span className="step">✓</span>
          <h2>Configuración de Apify</h2>
        </div>
        <div className="onboardingHeaderActions">
          {connected && <span className="badge green">Conectado</span>}
          {connected && (
            <button className="linkButton neutralLink" type="button" onClick={onClose}>
              Cerrar
            </button>
          )}
        </div>
      </div>

      <p className="onboardingIntro">
        Apify es el servicio que busca las publicaciones reales de Mercado Libre.
        Esta configuración se hace una sola vez en esta computadora.
      </p>

      <div className="onboardingSteps">
        <article className="onboardingStep">
          <span className="onboardingNumber">1</span>
          <div>
            <strong>Creá una cuenta gratis en Apify</strong>
            <p>
              Podés registrarte con Google, GitHub o email. Si usás email,
              confirmá el correo que te envía Apify.
            </p>
            <a
              className="secondary setupLink"
              href="https://console.apify.com/sign-up"
              target="_blank"
              rel="noreferrer"
            >
              Crear cuenta en Apify ↗
            </a>
          </div>
        </article>

        <article className="onboardingStep">
          <span className="onboardingNumber">2</span>
          <div>
            <strong>Copiá tu API token</strong>
            <p>
              Dentro de Apify abrí <b>Settings → API & Integrations</b>.
              En <b>Personal API tokens</b>, copiá tu token o creá uno nuevo
              con el nombre “Mercado Libre Analyzer Santi”.
            </p>
            <a
              className="secondary setupLink"
              href="https://console.apify.com/account#/integrations"
              target="_blank"
              rel="noreferrer"
            >
              Abrir API & Integrations ↗
            </a>
          </div>
        </article>

        <article className="onboardingStep">
          <span className="onboardingNumber">3</span>
          <div className="tokenSetup">
            <strong>Pegalo acá y verificá la conexión</strong>
            <p>
              El token se verifica directamente con Apify y se guarda cifrado
              en una cookie HttpOnly. No se guarda en GitHub ni en una base de datos.
            </p>

            <div className="tokenRow">
              <input
                type="password"
                autoComplete="off"
                placeholder="Pegá acá tu API token de Apify"
                value={credential}
                onChange={(event) => {
                  setCredential(event.target.value);
                  setError("");
                  setSuccess("");
                }}
              />
              <button
                className="primary"
                type="button"
                disabled={loading || !credential.trim()}
                onClick={connect}
              >
                {loading ? "Verificando…" : "Verificar y conectar"}
              </button>
            </div>

            {error && <div className="errorBox compactBox">{error}</div>}
            {success && <div className="successBox">{success}</div>}

            {connected && (
              <div className="connectedAccount">
                <span>
                  ✓ Apify conectado
                  {username ? ` como ${username}` : ""}
                  {source === "environment"
                    ? " · configuración actual del servidor"
                    : ""}
                </span>
                <button
                  className="linkButton"
                  type="button"
                  disabled={loading}
                  onClick={disconnect}
                >
                  Cambiar cuenta/token
                </button>
              </div>
            )}
          </div>
        </article>
      </div>

      <div className="securityNote">
        <strong>Importante:</strong> no mandes el token por WhatsApp ni lo
        pegues en GitHub. Si cambiás de navegador, borrás las cookies o usás
        otra computadora, vas a tener que conectarlo nuevamente.
      </div>
    </section>
  );
}
