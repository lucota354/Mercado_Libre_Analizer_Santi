export type VehicleInput = {
  brand: string;
  model: string;
  year: number;
  version?: string;
  engine?: string;
  bodyType?: string;
  transmission?: string;
  vin?: string;
  plate?: string;
  catalogProductId?: string;
};

export type DamageInput = {
  id: string;
  partName: string;
  position?: string;
  notes?: string;
  requestedBrand?: string;
  requestedCondition?: "new";
  packageType?: "single" | "pair" | "kit";
};

export type SearchPlan = {
  damageId: string;
  displayName: string;
  queries: string[];
  siteId: "MLA";
};

export type VisualCondition =
  | "new"
  | "probably_new"
  | "uncertain"
  | "probably_used"
  | "used";

export type CompatibilityStatus = "compatible" | "incompatible" | "unknown";

export type CompatibilitySource =
  | "meli_seller"
  | "meli_catalog"
  | "meli_page_selector"
  | "manual";

export type CompatibilityEvidence = {
  status: CompatibilityStatus;
  source: CompatibilitySource;
  matchedVehicleName?: string;
  compatibleVehicleNames?: string[];
  note?: string;
  positionCompatible?: boolean;
  reputationLevel?: "GREEN" | "YELLOW" | "RED" | string;
  catalogCompatibilityCount?: number;
  checkedAt?: string;
};

export type CandidateListing = {
  itemId: string;
  title: string;
  url: string;
  price: number;
  currency: "ARS" | string;
  condition?: string;
  brand?: string;
  oemCode?: string;
  description?: string;
  packageType?: "single" | "pair" | "kit";
  visualCondition?: VisualCondition;
  compatibility?: CompatibilityEvidence;
};

export type EvaluationResult = {
  valid: boolean;
  score: number;
  reasons: string[];
  rejectionReasons: string[];
};

export type PriceConfidence = "high" | "medium" | "low";

export type PriceSummary = {
  referencePrice: number;
  median: number;
  mean: number;
  min: number;
  max: number;
  originalCount: number;
  acceptedCount: number;
  removedOutliers: number[];
  confidence: PriceConfidence;
};

export type QuoteItem = {
  damageId: string;
  partName: string;
  priceSummary?: PriceSummary;
  sourceItemIds: string[];
  manualReview: boolean;
};

export type QuoteDraft = {
  vehicle: VehicleInput;
  items: QuoteItem[];
  partsSubtotal: number;
  labor: number;
  paint: number;
  bodyworkAndPaintSubtotal: number;
  other: number;
  total: number;
};
