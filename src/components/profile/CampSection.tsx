"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Field } from "../forms/Field";
import { ProfileData, SectionCard, useSaveState } from "./shared";

export function CampSection({ data }: { data: ProfileData }) {
  const saveCamp = useMutation(api.attendeeProfiles.saveCamp);
  const { state, error, run, markDirty } = useSaveState();

  const [playaName, setPlayaName] = useState(data.profile.playaName ?? "");
  const [requests, setRequests] = useState(data.profile.requests ?? "");

  const handleSave = () =>
    run(async () => {
      await saveCamp({
        playaName: playaName.trim() || undefined,
        requests: requests.trim() || undefined,
      });
    });

  return (
    <SectionCard
      title="Camp Directory & Requests"
      sub="Both optional."
      saveState={state}
      error={error}
      onSave={handleSave}
    >
      <Field
        label="Playa name"
        type="text"
        hint="Shown alongside your legal name in the attendee directory."
        value={playaName}
        onChange={(event) => {
          setPlayaName(event.target.value);
          markDirty();
        }}
      />
      <Field
        label="Requests"
        as="textarea"
        hint="Anything ops should know (ride-share, arrival changes, etc.)"
        value={requests}
        onChange={(event) => {
          setRequests(event.target.value);
          markDirty();
        }}
      />
    </SectionCard>
  );
}
