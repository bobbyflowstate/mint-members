"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Field } from "../forms/Field";
import { canonicalizePhoneInput, formatPhoneDisplay } from "@/lib/phone/format";
import { ProfileData, SectionCard, useSaveState } from "./shared";

export function BurnsEmergencySection({
  data,
  complete,
}: {
  data: ProfileData;
  complete: boolean;
}) {
  const saveBurnsEmergency = useMutation(api.attendeeProfiles.saveBurnsEmergency);
  const { state, error, run, markDirty } = useSaveState();

  const [numBurns, setNumBurns] = useState(() =>
    data.profile.numBurnsAttended === undefined
      ? ""
      : String(data.profile.numBurnsAttended)
  );
  const [name, setName] = useState(data.profile.emergencyContactName ?? "");
  const [phone, setPhone] = useState(data.profile.emergencyContactPhone ?? "");
  const [email, setEmail] = useState(data.profile.emergencyContactEmail ?? "");

  const handleSave = () =>
    run(async () => {
      const parsedBurns = Number(numBurns);
      if (numBurns.trim() === "" || !Number.isInteger(parsedBurns) || parsedBurns < 0) {
        throw new Error("Please enter how many burns you have been to (0 or more)");
      }
      await saveBurnsEmergency({
        numBurnsAttended: parsedBurns,
        emergencyContactName: name,
        emergencyContactPhone: canonicalizePhoneInput(phone),
        emergencyContactEmail: email.trim() || undefined,
      });
    });

  return (
    <SectionCard
      title="Burn Experience & Emergency Contact"
      complete={complete}
      saveState={state}
      error={error}
      onSave={handleSave}
    >
      <Field
        label="How many burns have you been to (any event)?"
        type="number"
        required
        min={0}
        step={1}
        value={numBurns}
        placeholder="0"
        onChange={(event) => {
          setNumBurns(event.target.value);
          markDirty();
        }}
      />
      <Field
        label="Emergency contact — full name"
        type="text"
        required
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          markDirty();
        }}
      />
      <Field
        label="Emergency contact — phone"
        type="tel"
        required
        value={formatPhoneDisplay(phone)}
        placeholder="+1 555 123 1234"
        onChange={(event) => {
          setPhone(canonicalizePhoneInput(event.target.value));
          markDirty();
        }}
      />
      <Field
        label="Emergency contact — email"
        type="email"
        hint="Optional"
        value={email}
        onChange={(event) => {
          setEmail(event.target.value);
          markDirty();
        }}
      />
    </SectionCard>
  );
}
