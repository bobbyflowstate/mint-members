"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Field } from "./Field";
import { DepartureNotice } from "./DepartureNotice";
import { PaymentCTA } from "./PaymentCTA";
import { DIETARY_PREFERENCES } from "@/lib/applications/types";
import { getLandingContent, requiresOpsReview } from "@/config/content";
import { Id } from "../../../convex/_generated/dataModel";

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  arrival: string;
  departure: string;
  dietaryPreference: string;
  allergyFlag: boolean;
  allergyNotes?: string;
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
  const content = getLandingContent(config ?? undefined);
  
  const createApplication = useMutation(api.applications.createDraftApplication);
  
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    defaultValues: {
      arrival: content.dementhaStartDate,
      departure: content.dementhaEndDate,
      dietaryPreference: "omnivore",
      allergyFlag: false,
    },
  });

  const watchDeparture = watch("departure");
  const watchAllergyFlag = watch("allergyFlag");
  const showEarlyDepartureWarning = watchDeparture && requiresOpsReview(watchDeparture, config ?? undefined);

  const onSubmit = async (data: FormData) => {
    setSubmitError(null);
    
    try {
      const result = await createApplication({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        arrival: data.arrival,
        departure: data.departure,
        dietaryPreference: data.dietaryPreference,
        allergyFlag: data.allergyFlag,
        allergyNotes: data.allergyNotes,
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
                Your application has been received. Complete your payment below to
                secure your spot at {content.campName}.
              </p>
            </div>
          )}
        </div>

        {submissionResult.paymentAllowed ? (
          <PaymentCTA
            applicationId={submissionResult.applicationId}
            amount={content.reservationFeeFormatted}
          />
        ) : (
          <div className="rounded-lg bg-slate-700/50 p-6 text-center">
            <p className="text-slate-400">
              Payment will be available after your early departure request is approved.
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
          {...register("email", {
            required: "Email is required",
            pattern: {
              value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
              message: "Please enter a valid email address",
            },
          })}
          error={errors.email?.message}
          placeholder="john@example.com"
          required
        />

        <Field
          label="Phone Number (WhatsApp)"
          type="tel"
          {...register("phone", {
            required: "Phone number is required",
            pattern: {
              value: /^\+[1-9]\d{6,14}$/,
              message: "Please enter a valid phone number with country code (e.g., +14155551234)",
            },
          })}
          error={errors.phone?.message}
          placeholder="+14155551234"
          hint="Include country code. This must be a WhatsApp-enabled number."
          required
        />
      </div>

      {/* Dates */}
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-white">Attendance Dates</h3>
        
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <Field
            label="Arrival Date"
            type="date"
            {...register("arrival", { required: "Arrival date is required" })}
            error={errors.arrival?.message}
            required
          />
          
          <Field
            label="Departure Date"
            type="date"
            {...register("departure", { required: "Departure date is required" })}
            error={errors.departure?.message}
            required
          />
        </div>

        {showEarlyDepartureWarning && (
          <DepartureNotice
            cutoffDate={content.departureCutoffFormatted}
            requestedDeparture={watchDeparture}
          />
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
            hint="Help us keep you safe by being specific"
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
