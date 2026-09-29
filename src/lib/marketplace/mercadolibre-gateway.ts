export type MarketplaceSearchItem = {
  id: string;
  title: string;
  permalink: string;
  price?: number;
  currencyId?: string;
};

export interface MercadoLibreGateway {
  searchArgentina(query: string): Promise<MarketplaceSearchItem[]>;
  getItems(ids: string[]): Promise<unknown[]>;
  getSalePrice(itemId: string): Promise<{ amount: number; currencyId: string }>;
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
}
