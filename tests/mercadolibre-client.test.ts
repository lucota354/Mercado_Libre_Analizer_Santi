import { afterEach, describe, expect, it, vi } from "vitest";
import { MercadoLibreClient } from "../src/lib/marketplace/mercadolibre-client";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("MercadoLibreClient auth separation", () => {
  it("does not send OAuth credentials to public marketplace search", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.has("Authorization")).toBe(false);

      return new Response(
        JSON.stringify({
          results: [
            {
              id: "MLA1",
              title: "Paragolpe Trasero Ford Focus",
              permalink: "https://example.com/MLA1",
              price: 400000,
              currency_id: "ARS"
            }
          ]
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });

    vi.stubGlobal("fetch", fetchMock);

    const client = new MercadoLibreClient("APP_USR-test-token");
    const results = await client.searchArgentina("paragolpe ford focus 2013");

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("MLA1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to public individual item detail if bulk is forbidden", async () => {
    const fetchMock = vi.fn(async (urlInput: string | URL | Request, init?: RequestInit) => {
      const url = String(urlInput);
      const headers = new Headers(init?.headers);
      expect(headers.has("Authorization")).toBe(false);

      if (url.includes("/items/bulk")) {
        return new Response(
          JSON.stringify({ message: "forbidden", error: "forbidden", status: 403 }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.endsWith("/items/MLA1")) {
        return new Response(
          JSON.stringify({
            id: "MLA1",
            title: "Paragolpe Trasero Ford Focus",
            condition: "new"
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response("not found", { status: 404 });
    });

    vi.stubGlobal("fetch", fetchMock);

    const client = new MercadoLibreClient("APP_USR-test-token");
    const items = await client.getItems(["MLA1"]);

    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("MLA1");
  });
});
