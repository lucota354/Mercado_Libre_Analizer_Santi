export type LaborRateBand = {
  id: string;
  minYear?: number;
  maxYear?: number;
  bodyworkPerDay: number;
  paintPerPanel: number;
  mechanicPerHour: number;
  note: string;
};

export type LaborRates = {
  bodyworkPerDay: number;
  paintPerPanel: number;
  mechanicPerHour: number;
  bandId: string;
  note: string;
};

/**
 * Initial workshop calibration from the 2026-09-29 examples.
 *
 * Boundary decision:
 * - The verbal rules overlap on year 2010 ("2010-2014" and "2002-2010").
 * - We assign 2010 to the newer 2010-2014 bracket because that range was
 *   explicitly stated first.
 * - Keep these bands configurable; more real estimates can refine them.
 */
export const DEFAULT_LABOR_RATE_BANDS: LaborRateBand[] = [
  {
    id: "2015_plus",
    minYear: 2015,
    bodyworkPerDay: 200_000,
    paintPerPanel: 200_000,
    mechanicPerHour: 100_000,
    note: "Vehículos 2015 o posteriores."
  },
  {
    id: "2010_2014",
    minYear: 2010,
    maxYear: 2014,
    bodyworkPerDay: 190_000,
    paintPerPanel: 190_000,
    mechanicPerHour: 90_000,
    note: "Vehículos entre 2010 y 2014."
  },
  {
    id: "2002_2009",
    minYear: 2002,
    maxYear: 2009,
    bodyworkPerDay: 180_000,
    paintPerPanel: 180_000,
    mechanicPerHour: 80_000,
    note: "Vehículos entre 2002 y 2009."
  },
  {
    id: "pre_2002",
    maxYear: 2001,
    bodyworkPerDay: 170_000,
    paintPerPanel: 170_000,
    mechanicPerHour: 70_000,
    note: "Vehículos anteriores a 2002; puede requerir ajuste manual por estado."
  }
];

export function getLaborRatesForVehicleYear(
  vehicleYear: number,
  bands: LaborRateBand[] = DEFAULT_LABOR_RATE_BANDS
): LaborRates {
  if (!Number.isInteger(vehicleYear) || vehicleYear < 1900 || vehicleYear > 2100) {
    throw new Error("Año de vehículo inválido.");
  }

  const band = bands.find((candidate) => {
    const afterMin = candidate.minYear === undefined || vehicleYear >= candidate.minYear;
    const beforeMax = candidate.maxYear === undefined || vehicleYear <= candidate.maxYear;
    return afterMin && beforeMax;
  });

  if (!band) {
    throw new Error(`No hay tarifa de mano de obra configurada para el año ${vehicleYear}.`);
  }

  return {
    bodyworkPerDay: band.bodyworkPerDay,
    paintPerPanel: band.paintPerPanel,
    mechanicPerHour: band.mechanicPerHour,
    bandId: band.id,
    note: band.note
  };
}
