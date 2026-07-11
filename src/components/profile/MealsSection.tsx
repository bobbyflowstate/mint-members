"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Field } from "../forms/Field";
import { DIETARY_PREFERENCES } from "@/lib/applications/types";
import { DIETARY_PREFERENCE_LABELS } from "@/lib/attendeeProfile/options";
import { ConditionalBox, ProfileData, SectionCard, useSaveState } from "./shared";

const DIETARY_OPTIONS = DIETARY_PREFERENCES.map((preference) => ({
  value: preference,
  label: DIETARY_PREFERENCE_LABELS[preference] ?? preference,
}));

export function MealsSection({
  data,
  complete,
}: {
  data: ProfileData;
  complete: boolean;
}) {
  const saveMeals = useMutation(api.attendeeProfiles.saveMeals);
  const { state, error, run, markDirty } = useSaveState();

  const [dietaryPreference, setDietaryPreference] = useState(
    data.application.dietaryPreference
  );
  const [hasAllergies, setHasAllergies] = useState<"" | "yes" | "no">(
    data.application.allergyFlag ? "yes" : "no"
  );
  const [allergyNotes, setAllergyNotes] = useState(data.application.allergyNotes ?? "");

  const handleSave = () =>
    run(async () => {
      if (hasAllergies === "") {
        throw new Error("Please answer whether you have food allergies");
      }
      await saveMeals({
        dietaryPreference,
        allergyFlag: hasAllergies === "yes",
        allergyNotes: hasAllergies === "yes" ? allergyNotes : undefined,
      });
    });

  return (
    <SectionCard
      title="Meals"
      complete={complete}
      saveState={state}
      error={error}
      onSave={handleSave}
    >
      <Field
        label="Dietary preference"
        as="select"
        required
        value={dietaryPreference}
        options={DIETARY_OPTIONS}
        onChange={(event) => {
          setDietaryPreference(event.target.value);
          markDirty();
        }}
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
        onChange={(event) => {
          setHasAllergies(event.target.value as "" | "yes" | "no");
          markDirty();
        }}
      />
      {hasAllergies === "yes" && (
        <ConditionalBox flag="Shown because allergies = Yes">
          <Field
            label="Please describe"
            as="textarea"
            required
            value={allergyNotes}
            placeholder="Allergy details…"
            onChange={(event) => {
              setAllergyNotes(event.target.value);
              markDirty();
            }}
          />
        </ConditionalBox>
      )}
    </SectionCard>
  );
}
