import { getLaborRatesForVehicleYear } from "./labor-rates";

export type WorkshopWorkInput = {
  vehicleYear: number;
  partsBodywork?: number;
  partsMechanicalAndOther?: number;
  bodyworkDays?: number;
  paintPanels?: number;
  mechanicHours?: number;
  other?: number;
};

export type WorkshopWorkEstimate = {
  rates: {
    bodyworkPerDay: number;
    paintPerPanel: number;
    mechanicPerHour: number;
    bandId: string;
  };
  partsBodywork: number;
  partsMechanicalAndOther: number;
  bodyworkDays: number;
  bodyworkSubtotal: number;
  paintPanels: number;
  paintSubtotal: number;
  mechanicHours: number;
  mechanicSubtotal: number;
  other: number;
  partsSubtotal: number;
  laborSubtotal: number;
  total: number;
};

function nonNegative(value = 0) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Los importes y cantidades no pueden ser negativos.");
  }
  return value;
}

export function calculateWorkshopEstimate(
  input: WorkshopWorkInput
): WorkshopWorkEstimate {
  const rates = getLaborRatesForVehicleYear(input.vehicleYear);

  const partsBodywork = nonNegative(input.partsBodywork);
  const partsMechanicalAndOther = nonNegative(input.partsMechanicalAndOther);
  const bodyworkDays = nonNegative(input.bodyworkDays);
  const paintPanels = nonNegative(input.paintPanels);
  const mechanicHours = nonNegative(input.mechanicHours);
  const other = nonNegative(input.other);

  const bodyworkSubtotal = bodyworkDays * rates.bodyworkPerDay;
  const paintSubtotal = paintPanels * rates.paintPerPanel;
  const mechanicSubtotal = mechanicHours * rates.mechanicPerHour;
  const partsSubtotal = partsBodywork + partsMechanicalAndOther;
  const laborSubtotal = bodyworkSubtotal + paintSubtotal + mechanicSubtotal;

  return {
    rates: {
      bodyworkPerDay: rates.bodyworkPerDay,
      paintPerPanel: rates.paintPerPanel,
      mechanicPerHour: rates.mechanicPerHour,
      bandId: rates.bandId
    },
    partsBodywork,
    partsMechanicalAndOther,
    bodyworkDays,
    bodyworkSubtotal,
    paintPanels,
    paintSubtotal,
    mechanicHours,
    mechanicSubtotal,
    other,
    partsSubtotal,
    laborSubtotal,
    total: partsSubtotal + laborSubtotal + other
  };
}
