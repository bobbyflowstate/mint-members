import { ArrivalDepartureTime } from "../applications/types";
import { isEarlyDeparture } from "./earlyDeparture";
import {
  BikeStatus,
  SleepingType,
  TravelMode,
  VehiclePassStatus,
  isVehicleTravelMode,
} from "./options";

export interface ProfileForCompleteness {
  hasTicket?: boolean;
  numBurnsAttended?: number;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  arrivalMode?: TravelMode;
  departureMode?: TravelMode;
  vehicleId?: string;
  vehiclePassStatus?: VehiclePassStatus;
  bikeStatus?: BikeStatus;
  sleepingType?: SleepingType;
  sleepingVehicleId?: string;
  sleepingGroupId?: string;
}

export interface ApplicationForCompleteness {
  departure: string;
  departureTime: ArrivalDepartureTime;
  earlyDepartureReason?: string;
  dietaryPreference: string;
  allergyFlag: boolean;
  allergyNotes?: string;
}

export type ProfileSectionKey =
  | "status"
  | "burnsEmergency"
  | "transport"
  | "sleeping"
  | "meals";

export interface SectionCompleteness {
  key: ProfileSectionKey;
  label: string;
  complete: boolean;
  missing: string[];
}

export interface ProfileCompleteness {
  sections: SectionCompleteness[];
  completeCount: number;
  totalCount: number;
}

function hasText(value: string | undefined): boolean {
  return Boolean(value && value.trim() !== "");
}

export function computeProfileCompleteness(
  profile: ProfileForCompleteness,
  application: ApplicationForCompleteness,
  departureCutoff: string
): ProfileCompleteness {
  const sections: SectionCompleteness[] = [];

  const statusMissing: string[] = [];
  if (profile.hasTicket === undefined) {
    statusMissing.push("Do you have your ticket?");
  }
  if (
    isEarlyDeparture(application.departure, application.departureTime, departureCutoff) &&
    !hasText(application.earlyDepartureReason)
  ) {
    statusMissing.push("Early departure reason");
  }
  sections.push({
    key: "status",
    label: "Status & Confirmation",
    complete: statusMissing.length === 0,
    missing: statusMissing,
  });

  const burnsMissing: string[] = [];
  if (profile.numBurnsAttended === undefined) {
    burnsMissing.push("Number of burns attended");
  }
  if (!hasText(profile.emergencyContactName)) {
    burnsMissing.push("Emergency contact name");
  }
  if (!hasText(profile.emergencyContactPhone)) {
    burnsMissing.push("Emergency contact phone");
  }
  sections.push({
    key: "burnsEmergency",
    label: "Burn Experience & Emergency Contact",
    complete: burnsMissing.length === 0,
    missing: burnsMissing,
  });

  const transportMissing: string[] = [];
  if (!profile.arrivalMode) {
    transportMissing.push("Arrival mode");
  }
  if (!profile.departureMode) {
    transportMissing.push("Departure mode");
  }
  const needsVehicle =
    isVehicleTravelMode(profile.arrivalMode) || isVehicleTravelMode(profile.departureMode);
  if (needsVehicle && !profile.vehicleId) {
    transportMissing.push("Vehicle");
  }
  if (!profile.vehiclePassStatus) {
    transportMissing.push("Vehicle pass status");
  }
  if (!profile.bikeStatus) {
    transportMissing.push("Bike");
  }
  sections.push({
    key: "transport",
    label: "Transport",
    complete: transportMissing.length === 0,
    missing: transportMissing,
  });

  const sleepingMissing: string[] = [];
  if (!profile.sleepingType) {
    sleepingMissing.push("Where are you sleeping?");
  } else if (profile.sleepingType === "rv_trailer_vehicle" && !profile.sleepingVehicleId) {
    sleepingMissing.push("Which RV/trailer/vehicle?");
  } else if (profile.sleepingType === "own_shiftpod_or_tent" && !profile.sleepingGroupId) {
    sleepingMissing.push("Shiftpod / tent name");
  }
  sections.push({
    key: "sleeping",
    label: "Sleeping Accommodations",
    complete: sleepingMissing.length === 0,
    missing: sleepingMissing,
  });

  const mealsMissing: string[] = [];
  if (!hasText(application.dietaryPreference)) {
    mealsMissing.push("Dietary preference");
  }
  if (application.allergyFlag && !hasText(application.allergyNotes)) {
    mealsMissing.push("Allergy details");
  }
  sections.push({
    key: "meals",
    label: "Meals",
    complete: mealsMissing.length === 0,
    missing: mealsMissing,
  });

  return {
    sections,
    completeCount: sections.filter((section) => section.complete).length,
    totalCount: sections.length,
  };
}
