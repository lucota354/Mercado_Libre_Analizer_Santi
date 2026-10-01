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
            <button
              className="linkButton neutralLink"
              type="button"
              onClick={onClose}
            >
              Cerrar
            </button>
          )}
        </div>
      </div>

      <p className="onboardingIntro">
        Apify es el servicio que busca las publicaciones reales de Mercado Libre.
        Seguí estas imágenes paso a paso. Esta configuración se hace una sola vez
        en esta computadora.
      </p>

      <div className="onboardingSteps">
        <article className="onboardingStep">
          <span className="onboardingNumber">1</span>
          <div>
            <strong>Creá una cuenta gratis en Apify</strong>
            <p>
              Entrá a Apify. Si todavía no tenés cuenta, tocá <b>Sign up</b>.
              Podés registrarte con Google, GitHub o email.
            </p>
            <img
              className="onboardingScreenshot"
              src="/onboarding/apify-step-1-sign-up.webp"
              alt="Pantalla de inicio de sesión de Apify con la opción Sign up marcada"
              loading="lazy"
            />
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
            <strong>Entrá a Settings</strong>
            <p>
              Una vez dentro de Apify, buscá <b>Settings</b> en el menú de la
              izquierda y hacé clic ahí.
            </p>
            <img
              className="onboardingScreenshot onboardingScreenshotCompact"
              src="/onboarding/apify-step-2-settings.webp"
              alt="Menú lateral de Apify con Settings marcado"
              loading="lazy"
            />
          </div>
        </article>

        <article className="onboardingStep">
          <span className="onboardingNumber">3</span>
          <div>
            <strong>Abrí API &amp; Integrations</strong>
            <p>
              Dentro de Settings, tocá la pestaña <b>API &amp; Integrations</b>.
            </p>
            <img
              className="onboardingScreenshot"
              src="/onboarding/apify-step-3-api-integrations.webp"
              alt="Settings de Apify con la pestaña API & Integrations marcada"
              loading="lazy"
            />
            <a
              className="secondary setupLink"
              href="https://console.apify.com/account#/integrations"
              target="_blank"
              rel="noreferrer"
            >
              Abrir API &amp; Integrations ↗
            </a>
          </div>
        </article>

        <article className="onboardingStep">
          <span className="onboardingNumber">4</span>
          <div>
            <strong>Copiá tu Personal API token</strong>
            <p>
              En <b>Personal API tokens</b> podés usar el token predeterminado o
              crear uno nuevo con <b>Create a new token</b>. Para copiarlo, usá
              el ícono de copiar que aparece a la derecha. No hace falta mostrar
              el token en pantalla.
            </p>
            <img
              className="onboardingScreenshot"
              src="/onboarding/apify-step-4-copy-token.webp"
              alt="Sección Personal API tokens de Apify con los controles para ver y copiar el token marcados"
              loading="lazy"
            />
          </div>
        </article>

        <article className="onboardingStep">
          <span className="onboardingNumber">5</span>
          <div className="tokenSetup">
            <strong>Pegalo acá y verificá la conexión</strong>
            <p>
              Volvé a esta página, pegá el token en el campo de abajo y tocá
              <b> Verificar y conectar</b>. El sistema comprueba el token
              directamente con Apify y lo guarda cifrado en una cookie HttpOnly.
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
        <strong>Importante:</strong> no mandes el token por WhatsApp, email ni
        lo pegues en GitHub. Si cambiás de navegador, borrás las cookies o usás
        otra computadora, vas a tener que conectarlo nuevamente.
      </div>
    </section>
  );
}
