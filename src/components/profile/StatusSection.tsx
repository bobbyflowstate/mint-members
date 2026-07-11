"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Field } from "../forms/Field";
import { ARRIVAL_DEPARTURE_TIMES, ArrivalDepartureTime } from "@/lib/applications/types";
import { isEarlyDeparture } from "@/lib/attendeeProfile/earlyDeparture";
import { formatDateWithWeekday } from "@/lib/dates/formatDateWithWeekday";
import { LandingContent } from "@/config/content";
import { ConditionalBox, ProfileData, SectionCard, useSaveState } from "./shared";

const TIME_OPTIONS = ARRIVAL_DEPARTURE_TIMES.map((time) => ({
  value: time,
  label: time,
}));

function TravelDateRow({
  label,
  date,
  time,
  editing,
  onEdit,
  onDateChange,
  onTimeChange,
  content,
}: {
  label: string;
  date: string;
  time: ArrivalDepartureTime;
  editing: boolean;
  onEdit: () => void;
  onDateChange: (value: string) => void;
  onTimeChange: (value: ArrivalDepartureTime) => void;
  content: LandingContent;
}) {
  if (!editing) {
    return (
      <div>
        <p className="mb-2 block text-sm font-medium leading-6 text-slate-200">{label}</p>
        <div className="flex items-center justify-between rounded-lg border border-dashed border-white/15 bg-white/5 px-4 py-3 text-sm text-slate-300">
          <span>
            {formatDateWithWeekday(date)} · {time}
          </span>
          <button
            type="button"
            onClick={onEdit}
            className="rounded-md bg-white/10 px-3 py-1 text-xs font-medium text-white hover:bg-white/20 transition-all"
          >
            Edit
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field
        label={`${label} — date`}
        type="date"
        value={date}
        min={content.earliestArrival}
        max={content.latestDeparture}
        onChange={(event) => onDateChange(event.target.value)}
      />
      <Field
        label="Window"
        as="select"
        value={time}
        options={TIME_OPTIONS}
        onChange={(event) => onTimeChange(event.target.value as ArrivalDepartureTime)}
      />
    </div>
  );
}

export function StatusSection({
  data,
  content,
  complete,
}: {
  data: ProfileData;
  content: LandingContent;
  complete: boolean;
}) {
  const saveStatus = useMutation(api.attendeeProfiles.saveStatus);
  const { state, error, run, markDirty } = useSaveState();

  const [hasTicket, setHasTicket] = useState<"" | "yes" | "no">(() =>
    data.profile.hasTicket === undefined ? "" : data.profile.hasTicket ? "yes" : "no"
  );
  const [arrival, setArrival] = useState(data.application.arrival);
  const [arrivalTime, setArrivalTime] = useState<ArrivalDepartureTime>(
    data.application.arrivalTime
  );
  const [departure, setDeparture] = useState(data.application.departure);
  const [departureTime, setDepartureTime] = useState<ArrivalDepartureTime>(
    data.application.departureTime
  );
  const [reason, setReason] = useState(data.application.earlyDepartureReason ?? "");
  const [editingArrival, setEditingArrival] = useState(false);
  const [editingDeparture, setEditingDeparture] = useState(false);
  const [opsReviewNotice, setOpsReviewNotice] = useState(false);

  const early = isEarlyDeparture(departure, departureTime, content.departureCutoff);

  const handleSave = () =>
    run(async () => {
      if (hasTicket === "") {
        throw new Error("Please answer whether you have your ticket");
      }
      const result = await saveStatus({
        hasTicket: hasTicket === "yes",
        arrival,
        arrivalTime,
        departure,
        departureTime,
        earlyDepartureReason: early ? reason : undefined,
      });
      setOpsReviewNotice(result.requiresOpsReview);
      setEditingArrival(false);
      setEditingDeparture(false);
    });

  return (
    <SectionCard
      title="Status & Confirmation"
      complete={complete}
      saveState={state}
      error={error}
      onSave={handleSave}
    >
      <Field
        label="Do you have your ticket?"
        as="select"
        required
        value={hasTicket}
        options={[
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ]}
        onChange={(event) => {
          setHasTicket(event.target.value as "" | "yes" | "no");
          markDirty();
        }}
      />

      <TravelDateRow
        label="Arrival date & window"
        date={arrival}
        time={arrivalTime}
        editing={editingArrival}
        onEdit={() => setEditingArrival(true)}
        onDateChange={(value) => {
          setArrival(value);
          markDirty();
        }}
        onTimeChange={(value) => {
          setArrivalTime(value);
          markDirty();
        }}
        content={content}
      />

      <TravelDateRow
        label="Departure date & window"
        date={departure}
        time={departureTime}
        editing={editingDeparture}
        onEdit={() => setEditingDeparture(true)}
        onDateChange={(value) => {
          setDeparture(value);
          markDirty();
        }}
        onTimeChange={(value) => {
          setDepartureTime(value);
          markDirty();
        }}
        content={content}
      />

      {early && (
        <ConditionalBox flag={`Leaving before build is complete (${content.departureCutoffFormatted}, 6:00 PM)`}>
          <Field
            label="Why are you leaving before build is complete?"
            as="textarea"
            required
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              markDirty();
            }}
            placeholder="Please explain why you need to leave early."
          />
        </ConditionalBox>
      )}

      {opsReviewNotice && (
        <p className="text-sm text-amber-400">
          Your early departure needs ops approval — we&apos;ll contact you via WhatsApp.
        </p>
      )}
    </SectionCard>
  );
}
