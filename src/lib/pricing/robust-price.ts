import type { PriceConfidence, PriceSummary } from "@/lib/domain/types";

function median(sorted: number[]) {
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function percentile(sorted: number[], percentileValue: number) {
  const index = (sorted.length - 1) * percentileValue;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function confidence(values: number[]): PriceConfidence {
  if (values.length < 2) return "low";
  const min = values[0];
  const max = values[values.length - 1];
  const spread = min > 0 ? (max - min) / min : 1;

  if (values.length >= 4 && spread <= 0.35) return "high";
  if (values.length >= 2 && spread <= 0.65) return "medium";
  return "low";
}

export function calculateRobustPrice(rawPrices: number[]): PriceSummary {
  const prices = rawPrices
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);

  if (prices.length === 0) {
    throw new Error("No hay precios válidos para calcular una referencia.");
  }

  let accepted = [...prices];
  let removedOutliers: number[] = [];

  if (prices.length >= 4) {
    const q1 = percentile(prices, 0.25);
    const q3 = percentile(prices, 0.75);
    const iqr = q3 - q1;
    const lower = q1 - 1.5 * iqr;
    const upper = q3 + 1.5 * iqr;

    accepted = prices.filter((value) => value >= lower && value <= upper);
    removedOutliers = prices.filter((value) => value < lower || value > upper);
  }

  const mean = accepted.reduce((sum, value) => sum + value, 0) / accepted.length;
  const medianValue = median(accepted);

  return {
    referencePrice: Math.round(medianValue),
    median: Math.round(medianValue),
    mean: Math.round(mean),
    min: Math.round(accepted[0]),
    max: Math.round(accepted[accepted.length - 1]),
    originalCount: prices.length,
    acceptedCount: accepted.length,
    removedOutliers,
    confidence: confidence(accepted)
  };
}
