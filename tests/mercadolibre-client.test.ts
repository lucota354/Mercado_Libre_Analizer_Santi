import { afterEach, describe, expect, it, vi } from "vitest";
import { MercadoLibreClient, parseMarketplaceProductHtml, parseMarketplaceSearchHtml } from "../src/lib/marketplace/mercadolibre-client";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("MercadoLibreClient current discovery flow", () => {
  it("discovers marketplace listings through catalog product search", async () => {
    const fetchMock = vi.fn(async (urlInput: string | URL | Request, init?: RequestInit) => {
      const url = String(urlInput);
      const headers = new Headers(init?.headers);

      if (url.includes("/products/search")) {
        expect(headers.get("Authorization")).toBe("Bearer APP_USR-test-token");
        return new Response(
          JSON.stringify({
            results: [
              {
                id: "MLA-PROD-1",
                name: "Paragolpe Trasero Nissan Sentra 2021"
              }
            ]
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.endsWith("/products/MLA-PROD-1")) {
        return new Response(
          JSON.stringify({
            id: "MLA-PROD-1",
            name: "Paragolpe Trasero Nissan Sentra 2021",
            children_ids: [],
            buy_box_winner: {
              item_id: "MLA100",
              price: 600000,
              currency_id: "ARS",
              condition: "new"
            }
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.includes("/products/MLA-PROD-1/items")) {
        return new Response(
          JSON.stringify({
            results: [
              {
                item_id: "MLA100",
                price: 600000,
                currency_id: "ARS",
                condition: "new"
              },
              {
                item_id: "MLA101",
                price: 640000,
                currency_id: "ARS",
                condition: "new"
              }
            ]
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response("not found", { status: 404 });
    });

    vi.stubGlobal("fetch", fetchMock);

    const client = new MercadoLibreClient("APP_USR-test-token");
    const results = await client.searchArgentina(
      "paragolpe trasero nissan sentra 2021"
    );

    expect(results).toHaveLength(2);
    expect(results.map((result) => result.id)).toEqual(["MLA100", "MLA101"]);
    expect(results[0].price).toBe(600000);
  });

  it("keeps the buy-box winner if product competitors are unavailable", async () => {
    const fetchMock = vi.fn(async (urlInput: string | URL | Request) => {
      const url = String(urlInput);

      if (url.includes("/products/search")) {
        return new Response(
          JSON.stringify({
            results: [
              {
                id: "MLA-PROD-1",
                name: "Paragolpe Trasero Nissan Sentra 2021"
              }
            ]
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.endsWith("/products/MLA-PROD-1")) {
        return new Response(
          JSON.stringify({
            id: "MLA-PROD-1",
            name: "Paragolpe Trasero Nissan Sentra 2021",
            children_ids: [],
            buy_box_winner: {
              item_id: "MLA100",
              price: 600000,
              currency_id: "ARS"
            }
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.includes("/products/MLA-PROD-1/items")) {
        return new Response(
          JSON.stringify({ message: "forbidden", status: 403 }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response("not found", { status: 404 });
    });

    vi.stubGlobal("fetch", fetchMock);

    const client = new MercadoLibreClient("APP_USR-test-token");
    const results = await client.searchArgentina(
      "paragolpe trasero nissan sentra 2021"
    );

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("MLA100");
    expect(results[0].price).toBe(600000);
  });

  it("retrieves item details using authenticated bulk before fallbacks", async () => {
    const fetchMock = vi.fn(async (urlInput: string | URL | Request, init?: RequestInit) => {
      const url = String(urlInput);
      const headers = new Headers(init?.headers);

      if (url.includes("/items/bulk")) {
        expect(headers.get("Authorization")).toBe("Bearer APP_USR-test-token");
        return new Response(
          JSON.stringify([
            {
              id: "MLA100",
              status_code: 200,
              body: {
                id: "MLA100",
                title: "Paragolpe Trasero Nissan Sentra Original",
                condition: "new"
              }
            }
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response("not found", { status: 404 });
    });

    vi.stubGlobal("fetch", fetchMock);

    const client = new MercadoLibreClient("APP_USR-test-token");
    const items = await client.getItems(["MLA100"]);

    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("MLA100");
  });
});


describe("Mercado Libre web-search parsing", () => {
  it("extracts listing id, title, price and link from a search card", () => {
    const html = `
      <ol>
        <li class="ui-search-layout__item">
          <div class="poly-card">
            <a
              class="poly-component__title"
              href="https://www.mercadolibre.com.ar/paragolpe-trasero-nissan-sentra/up/MLAU123?wid=MLA1809163900"
            >
              Paragolpe Trasero Nissan Sentra 2020 2021 2022 2023 2024
            </a>
            <span class="andes-money-amount__fraction">266.220</span>
          </div>
        </li>
      </ol>
    `;

    const results = parseMarketplaceSearchHtml(html);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: "MLA1809163900",
      title: "Paragolpe Trasero Nissan Sentra 2020 2021 2022 2023 2024",
      price: 266220,
      currencyId: "ARS"
    });
  });
});


describe("Mercado Libre product-page parsing", () => {
  it("recovers the concrete MLA item id and price from an MLAU product page", () => {
    const html = `
      <html>
        <head>
          <meta property="og:title" content="Paragolpe Trasero Nissan Sentra 21/24 Original" />
        </head>
        <body>
          <span>Nuevo</span>
          <h1 class="ui-pdp-title">Paragolpe Trasero Nissan Sentra 21/24 Original</h1>
          <span class="andes-money-amount__fraction">280.000</span>
          <div>Marca Nissan</div>
          <div>Número de pieza 850225EE0H1H</div>
          <div>Publicación #1809163900</div>
        </body>
      </html>
    `;

    const result = parseMarketplaceProductHtml(
      html,
      "https://www.mercadolibre.com.ar/paragolpe-trasero-nissan-sentra-2124-original/up/MLAU4135228669"
    );

    expect(result).toMatchObject({
      id: "MLA1809163900",
      title: "Paragolpe Trasero Nissan Sentra 21/24 Original",
      price: 280000,
      currencyId: "ARS"
    });
  });
});
