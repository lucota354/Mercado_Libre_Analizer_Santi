import type { QuoteDraft, QuoteItem, VehicleInput } from "@/lib/domain/types";

export function buildQuoteDraft(
  vehicle: VehicleInput,
  items: QuoteItem[],
  extras?: { labor?: number; paint?: number; other?: number }
): QuoteDraft {
  const partsSubtotal = items.reduce(
    (sum, item) => sum + (item.priceSummary?.referencePrice ?? 0),
    0
  );

  const labor = extras?.labor ?? 0;
  const paint = extras?.paint ?? 0;
  const other = extras?.other ?? 0;

  return {
    vehicle,
    items,
    partsSubtotal,
    labor,
    paint,
    other,
    total: partsSubtotal + labor + paint + other
  };
}
