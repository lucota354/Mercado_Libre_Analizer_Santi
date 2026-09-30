export const MIN_VEHICLE_YEAR = 1900;
export const MAX_VEHICLE_YEAR = 2100;

export function parseVehicleYear(value: string | number): number | null {
  const raw = String(value).trim();

  if (!/^\d{4}$/.test(raw)) {
    return null;
  }

  const year = Number(raw);

  if (
    !Number.isInteger(year) ||
    year < MIN_VEHICLE_YEAR ||
    year > MAX_VEHICLE_YEAR
  ) {
    return null;
  }

  return year;
}
