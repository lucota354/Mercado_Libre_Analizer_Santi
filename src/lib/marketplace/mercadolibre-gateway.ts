import type { CompatibilityEvidence, VehicleInput } from "@/lib/domain/types";

export type MarketplaceSearchItem = {
  id: string;
  title: string;
  permalink: string;
  price?: number;
  currencyId?: string;
  condition?: string;
  brand?: string;
  description?: string;
  oemCode?: string;
  source?: "apify" | "meli_catalog" | "meli_web" | "web_index";
};

export type VehicleCatalogValue = {
  id: string;
  name: string;
  metric?: number;
};

export type VehicleKnownAttribute = {
  id: "BRAND" | "MODEL" | "VEHICLE_YEAR" | "SHORT_VERSION" | "ENGINE";
  valueId?: string;
  valueName?: string;
};

export interface MercadoLibreGateway {
  searchArgentina(query: string): Promise<MarketplaceSearchItem[]>;
  getItems(ids: string[]): Promise<unknown[]>;
  getSalePrice(itemId: string): Promise<{ amount: number; currencyId: string }>;

  /**
   * Construye los selectores Marca -> Modelo -> Año -> Versión -> Motor usando
   * MLA-CARS_AND_VANS y top_values.
   */
  getVehicleValues(
    attributeId: VehicleKnownAttribute["id"],
    knownAttributes: VehicleKnownAttribute[]
  ): Promise<VehicleCatalogValue[]>;

  /**
   * Lee compatibilidades expuestas por la API del ítem.
   * Para source=SELLER puede existir detalle de vehículo, notas y restricciones.
   * Para compatibilidades de catálogo Mercado Libre puede devolver sólo resumen.
   */
  getItemCompatibilityEvidence(
    itemId: string,
    vehicle: VehicleInput
  ): Promise<CompatibilityEvidence>;

  /**
   * Fallback estricto para cuando la API no expone suficiente detalle:
   * comprobar el mismo vehículo en el selector de compatibilidad de la publicación.
   */
  verifyCompatibilityInListingPage(
    itemUrl: string,
    vehicle: VehicleInput
  ): Promise<CompatibilityEvidence>;
}

/**
 * Implementación real pendiente.
 *
 * Objetivo:
 * - site MLA exclusivamente.
 * - OAuth server-side.
 * - búsqueda por cada variante generada.
 * - detalle múltiple con /items/bulk.
 * - precio vigente desde los recursos actuales de precios.
 * - catálogo de vehículos MLA-CARS_AND_VANS.
 * - compatibilidad obligatoria antes de usar un precio.
 *
 * Nunca exponer client secret/access token al navegador.
 */
export class NotConnectedMercadoLibreGateway implements MercadoLibreGateway {
  private fail(): never {
    throw new Error("Mercado Libre todavía no está conectado. Configurar OAuth y credenciales.");
  }

  async searchArgentina(): Promise<MarketplaceSearchItem[]> {
    return this.fail();
  }

  async getItems(): Promise<unknown[]> {
    return this.fail();
  }

  async getSalePrice(): Promise<{ amount: number; currencyId: string }> {
    return this.fail();
  }

  async getVehicleValues(): Promise<VehicleCatalogValue[]> {
    return this.fail();
  }

  async getItemCompatibilityEvidence(): Promise<CompatibilityEvidence> {
    return this.fail();
  }

  async verifyCompatibilityInListingPage(): Promise<CompatibilityEvidence> {
    return this.fail();
  }
}
