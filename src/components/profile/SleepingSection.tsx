"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Field } from "../forms/Field";
import {
  SLEEPING_TYPE_LABELS,
  SleepingType,
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

const NEW_GROUP = "__new__";

export function SleepingSection({
  data,
  complete,
}: {
  data: ProfileData;
  complete: boolean;
}) {
  const vehicles = useQuery(api.vehicles.list) ?? [];
  const groups = useQuery(api.sleepingGroups.list) ?? [];
  const saveSleeping = useMutation(api.attendeeProfiles.saveSleeping);
  const createGroup = useMutation(api.sleepingGroups.create);
  const updateGroup = useMutation(api.sleepingGroups.update);
  const { state, error, run, markDirty } = useSaveState();

  const [sleepingType, setSleepingType] = useState<"" | SleepingType>(
    data.profile.sleepingType ?? ""
  );
  const [vehicleChoice, setVehicleChoice] = useState(
    data.profile.sleepingVehicleId ?? ""
  );
  const [groupChoice, setGroupChoice] = useState(data.profile.sleepingGroupId ?? "");
  const [newGroupName, setNewGroupName] = useState("");
  const [renamingGroup, setRenamingGroup] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  const selectedGroup = groups.find((group) => group._id === groupChoice);

  // Trailer combos show the trailer name here — that's the part people
  // sleep in — otherwise the vehicle name.
  const vehicleOptions = vehicles.map((vehicle) => ({
    value: vehicle._id,
    label:
      vehicle.sleeperCount > 0
        ? `${sleepingDisplayName(vehicle)} · ${vehicle.sleeperCount} sleeper${
            vehicle.sleeperCount === 1 ? "" : "s"
          }`
        : sleepingDisplayName(vehicle),
  }));

  const groupOptions = [
    { value: NEW_GROUP, label: "+ Add a new shiftpod/tent…" },
    ...groups.map((group) => ({
      value: group._id,
      label:
        group.sleeperCount > 0
          ? `${group.name} · ${group.sleeperCount} sleeper${group.sleeperCount === 1 ? "" : "s"}`
          : group.name,
    })),
  ];

  const handleSave = () =>
    run(async () => {
      if (!sleepingType) {
        throw new Error("Please select where you are sleeping");
      }

      let sleepingGroupId: Id<"sleeping_groups"> | undefined;
      if (sleepingType === "own_shiftpod_or_tent") {
        if (groupChoice === NEW_GROUP) {
          sleepingGroupId = await createGroup({ name: newGroupName });
        } else if (groupChoice) {
          sleepingGroupId = groupChoice as Id<"sleeping_groups">;
          if (renamingGroup) {
            await updateGroup({ groupId: sleepingGroupId, name: renameValue });
            setRenamingGroup(false);
          }
        } else {
          throw new Error("Please select or add your shiftpod/tent");
        }
      }

      await saveSleeping({
        sleepingType,
        sleepingVehicleId:
          sleepingType === "rv_trailer_vehicle" && vehicleChoice
            ? (vehicleChoice as Id<"vehicles">)
            : undefined,
        sleepingGroupId,
      });

      if (sleepingGroupId && groupChoice === NEW_GROUP) {
        setGroupChoice(sleepingGroupId);
        setNewGroupName("");
      }
    });

  return (
    <SectionCard
      title="Sleeping Accommodations"
      sub="Separate from Transport — a driver can still sleep in a shiftpod."
      complete={complete}
      saveState={state}
      error={error}
      onSave={handleSave}
    >
      <Field
        label="Where are you sleeping?"
        as="select"
        required
        value={sleepingType}
        options={toOptions(SLEEPING_TYPE_LABELS)}
        onChange={(event) => {
          setSleepingType(event.target.value as "" | SleepingType);
          markDirty();
        }}
      />

      {sleepingType === "rv_trailer_vehicle" && (
        <ConditionalBox flag='Shown because "RV / Trailer / Vehicle" was selected'>
          <Field
            label="Which RV/trailer/vehicle?"
            as="select"
            required
            value={vehicleChoice}
            options={vehicleOptions}
            hint={
              vehicleOptions.length === 0
                ? "No vehicles yet — add one under Transport first."
                : "Add new vehicles under Transport; they show up here."
            }
            onChange={(event) => {
              setVehicleChoice(event.target.value);
              markDirty();
            }}
          />
        </ConditionalBox>
      )}

      {sleepingType === "own_shiftpod_or_tent" && (
        <ConditionalBox flag='Shown because "My Own Shiftpod or Tent" was selected'>
          <div className="space-y-4">
            <Field
              label="Shiftpod / tent name"
              as="select"
              required
              value={groupChoice}
              options={groupOptions}
              onChange={(event) => {
                setGroupChoice(event.target.value);
                setRenamingGroup(false);
                markDirty();
              }}
            />
            {selectedGroup?.createdByMe && !renamingGroup && (
              <button
                type="button"
                onClick={() => {
                  setRenameValue(selectedGroup.name);
                  setRenamingGroup(true);
                  markDirty();
                }}
                className="rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 transition-all"
              >
                Rename
              </button>
            )}
            {renamingGroup && (
              <Field
                label="New name"
                type="text"
                required
                value={renameValue}
                hint="Applies everywhere this shiftpod/tent is referenced. Saved when you save this section."
                onChange={(event) => {
                  setRenameValue(event.target.value);
                  markDirty();
                }}
              />
            )}
            {groupChoice === NEW_GROUP && (
              <Field
                label="New shiftpod/tent name"
                type="text"
                required
                value={newGroupName}
                placeholder="e.g. Camp Shiftpod"
                onChange={(event) => {
                  setNewGroupName(event.target.value);
                  markDirty();
                }}
              />
            )}
          </div>
        </ConditionalBox>
      )}

      {sleepingType === "need_camp_shiftpod" && (
        <ConditionalBox flag='Shown because "Need a DeMentha Shiftpod" was selected'>
          <InfoNote>
            $150/person fee — informational only here. Payment is collected separately.
          </InfoNote>
        </ConditionalBox>
      )}
    </SectionCard>
  );
}
