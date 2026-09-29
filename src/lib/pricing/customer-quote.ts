export type CustomerQuotePolicy = {
  markupPercent: number;
  roundTo: number;
};

export type CustomerQuoteResult = {
  purchaseReference: number;
  markupPercent: number;
  rawQuote: number;
  quotedPrice: number;
  roundTo: number;
};

export const DEFAULT_CUSTOMER_QUOTE_POLICY: CustomerQuotePolicy = {
  markupPercent: 50,
  roundTo: 50_000
};

function roundUp(value: number, step: number) {
  if (step <= 0) return Math.round(value);
  return Math.ceil(value / step) * step;
}

/**
 * Converts a validated purchase/reference cost into the value quoted to the customer.
 *
 * Important:
 * - purchaseReference MUST already come from listings that passed compatibility,
 *   originality, condition and comparable-product checks.
 * - The 50% default is an initial calibration hypothesis from a real workshop example,
 *   not a permanent hard-coded business truth. It must remain configurable.
 */
export function calculateCustomerQuote(
  purchaseReference: number,
  policy: CustomerQuotePolicy = DEFAULT_CUSTOMER_QUOTE_POLICY
): CustomerQuoteResult {
  if (!Number.isFinite(purchaseReference) || purchaseReference <= 0) {
    throw new Error("El precio de referencia de compra debe ser mayor a cero.");
  }

  const rawQuote = purchaseReference * (1 + policy.markupPercent / 100);
  const quotedPrice = roundUp(rawQuote, policy.roundTo);

  return {
    purchaseReference,
    markupPercent: policy.markupPercent,
    rawQuote: Math.round(rawQuote),
    quotedPrice,
    roundTo: policy.roundTo
  };
}
