"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Field } from "./Field";
import { DepartureNotice } from "./DepartureNotice";
import { PaymentCTA } from "./PaymentCTA";
import { DIETARY_PREFERENCES, ARRIVAL_DEPARTURE_TIMES, ArrivalDepartureTime } from "@/lib/applications/types";
import { getLandingContent, requiresOpsReview, AppConfig } from "@/config/content";
import { Id } from "../../../convex/_generated/dataModel";
import { usePhoneFormatter } from "./usePhoneFormatter";
import type { Control, ControllerRenderProps } from "react-hook-form";
import { isFlagEnabled } from "@/lib/config/flags";

interface FormData {
  firstName: string;
  lastName: string;
  phone: string;
  arrival: string;
  arrivalTime: ArrivalDepartureTime | "";
  departure: string;
  departureTime: ArrivalDepartureTime | "";
  dietaryPreference: string;
  allergyFlag: boolean;
  allergyNotes?: string;
  earlyDepartureReason?: string;
}

interface SubmissionResult {
  applicationId: Id<"applications">;
  status: string;
  paymentAllowed: boolean;
  requiresOpsReview: boolean;
}

export function ApplicationForm() {
  const [submissionResult, setSubmissionResult] = useState<SubmissionResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  
  const config = useQuery(api.config.getConfig);
  const currentUser = useQuery(api.users.currentUser);
  const createApplication = useMutation(api.applications.createDraftApplication);

  // Show loading while config or user loads
  if (!config || currentUser === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const content = getLandingContent(config as AppConfig);
  const userEmail = currentUser?.email ?? "";
  const paymentsEnabled = isFlagEnabled((config as AppConfig).paymentsEnabled);

  return (
    <ApplicationFormInner
      config={config as AppConfig}
      content={content}
      userEmail={userEmail}
      paymentsEnabled={paymentsEnabled}
      submissionResult={submissionResult}
      setSubmissionResult={setSubmissionResult}
      submitError={submitError}
      setSubmitError={setSubmitError}
      createApplication={createApplication}
    />
  );
}

function ApplicationFormInner({ 
  config, 
  content, 
  userEmail,
  paymentsEnabled,
  submissionResult, 
  setSubmissionResult, 
  submitError, 
  setSubmitError,
  createApplication 
}: { 
  config: AppConfig;
  content: ReturnType<typeof getLandingContent>;
  userEmail: string;
  paymentsEnabled: boolean;
  submissionResult: SubmissionResult | null;
  setSubmissionResult: (result: SubmissionResult | null) => void;
  submitError: string | null;
  setSubmitError: (error: string | null) => void;
  createApplication: ReturnType<typeof useMutation<typeof api.applications.createDraftApplication>>;
}) {
  const {
    register,
    handleSubmit,
    watch,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    defaultValues: {
      arrival: "",
      arrivalTime: "",
      departure: "",
      departureTime: "",
      dietaryPreference: "omnivore",
      allergyFlag: false,
    },
  });

  const watchDeparture = watch("departure");
  const watchAllergyFlag = watch("allergyFlag");
  const showEarlyDepartureWarning = watchDeparture && requiresOpsReview(watchDeparture, config.departureCutoff);

  const onSubmit = async (data: FormData) => {
    setSubmitError(null);
    
    try {
      const result = await createApplication({
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone, // Already canonicalized (E.164) by phone formatter
        arrival: data.arrival,
        arrivalTime: data.arrivalTime as ArrivalDepartureTime,
        departure: data.departure,
        departureTime: data.departureTime as ArrivalDepartureTime,
        dietaryPreference: data.dietaryPreference,
        allergyFlag: data.allergyFlag,
        allergyNotes: data.allergyNotes,
        earlyDepartureReason: data.earlyDepartureReason,
      });
      
      setSubmissionResult(result);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "An error occurred while submitting your application"
      );
    }
  };

  // Show payment step if application was submitted
  if (submissionResult) {
    return (
      <div className="space-y-8">
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-6">
          <div className="flex items-center gap-3">
            <svg
              className="h-6 w-6 text-emerald-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 className="text-lg font-semibold text-emerald-400">
              Application Submitted!
            </h3>
          </div>
          
          {submissionResult.requiresOpsReview ? (
            <div className="mt-4 text-slate-300">
              <p>
                Your early departure request has been submitted and is pending review
                by our operations team.
              </p>
              <p className="mt-2">
                We&apos;ll contact you via WhatsApp once your request has been reviewed.
                You&apos;ll be able to complete payment after approval.
              </p>
            </div>
          ) : (
            <div className="mt-4 text-slate-300">
              <p>
                {paymentsEnabled
                  ? `Your application has been received. Complete your Non Refundable payment below to secure your spot at ${content.campName}.`
                  : "Your application has been received. Payments will open after applications have been reviewed."}
              </p>
            </div>
          )}
        </div>

        {submissionResult.paymentAllowed && paymentsEnabled ? (
          <PaymentCTA
            applicationId={submissionResult.applicationId}
            amount={content.reservationFeeFormatted}
          />
        ) : (
          <div className="rounded-lg bg-slate-700/50 p-6 text-center">
            <p className="text-slate-400">
              {submissionResult.paymentAllowed
                ? "Payments are not open yet. Please check back once payments are enabled."
                : "Payment will be available after your early departure request is approved."}
            </p>
          </div>
        )}
      </div>
    );
  }

  const dietaryOptions = DIETARY_PREFERENCES.map((pref) => ({
    value: pref,
    label: pref.charAt(0).toUpperCase() + pref.slice(1),
  }));

  const timeOptions = ARRIVAL_DEPARTURE_TIMES.map((time) => ({
    value: time,
    label: time.charAt(0).toUpperCase() + time.slice(1),
  }));

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {submitError && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4">
          <p className="text-sm text-red-400">{submitError}</p>
        </div>
      )}

      {/* Personal Information */}
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-white">Personal Information</h3>
        
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <Field
            label="First Name"
            {...register("firstName", { required: "First name is required" })}
            error={errors.firstName?.message}
            placeholder="John"
            required
          />
          
          <Field
            label="Last Name"
            {...register("lastName", { required: "Last name is required" })}
            error={errors.lastName?.message}
            placeholder="Doe"
            required
          />
        </div>

        <Field
          label="Email"
          type="email"
          value={userEmail}
          disabled
          hint="Email is linked to your account and cannot be changed"
        />

        <PhoneField control={control} error={errors.phone?.message} />
      </div>

      {/* Dates */}
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-white">Attendance Dates</h3>
        <p className="text-sm text-slate-400">
          Camp is operational {content.campDates}
        </p>
        
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <Field
            label="Arrival Date"
            type="date"
            min={content.earliestArrival}
            max={content.latestDeparture}
            {...register("arrival", { required: "Arrival date is required" })}
            error={errors.arrival?.message}
            required
          />
          
          <Field
            as="select"
            label="Arrival Time"
            options={timeOptions}
            {...register("arrivalTime", { required: "Arrival time is required" })}
            error={errors.arrivalTime?.message}
            required
          />
          
          <Field
            label="Departure Date"
            type="date"
            min={content.earliestArrival}
            max={content.latestDeparture}
            {...register("departure", { required: "Departure date is required" })}
            error={errors.departure?.message}
            required
          />
          
          <Field
            as="select"
            label="Departure Time"
            options={timeOptions}
            {...register("departureTime", { required: "Departure time is required" })}
            error={errors.departureTime?.message}
            required
          />
        </div>

        {showEarlyDepartureWarning && (
          <>
            <DepartureNotice
              cutoffDate={content.departureCutoffFormatted}
              requestedDeparture={watchDeparture}
            />
            <Field
              as="textarea"
              label="Reason for Early Departure"
              {...register("earlyDepartureReason", {
                required: showEarlyDepartureWarning ? "Please explain why you need to leave early" : false,
              })}
              error={errors.earlyDepartureReason?.message}
              placeholder="Please explain why you need to leave before the standard departure date..."
              hint="This will help our ops team review your request"
              required
            />
          </>
        )}
      </div>

      {/* Dietary */}
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-white">Dietary Information</h3>
        
        <Field
          as="select"
          label="Dietary Preference"
          options={dietaryOptions}
          {...register("dietaryPreference", { required: "Please select a dietary preference" })}
          error={errors.dietaryPreference?.message}
          required
        />

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="allergyFlag"
            {...register("allergyFlag")}
            className="h-4 w-4 rounded border-white/10 bg-white/5 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900"
          />
          <label htmlFor="allergyFlag" className="text-sm text-slate-200">
            I have food allergies or dietary restrictions
          </label>
        </div>

        {watchAllergyFlag && (
          <Field
            as="textarea"
            label="Allergy Details"
            {...register("allergyNotes")}
            placeholder="Please describe your allergies or dietary restrictions..."
          />
        )}
      </div>

      {/* Submit */}
      <div className="pt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-emerald-500 px-6 py-4 text-base font-semibold text-white shadow-sm hover:bg-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isSubmitting ? "Submitting..." : "Submit Application"}
        </button>
        
        <p className="mt-4 text-center text-sm text-slate-400">
          By submitting, you agree to our expectations and commit to being an
          active participant at {content.campName}.
        </p>
      </div>
    </form>
  );
}

type PhoneFieldProps = {
  control: Control<FormData>;
  error?: string;
};

function PhoneField({ control, error }: PhoneFieldProps) {
  return (
    <Controller
      name="phone"
      control={control}
      defaultValue=""
      rules={{
        required: "Phone number is required",
        pattern: {
          value: /^\+[1-9]\d{6,14}$/,
          message: "Please enter a valid phone number with country code (e.g., +14155551234)",
        },
      }}
      render={({ field }) => <PhoneInputField field={field} error={error} />}
    />
  );
}

type PhoneInputFieldProps = {
  field: ControllerRenderProps<FormData, "phone">;
  error?: string;
};

function PhoneInputField({ field, error }: PhoneInputFieldProps) {
  const { displayValue, handleChange, handleBlur } = usePhoneFormatter(field.value ?? "");

  return (
    <Field
      label="Phone Number (WhatsApp)"
      type="tel"
      name={field.name}
      ref={field.ref}
      value={displayValue}
      onChange={(event) => {
        const canonical = handleChange(event.target.value);
        field.onChange(canonical);
      }}
      onBlur={(event) => {
        const canonical = handleBlur(event.target.value);
        if (canonical !== field.value) {
          field.onChange(canonical);
        }
        field.onBlur();
      }}
      error={error}
      placeholder="+14155551234"
      hint="Include country code. This must be a WhatsApp-enabled number."
      required
    />
  );
}
