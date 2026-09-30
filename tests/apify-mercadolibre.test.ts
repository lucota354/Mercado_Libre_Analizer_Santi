import { describe, expect, it } from "vitest";
import { mapApifyRowsToMarketplaceItems } from "../src/lib/marketplace/apify-mercadolibre";

describe("Apify Mercado Libre mapping", () => {
  it("maps an Argentine search result into a marketplace candidate", () => {
    const results = mapApifyRowsToMarketplaceItems([
      {
        articuloTitulo: "Paragolpe Trasero Nissan Sentra 2020 A 2024 Original",
        nuevoPrecio: "1124906",
        Moneda: "ARS",
        zProductoLink:
          "https://www.mercadolibre.com.ar/paragolpe-trasero-nissan-sentra-2124-original/up/MLAU4135228669?wid=MLA3502971484",
        idPublicacion: "MLA3502971484",
        productoMarca: "Nissan",
        condicion: "Nuevo",
        descripcion: "Paragolpe trasero original nuevo",
        tipoRegistro: "producto",
        caracteristicas: [
          { nombre: "Código OEM", valor: "85022-6LE0H" }
        ]
      }
    ]);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: "MLA3502971484",
      title: "Paragolpe Trasero Nissan Sentra 2020 A 2024 Original",
      price: 1124906,
      currencyId: "ARS",
      condition: "new",
      brand: "Nissan",
      oemCode: "85022-6LE0H",
      source: "apify"
    });
  });

  it("merges search and enriched rows for the same publication", () => {
    const results = mapApifyRowsToMarketplaceItems([
      {
        articuloTitulo: "Paragolpe Trasero Golf GTI Original",
        nuevoPrecio: "300000",
        Moneda: "ARS",
        zProductoLink:
          "https://www.mercadolibre.com.ar/paragolpe-trasero-golf-gti/up/MLAU111?wid=MLA1234567890",
        idPublicacion: "MLA1234567890",
        tipoRegistro: "busqueda"
      },
      {
        articuloTitulo: "Paragolpe Trasero Golf GTI Original",
        nuevoPrecio: "300000",
        Moneda: "ARS",
        zProductoLink:
          "https://www.mercadolibre.com.ar/paragolpe-trasero-golf-gti/up/MLAU111?wid=MLA1234567890",
        idPublicacion: "MLA1234567890",
        productoMarca: "Volkswagen",
        condicion: "Nuevo",
        descripcion: "Original",
        tipoRegistro: "producto"
      }
    ]);

    expect(results).toHaveLength(1);
    expect(results[0].brand).toBe("Volkswagen");
    expect(results[0].condition).toBe("new");
    expect(results[0].price).toBe(300000);
  });
});
