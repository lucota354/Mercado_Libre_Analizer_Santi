import type { DamageInput, VehicleInput } from "@/lib/domain/types";

export type OemSource = {
  title: string;
  url: string;
  domain: string;
  snippet: string;
  query: string;
};

export type OemCandidate = {
  code: string;
  normalizedCode: string;
  confidence: "high" | "medium" | "low";
  score: number;
  evidence: string[];
  sources: OemSource[];
};

export type OemResearchResult = {
  vehicle: VehicleInput;
  damage: DamageInput;
  queries: string[];
  candidates: OemCandidate[];
  sourceCount: number;
  generatedAt: string;
};

export type OemResearchJob = {
  runId: string;
  damageId: string;
  queries: string[];
};
