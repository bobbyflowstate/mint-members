/**
 * Attendee profile enums and display labels.
 *
 * Values mirror the unions in convex/schema.ts; labels match the legacy
 * spreadsheet vocabulary from the implementation spec. Shared between the
 * client forms and convex validation.
 */

export type TravelMode =
  | "driving_own_vehicle"
  | "riding_with_attendee"
  | "burner_express"
  | "flying"
  | "not_sure";

export type VehicleType = "rv" | "vehicle_with_trailer" | "vehicle_no_trailer";

export type VehiclePassStatus = "have" | "need" | "have_extra";

export type BikeStatus = "bringing_own" | "renting_third_party" | "borrow_from_camp";

export type SleepingType = "rv_trailer_vehicle" | "own_shiftpod_or_tent" | "need_camp_shiftpod";

export const TRAVEL_MODE_LABELS: Record<TravelMode, string> = {
  driving_own_vehicle: "Driving My Own Vehicle",
  riding_with_attendee: "Riding With Another Attendee's Vehicle",
  burner_express: "Burner Express",
  flying: "Flying",
  not_sure: "Not Sure",
};

export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  rv: "RV",
  vehicle_with_trailer: "Vehicle + Towable Trailer",
  vehicle_no_trailer: "Vehicle (no trailer)",
};

export const VEHICLE_PASS_STATUS_LABELS: Record<VehiclePassStatus, string> = {
  have: "Have",
  need: "Need",
  have_extra: "Have Extra",
};

export const BIKE_STATUS_LABELS: Record<BikeStatus, string> = {
  bringing_own: "Bringing My Own",
  renting_third_party: "Renting from Third Party",
  borrow_from_camp: "Need to Borrow from DeMentha",
};

export const SLEEPING_TYPE_LABELS: Record<SleepingType, string> = {
  rv_trailer_vehicle: "RV / Trailer / Vehicle",
  own_shiftpod_or_tent: "My Own Shiftpod or Tent",
  need_camp_shiftpod: "Need a DeMentha Shiftpod ($150/person)",
};

export const DIETARY_PREFERENCE_LABELS: Record<string, string> = {
  omnivore: "No Preference / Omnivore",
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  pescatarian: "Pescatarian",
  flexitarian: "Flexitarian",
};

/** Modes that put the attendee in a vehicle and require a vehicle reference. */
export const VEHICLE_TRAVEL_MODES: TravelMode[] = [
  "driving_own_vehicle",
  "riding_with_attendee",
];

export function isVehicleTravelMode(mode: string | undefined | null): boolean {
  return VEHICLE_TRAVEL_MODES.includes(mode as TravelMode);
}

export function toOptions<T extends string>(labels: Record<T, string>) {
  return (Object.entries(labels) as [T, string][]).map(([value, label]) => ({
    value,
    label,
  }));
}

/**
 * Display name for a vehicle in Sleeping Accommodations contexts: the
 * trailer name when set (truck+trailer case), otherwise the vehicle name.
 * Never both together.
 */
export function sleepingDisplayName(vehicle: {
  name: string;
  trailerName?: string | null;
}): string {
  const trailerName = vehicle.trailerName?.trim();
  return trailerName ? trailerName : vehicle.name;
}
