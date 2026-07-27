"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Field } from "../forms/Field";
import { canonicalizePhoneInput, formatPhoneDisplay } from "@/lib/phone/format";
import {
  ARRIVAL_DEPARTURE_TIMES,
  ArrivalDepartureTime,
  DIETARY_PREFERENCES,
} from "@/lib/applications/types";
import { isEarlyDeparture } from "@/lib/attendeeProfile/earlyDeparture";
import {
  BIKE_STATUS_LABELS,
  BikeStatus,
  DIETARY_PREFERENCE_LABELS,
  SLEEPING_TYPE_LABELS,
  SleepingType,
  TRAVEL_MODE_LABELS,
  TravelMode,
  VEHICLE_PASS_STATUS_LABELS,
  VehiclePassStatus,
  isVehicleTravelMode,
  sleepingDisplayName,
  toOptions,
} from "@/lib/attendeeProfile/options";
import { AppConfig, getLandingContent } from "@/config/content";

export type ProfileRow = FunctionReturnType<typeof api.attendeeProfiles.listForOps>[number];

type SaveState = "idle" | "saving" | "saved" | "error";

type SectionState = {
  state: SaveState;
  error: string | null;
};

type SectionKey =
  | "status"
  | "burns"
  | "transport"
  | "sleeping"
  | "meals"
  | "camp";

const TIME_OPTIONS = ARRIVAL_DEPARTURE_TIMES.map((time) => ({
  value: time,
  label: time,
}));

const DIETARY_OPTIONS = DIETARY_PREFERENCES.map((preference) => ({
  value: preference,
  label: DIETARY_PREFERENCE_LABELS[preference] ?? preference,
}));

function friendlyErrorMessage(error: unknown): string {
  if (!(error instanceof Error) || !error.message) {
    return "Failed to save";
  }

  let message = error.message.trim();
  const uncaughtPrefix = "Uncaught Error:";
  const uncaughtIndex = message.indexOf(uncaughtPrefix);
  if (uncaughtIndex >= 0) {
    message = message.slice(uncaughtIndex + uncaughtPrefix.length).trim();
  }
  const handlerIndex = message.indexOf(" at handler");
  if (handlerIndex >= 0) {
    message = message.slice(0, handlerIndex).trim();
  }
  return message || "Failed to save";
}

function Section({
  title,
  state,
  error,
  onSave,
  saveLabel,
  children,
}: {
  title: string;
  state: SaveState;
  error: string | null;
  onSave: () => void;
  saveLabel: string;
  children: React.ReactNode;
}) {
  return (
    <form
      className="rounded-lg bg-white/5 p-4 ring-1 ring-white/10"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {state === "saved" && <span className="text-xs text-emerald-300">Saved</span>}
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={state === "saving"}
        className="mt-4 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-700"
      >
        {state === "saving" ? "Saving..." : saveLabel}
      </button>
    </form>
  );
}

export function ProfileEditDialog({
  row,
  opsPassword,
  onClose,
}: {
  row: ProfileRow | null;
  opsPassword: string;
  onClose: () => void;
}) {
  const config = useQuery(api.config.getConfig);
  const editOptions = useQuery(api.attendeeProfiles.listEditOptionsForOps, {
    opsPassword,
  });
  const vehicles = editOptions?.vehicles ?? [];
  const sleepingGroups = editOptions?.sleepingGroups ?? [];
  const opsSaveStatus = useMutation(api.attendeeProfiles.opsSaveStatus);
  const opsSaveBurnsEmergency = useMutation(api.attendeeProfiles.opsSaveBurnsEmergency);
  const opsSaveTransport = useMutation(api.attendeeProfiles.opsSaveTransport);
  const opsSaveSleeping = useMutation(api.attendeeProfiles.opsSaveSleeping);
  const opsSaveMeals = useMutation(api.attendeeProfiles.opsSaveMeals);
  const opsSaveCamp = useMutation(api.attendeeProfiles.opsSaveCamp);

  const [sectionStates, setSectionStates] = useState<Record<SectionKey, SectionState>>({
    status: { state: "idle", error: null },
    burns: { state: "idle", error: null },
    transport: { state: "idle", error: null },
    sleeping: { state: "idle", error: null },
    meals: { state: "idle", error: null },
    camp: { state: "idle", error: null },
  });

  const content = useMemo(() => {
    if (!config) return null;
    return getLandingContent(config as AppConfig);
  }, [config]);

  const [hasTicket, setHasTicket] = useState<"" | "yes" | "no">(
    row?.hasTicket === undefined ? "" : row.hasTicket ? "yes" : "no"
  );
  const [arrival, setArrival] = useState(row?.arrival ?? "");
  const [arrivalTime, setArrivalTime] = useState<ArrivalDepartureTime>(
    row?.arrivalTime ?? "11.01 am to 6.00 pm"
  );
  const [departure, setDeparture] = useState(row?.departure ?? "");
  const [departureTime, setDepartureTime] = useState<ArrivalDepartureTime>(
    row?.departureTime ?? "11.01 am to 6.00 pm"
  );
  const [earlyReason, setEarlyReason] = useState(row?.earlyDepartureReason ?? "");
  const [statusNotice, setStatusNotice] = useState<"opsReview" | "paymentRestored" | null>(null);

  const [numBurns, setNumBurns] = useState(
    row?.numBurnsAttended === undefined ? "" : String(row.numBurnsAttended)
  );
  const [emergencyName, setEmergencyName] = useState(row?.emergencyContactName ?? "");
  const [emergencyPhone, setEmergencyPhone] = useState(row?.emergencyContactPhone ?? "");
  const [emergencyEmail, setEmergencyEmail] = useState(row?.emergencyContactEmail ?? "");

  const [arrivalMode, setArrivalMode] = useState<"" | TravelMode>(
    row?.arrivalMode ?? ""
  );
  const [departureMode, setDepartureMode] = useState<"" | TravelMode>(
    row?.departureMode ?? ""
  );
  const [vehicleId, setVehicleId] = useState(row?.vehicleId ?? "");
  const [vehiclePassStatus, setVehiclePassStatus] = useState<"" | VehiclePassStatus>(
    row?.vehiclePassStatus ?? ""
  );
  const [bikeStatus, setBikeStatus] = useState<"" | BikeStatus>(row?.bikeStatus ?? "");

  const [sleepingType, setSleepingType] = useState<"" | SleepingType>(
    row?.sleepingType ?? ""
  );
  const [sleepingVehicleId, setSleepingVehicleId] = useState(row?.sleepingVehicleId ?? "");
  const [sleepingGroupId, setSleepingGroupId] = useState(row?.sleepingGroupId ?? "");

  const [dietaryPreference, setDietaryPreference] = useState(row?.dietaryPreference ?? "");
  const [hasAllergies, setHasAllergies] = useState<"" | "yes" | "no">(
    row?.allergyFlag ? "yes" : "no"
  );
  const [allergyNotes, setAllergyNotes] = useState(row?.allergyNotes ?? "");
  const [playaName, setPlayaName] = useState(row?.playaName ?? "");
  const [requests, setRequests] = useState(row?.requests ?? "");

  if (!row) return null;

  const runSave = async (key: SectionKey, save: () => Promise<void>) => {
    setSectionStates((current) => ({
      ...current,
      [key]: { state: "saving", error: null },
    }));
    try {
      await save();
      setSectionStates((current) => ({
        ...current,
        [key]: { state: "saved", error: null },
      }));
    } catch (error) {
      setSectionStates((current) => ({
        ...current,
        [key]: { state: "error", error: friendlyErrorMessage(error) },
      }));
    }
  };

  const early =
    content !== null && isEarlyDeparture(departure, departureTime, content.departureCutoff);
  const needsVehicle = isVehicleTravelMode(arrivalMode) || isVehicleTravelMode(departureMode);

  const vehicleOptions = vehicles.map((vehicle) => ({
    value: vehicle._id,
    label: vehicle.name,
  }));
  const sleepingVehicleOptions = vehicles.map((vehicle) => ({
    value: vehicle._id,
    label: sleepingDisplayName(vehicle),
  }));
  const sleepingGroupOptions = sleepingGroups.map((group) => ({
    value: group._id,
    label: group.name,
  }));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Edit ${row.fullName}`}
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm"
    >
      <div className="mx-auto max-w-4xl rounded-xl bg-slate-950 p-5 shadow-2xl ring-1 ring-white/10">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Edit {row.fullName}</h2>
            <p className="mt-1 text-sm text-slate-400">{row.email}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-white transition-all hover:bg-white/20"
          >
            Close
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <Section
            title="Status & Confirmation"
            state={sectionStates.status.state}
            error={sectionStates.status.error}
            saveLabel="Save Status"
            onSave={() =>
              void runSave("status", async () => {
                if (hasTicket === "") {
                  throw new Error("Please answer whether they have a ticket");
                }
                const result = await opsSaveStatus({
                  opsPassword,
                  applicationId: row.applicationId,
                  hasTicket: hasTicket === "yes",
                  arrival,
                  arrivalTime,
                  departure,
                  departureTime,
                  earlyDepartureReason: early ? earlyReason : undefined,
                });
                setStatusNotice(
                  result.requiresOpsReview
                    ? "opsReview"
                    : result.paymentRestored
                      ? "paymentRestored"
                      : null
                );
              })
            }
          >
            <Field
              label="Do they have their ticket?"
              as="select"
              required
              value={hasTicket}
              options={[
                { value: "yes", label: "Yes" },
                { value: "no", label: "No" },
              ]}
              onChange={(event) => setHasTicket(event.target.value as "" | "yes" | "no")}
            />
            <Field
              label="Arrival date"
              type="date"
              required
              value={arrival}
              min={content?.earliestArrival}
              max={content?.latestDeparture}
              onChange={(event) => setArrival(event.target.value)}
            />
            <Field
              label="Arrival window"
              as="select"
              required
              value={arrivalTime}
              options={TIME_OPTIONS}
              onChange={(event) => setArrivalTime(event.target.value as ArrivalDepartureTime)}
            />
            <Field
              label="Departure date"
              type="date"
              required
              value={departure}
              min={content?.earliestArrival}
              max={content?.latestDeparture}
              onChange={(event) => setDeparture(event.target.value)}
            />
            <Field
              label="Departure window"
              as="select"
              required
              value={departureTime}
              options={TIME_OPTIONS}
              onChange={(event) => setDepartureTime(event.target.value as ArrivalDepartureTime)}
            />
            {early && (
              <Field
                label="Early departure reason"
                as="textarea"
                required
                value={earlyReason}
                onChange={(event) => setEarlyReason(event.target.value)}
              />
            )}
            {statusNotice === "opsReview" && (
              <p className="text-sm text-amber-300">
                This edit moved the member into ops review.
              </p>
            )}
            {statusNotice === "paymentRestored" && (
              <p className="text-sm text-emerald-300">
                This edit restored payment for the member.
              </p>
            )}
          </Section>

          <Section
            title="Burn Experience & Emergency Contact"
            state={sectionStates.burns.state}
            error={sectionStates.burns.error}
            saveLabel="Save Burns & Emergency"
            onSave={() =>
              void runSave("burns", async () => {
                const parsedBurns = Number(numBurns);
                if (
                  numBurns.trim() === "" ||
                  !Number.isInteger(parsedBurns) ||
                  parsedBurns < 0
                ) {
                  throw new Error("Please enter a whole number of burns");
                }
                await opsSaveBurnsEmergency({
                  opsPassword,
                  applicationId: row.applicationId,
                  numBurnsAttended: parsedBurns,
                  emergencyContactName: emergencyName,
                  emergencyContactPhone: canonicalizePhoneInput(emergencyPhone),
                  emergencyContactEmail: emergencyEmail.trim() || undefined,
                });
              })
            }
          >
            <Field
              label="How many burns have they been to?"
              type="number"
              required
              min={0}
              step={1}
              value={numBurns}
              onChange={(event) => setNumBurns(event.target.value)}
            />
            <Field
              label="Emergency contact full name"
              type="text"
              required
              value={emergencyName}
              onChange={(event) => setEmergencyName(event.target.value)}
            />
            <Field
              label="Emergency contact phone"
              type="tel"
              required
              value={formatPhoneDisplay(emergencyPhone)}
              onChange={(event) => setEmergencyPhone(canonicalizePhoneInput(event.target.value))}
            />
            <Field
              label="Emergency contact email"
              type="email"
              value={emergencyEmail}
              onChange={(event) => setEmergencyEmail(event.target.value)}
            />
          </Section>

          <Section
            title="Transport"
            state={sectionStates.transport.state}
            error={sectionStates.transport.error}
            saveLabel="Save Transport"
            onSave={() =>
              void runSave("transport", async () => {
                if (!arrivalMode || !departureMode) {
                  throw new Error("Please select arrival and departure modes");
                }
                if (!vehiclePassStatus) {
                  throw new Error("Please select vehicle pass status");
                }
                if (!bikeStatus) {
                  throw new Error("Please select bike status");
                }
                await opsSaveTransport({
                  opsPassword,
                  applicationId: row.applicationId,
                  arrivalMode,
                  departureMode,
                  vehicleId: needsVehicle && vehicleId ? (vehicleId as Id<"vehicles">) : undefined,
                  vehiclePassStatus,
                  bikeStatus,
                });
              })
            }
          >
            <Field
              label="Arrival mode"
              as="select"
              required
              value={arrivalMode}
              options={toOptions(TRAVEL_MODE_LABELS)}
              onChange={(event) => setArrivalMode(event.target.value as "" | TravelMode)}
            />
            <Field
              label="Departure mode"
              as="select"
              required
              value={departureMode}
              options={toOptions(TRAVEL_MODE_LABELS)}
              onChange={(event) => setDepartureMode(event.target.value as "" | TravelMode)}
            />
            {needsVehicle && (
              <Field
                label="Vehicle"
                as="select"
                required
                value={vehicleId}
                options={vehicleOptions}
                onChange={(event) => setVehicleId(event.target.value)}
              />
            )}
            <Field
              label="Vehicle pass"
              as="select"
              required
              value={vehiclePassStatus}
              options={toOptions(VEHICLE_PASS_STATUS_LABELS)}
              onChange={(event) =>
                setVehiclePassStatus(event.target.value as "" | VehiclePassStatus)
              }
            />
            <Field
              label="Bike"
              as="select"
              required
              value={bikeStatus}
              options={toOptions(BIKE_STATUS_LABELS)}
              onChange={(event) => setBikeStatus(event.target.value as "" | BikeStatus)}
            />
          </Section>

          <Section
            title="Sleeping"
            state={sectionStates.sleeping.state}
            error={sectionStates.sleeping.error}
            saveLabel="Save Sleeping"
            onSave={() =>
              void runSave("sleeping", async () => {
                if (!sleepingType) {
                  throw new Error("Please select sleeping type");
                }
                await opsSaveSleeping({
                  opsPassword,
                  applicationId: row.applicationId,
                  sleepingType,
                  sleepingVehicleId:
                    sleepingType === "rv_trailer_vehicle" && sleepingVehicleId
                      ? (sleepingVehicleId as Id<"vehicles">)
                      : undefined,
                  sleepingGroupId:
                    sleepingType === "own_shiftpod_or_tent" && sleepingGroupId
                      ? (sleepingGroupId as Id<"sleeping_groups">)
                      : undefined,
                });
              })
            }
          >
            <Field
              label="Sleeping type"
              as="select"
              required
              value={sleepingType}
              options={toOptions(SLEEPING_TYPE_LABELS)}
              onChange={(event) => setSleepingType(event.target.value as "" | SleepingType)}
            />
            {sleepingType === "rv_trailer_vehicle" && (
              <Field
                label="Sleeping vehicle"
                as="select"
                required
                value={sleepingVehicleId}
                options={sleepingVehicleOptions}
                onChange={(event) => setSleepingVehicleId(event.target.value)}
              />
            )}
            {sleepingType === "own_shiftpod_or_tent" && (
              <Field
                label="Sleeping group"
                as="select"
                required
                value={sleepingGroupId}
                options={sleepingGroupOptions}
                onChange={(event) => setSleepingGroupId(event.target.value)}
              />
            )}
          </Section>

          <Section
            title="Meals"
            state={sectionStates.meals.state}
            error={sectionStates.meals.error}
            saveLabel="Save Meals"
            onSave={() =>
              void runSave("meals", async () => {
                if (!dietaryPreference) {
                  throw new Error("Please select dietary preference");
                }
                if (hasAllergies === "") {
                  throw new Error("Please answer whether they have allergies");
                }
                await opsSaveMeals({
                  opsPassword,
                  applicationId: row.applicationId,
                  dietaryPreference,
                  allergyFlag: hasAllergies === "yes",
                  allergyNotes: hasAllergies === "yes" ? allergyNotes : undefined,
                });
              })
            }
          >
            <Field
              label="Dietary preference"
              as="select"
              required
              value={dietaryPreference}
              options={DIETARY_OPTIONS}
              onChange={(event) => setDietaryPreference(event.target.value)}
            />
            <Field
              label="Food allergies?"
              as="select"
              required
              value={hasAllergies}
              options={[
                { value: "yes", label: "Yes" },
                { value: "no", label: "No" },
              ]}
              onChange={(event) => setHasAllergies(event.target.value as "" | "yes" | "no")}
            />
            {hasAllergies === "yes" && (
              <Field
                label="Allergy details"
                as="textarea"
                required
                value={allergyNotes}
                onChange={(event) => setAllergyNotes(event.target.value)}
              />
            )}
          </Section>

          <Section
            title="Camp"
            state={sectionStates.camp.state}
            error={sectionStates.camp.error}
            saveLabel="Save Camp"
            onSave={() =>
              void runSave("camp", async () => {
                await opsSaveCamp({
                  opsPassword,
                  applicationId: row.applicationId,
                  playaName: playaName.trim() || undefined,
                  requests: requests.trim() || undefined,
                });
              })
            }
          >
            <Field
              label="Playa name"
              type="text"
              value={playaName}
              onChange={(event) => setPlayaName(event.target.value)}
            />
            <Field
              label="Requests"
              as="textarea"
              value={requests}
              onChange={(event) => setRequests(event.target.value)}
            />
          </Section>
        </div>
      </div>
    </div>
  );
}
