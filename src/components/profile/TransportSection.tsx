"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Field } from "../forms/Field";
import {
  BIKE_STATUS_LABELS,
  BikeStatus,
  TRAVEL_MODE_LABELS,
  TravelMode,
  VEHICLE_PASS_STATUS_LABELS,
  VEHICLE_TYPE_LABELS,
  VehiclePassStatus,
  VehicleType,
  isVehicleTravelMode,
  sleepingDisplayName,
  toOptions,
} from "@/lib/attendeeProfile/options";
import {
  ConditionalBox,
  InfoNote,
  ProfileData,
  SectionCard,
  useSaveState,
} from "./shared";

const NEW_VEHICLE = "__new__";

export function TransportSection({
  data,
  complete,
}: {
  data: ProfileData;
  complete: boolean;
}) {
  const vehicles = useQuery(api.vehicles.list) ?? [];
  const saveTransport = useMutation(api.attendeeProfiles.saveTransport);
  const createVehicle = useMutation(api.vehicles.create);
  const updateVehicle = useMutation(api.vehicles.update);
  const { state, error, run, markDirty } = useSaveState();

  const [arrivalMode, setArrivalMode] = useState<"" | TravelMode>(
    data.profile.arrivalMode ?? ""
  );
  const [departureMode, setDepartureMode] = useState<"" | TravelMode>(
    data.profile.departureMode ?? ""
  );
  const [vehicleChoice, setVehicleChoice] = useState<string>(
    data.profile.vehicleId ?? ""
  );
  const [passStatus, setPassStatus] = useState<"" | VehiclePassStatus>(
    data.profile.vehiclePassStatus ?? ""
  );
  const [bikeStatus, setBikeStatus] = useState<"" | BikeStatus>(
    data.profile.bikeStatus ?? ""
  );

  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"" | VehicleType>("");
  const [newLength, setNewLength] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newTrailerName, setNewTrailerName] = useState("");
  const [newPlate, setNewPlate] = useState("");
  const [editingVehicle, setEditingVehicle] = useState(false);

  const selectedVehicle = vehicles.find((vehicle) => vehicle._id === vehicleChoice);

  const startEditVehicle = () => {
    if (!selectedVehicle) return;
    setNewName(selectedVehicle.name);
    setNewType(selectedVehicle.vehicleType);
    setNewLength(String(selectedVehicle.lengthFt));
    setNewDescription(selectedVehicle.description);
    setNewTrailerName(selectedVehicle.trailerName ?? "");
    setNewPlate(selectedVehicle.licensePlate ?? "");
    setEditingVehicle(true);
    markDirty();
  };

  const needsVehicle = isVehicleTravelMode(arrivalMode) || isVehicleTravelMode(departureMode);
  // Only a driver creates a vehicle record; riders pick an existing one.
  const canCreateVehicle =
    arrivalMode === "driving_own_vehicle" || departureMode === "driving_own_vehicle";
  const addingVehicle = needsVehicle && canCreateVehicle && vehicleChoice === NEW_VEHICLE;
  const showVehicleFields = addingVehicle || editingVehicle;

  const vehicleOptions = [
    ...(canCreateVehicle ? [{ value: NEW_VEHICLE, label: "+ Add a new vehicle…" }] : []),
    ...vehicles.map((vehicle) => ({
      value: vehicle._id,
      label:
        vehicle.riderCount > 0
          ? `${vehicle.name} · ${vehicle.riderCount} rider${vehicle.riderCount === 1 ? "" : "s"}`
          : vehicle.name,
    })),
  ];

  const newVehiclePreview =
    newType === "vehicle_with_trailer" && newTrailerName.trim()
      ? newTrailerName.trim()
      : newName.trim() || "(vehicle name)";

  const handleSave = () =>
    run(async () => {
      if (!arrivalMode || !departureMode) {
        throw new Error("Please select how you are arriving and departing");
      }
      if (!passStatus) {
        throw new Error("Please select your vehicle pass status");
      }
      if (!bikeStatus) {
        throw new Error("Please select your bike plan");
      }

      let vehicleId: Id<"vehicles"> | undefined;
      if (needsVehicle) {
        if (addingVehicle || editingVehicle) {
          if (!newType) {
            throw new Error("Please select the vehicle type");
          }
          const vehicleFields = {
            name: newName,
            vehicleType: newType,
            lengthFt: Number(newLength),
            description: newDescription,
            trailerName:
              newType === "vehicle_with_trailer" && newTrailerName.trim()
                ? newTrailerName
                : undefined,
            licensePlate: newPlate.trim() || undefined,
          };
          if (editingVehicle) {
            vehicleId = vehicleChoice as Id<"vehicles">;
            await updateVehicle({ vehicleId, ...vehicleFields });
          } else {
            vehicleId = await createVehicle(vehicleFields);
          }
        } else if (vehicleChoice) {
          vehicleId = vehicleChoice as Id<"vehicles">;
        } else {
          throw new Error("Please select or add the vehicle you are traveling in");
        }
      }

      await saveTransport({
        arrivalMode,
        departureMode,
        vehicleId,
        vehiclePassStatus: passStatus,
        bikeStatus,
      });

      if ((addingVehicle || editingVehicle) && vehicleId) {
        setVehicleChoice(vehicleId);
        setEditingVehicle(false);
        setNewName("");
        setNewType("");
        setNewLength("");
        setNewDescription("");
        setNewTrailerName("");
        setNewPlate("");
      }
    });

  return (
    <SectionCard
      title="Transport"
      sub="Arrival and departure mode are chosen independently."
      complete={complete}
      saveState={state}
      error={error}
      onSave={handleSave}
    >
      <Field
        label="How are you arriving?"
        as="select"
        required
        value={arrivalMode}
        options={toOptions(TRAVEL_MODE_LABELS)}
        onChange={(event) => {
          setArrivalMode(event.target.value as "" | TravelMode);
          markDirty();
        }}
      />
      <Field
        label="How are you departing?"
        as="select"
        required
        value={departureMode}
        options={toOptions(TRAVEL_MODE_LABELS)}
        onChange={(event) => {
          setDepartureMode(event.target.value as "" | TravelMode);
          markDirty();
        }}
      />

      {needsVehicle && (
        <ConditionalBox flag="Shown because a vehicle mode was selected above">
          <div className="space-y-4">
            <Field
              label="Vehicle"
              as="select"
              required
              value={vehicleChoice}
              options={vehicleOptions}
              hint={
                canCreateVehicle
                  ? undefined
                  : "Riding with another attendee — pick their vehicle from the list. Don't see it? Ask whoever's driving to add it under their Transport section first."
              }
              onChange={(event) => {
                setVehicleChoice(event.target.value);
                setEditingVehicle(false);
                markDirty();
              }}
            />

            {showVehicleFields && (
              <div className="space-y-4">
                {editingVehicle && (
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-slate-300">
                      Editing “{selectedVehicle?.name}” — changes apply everywhere it&apos;s referenced.
                    </p>
                    <button
                      type="button"
                      onClick={() => setEditingVehicle(false)}
                      className="text-xs text-slate-400 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
                <Field
                  label="Vehicle name"
                  type="text"
                  required
                  value={newName}
                  placeholder="e.g. Ryan's Truck"
                  onChange={(event) => {
                    setNewName(event.target.value);
                    markDirty();
                  }}
                />
                <Field
                  label="Vehicle type"
                  as="select"
                  required
                  value={newType}
                  options={toOptions(VEHICLE_TYPE_LABELS)}
                  onChange={(event) => {
                    setNewType(event.target.value as "" | VehicleType);
                    markDirty();
                  }}
                />
                <Field
                  label="Overall length (ft)"
                  type="number"
                  required
                  min={0}
                  step={0.25}
                  value={newLength}
                  placeholder="e.g. 22.25"
                  hint={
                    newType === "vehicle_with_trailer"
                      ? "Combined length of vehicle + trailer."
                      : undefined
                  }
                  onChange={(event) => {
                    setNewLength(event.target.value);
                    markDirty();
                  }}
                />
                <Field
                  label="Vehicle description"
                  type="text"
                  required
                  value={newDescription}
                  placeholder="e.g. white Ford F-250, DeMentha decals on the doors"
                  onChange={(event) => {
                    setNewDescription(event.target.value);
                    markDirty();
                  }}
                />
                {newType === "vehicle_with_trailer" && (
                  <div>
                    <Field
                      label="Trailer name"
                      type="text"
                      hint="Optional — the trailer is the part people sleep in, and it's sometimes known by its own name."
                      value={newTrailerName}
                      placeholder="e.g. Sandpiper Inn"
                      onChange={(event) => {
                        setNewTrailerName(event.target.value);
                        markDirty();
                      }}
                    />
                    <div className="mt-2">
                      <InfoNote>
                        Will appear in Sleeping Accommodations as:{" "}
                        <strong className="text-slate-200">{newVehiclePreview}</strong>
                      </InfoNote>
                    </div>
                  </div>
                )}
                <Field
                  label="License plate"
                  type="text"
                  hint="Fill in if known — rentals get collected later."
                  value={newPlate}
                  onChange={(event) => {
                    setNewPlate(event.target.value);
                    markDirty();
                  }}
                />
              </div>
            )}

            {!showVehicleFields && selectedVehicle && (
              <div className="flex items-start justify-between gap-3">
                <InfoNote>
                  {VEHICLE_TYPE_LABELS[selectedVehicle.vehicleType]} ·{" "}
                  {selectedVehicle.lengthFt} ft · {selectedVehicle.description}
                  {selectedVehicle.trailerName
                    ? ` · sleeps in "${sleepingDisplayName(selectedVehicle)}"`
                    : ""}
                </InfoNote>
                {selectedVehicle.createdByMe && (
                  <button
                    type="button"
                    onClick={startEditVehicle}
                    className="shrink-0 rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 transition-all"
                  >
                    Edit details
                  </button>
                )}
              </div>
            )}
          </div>
        </ConditionalBox>
      )}

      <Field
        label="Vehicle pass status"
        as="select"
        required
        value={passStatus}
        options={toOptions(VEHICLE_PASS_STATUS_LABELS)}
        onChange={(event) => {
          setPassStatus(event.target.value as "" | VehiclePassStatus);
          markDirty();
        }}
      />
      <Field
        label="Bike"
        as="select"
        required
        value={bikeStatus}
        options={toOptions(BIKE_STATUS_LABELS)}
        onChange={(event) => {
          setBikeStatus(event.target.value as "" | BikeStatus);
          markDirty();
        }}
      />
    </SectionCard>
  );
}
