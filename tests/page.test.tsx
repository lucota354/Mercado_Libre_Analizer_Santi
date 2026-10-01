// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HomePage from "../src/app/page";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function connectionFetch(options?: {
  meliConnected?: boolean;
  apifyConnected?: boolean;
}) {
  const meliConnected = options?.meliConnected ?? true;
  const apifyConnected = options?.apifyConnected ?? true;

  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url.includes("/api/auth/mercadolibre/status")) {
      return {
        ok: true,
        json: async () => ({
          connected: meliConnected,
          connectionState: meliConnected ? "connected" : "no_session"
        })
      } as Response;
    }

    if (url.includes("/api/auth/apify/status")) {
      return {
        ok: true,
        json: async () => ({
          connected: apifyConnected,
          source: apifyConnected ? "browser" : "none",
          username: apifyConnected ? "santi" : null
        })
      } as Response;
    }

    return {
      ok: true,
      json: async () => ({})
    } as Response;
  });
}

describe("vehicle year field", () => {
  it("does not crash while the year is being replaced digit by digit", async () => {
    vi.stubGlobal("fetch", connectionFetch());

    const user = userEvent.setup();
    render(<HomePage />);

    const yearInput = screen.getByLabelText("Año") as HTMLInputElement;

    await user.clear(yearInput);

    expect(yearInput.value).toBe("");
    expect(
      screen.getByText("Ingresá un año de 4 dígitos entre 1900 y 2100.")
    ).toBeTruthy();
    expect(
      screen.getByText("Completá un año válido para calcular la mano de obra.")
    ).toBeTruthy();

    await user.type(yearInput, "2");
    expect(yearInput.value).toBe("2");

    await user.type(yearInput, "013");

    expect(yearInput.value).toBe("2013");
    expect(
      screen.queryByText("Ingresá un año de 4 dígitos entre 1900 y 2100.")
    ).toBeNull();
    expect(screen.getByText("Tarifa automática para 2013")).toBeTruthy();
  });
});

describe("search availability", () => {
  it("allows robust search when Apify is connected even if Mercado Libre OAuth is disconnected", async () => {
    vi.stubGlobal(
      "fetch",
      connectionFetch({ meliConnected: false, apifyConnected: true })
    );

    const user = userEvent.setup();
    render(<HomePage />);

    await user.type(screen.getByLabelText("Marca"), "Nissan");
    await user.type(screen.getByLabelText("Modelo"), "Sentra");
    await user.type(screen.getByLabelText("Repuesto"), "Paragolpe");

    const button = await screen.findByRole("button", {
      name: "Buscar, validar y cotizar"
    });

    expect((button as HTMLButtonElement).disabled).toBe(false);
    expect(await screen.findByText("APIFY CONECTADO")).toBeTruthy();
    expect(screen.getByText("Conectar Mercado Libre")).toBeTruthy();
  });

  it("shows a guided Apify onboarding when no Apify connection exists", async () => {
    vi.stubGlobal(
      "fetch",
      connectionFetch({ meliConnected: true, apifyConnected: false })
    );

    render(<HomePage />);

    expect(await screen.findByText("Configuración de Apify")).toBeTruthy();
    expect(screen.getByText("Creá una cuenta gratis en Apify")).toBeTruthy();
    expect(screen.getByText("Copiá tu API token")).toBeTruthy();
    expect(screen.getByText("Pegalo acá y verificá la conexión")).toBeTruthy();

    const button = screen.getByRole("button", {
      name: "Buscar, validar y cotizar"
    });

    expect((button as HTMLButtonElement).disabled).toBe(true);
  });
});
