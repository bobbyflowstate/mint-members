import { z } from "zod";
import dayjs from "dayjs";
import { ErrorCodes, ErrorMessages } from "./errors";
import type {
  ApplicationFormInput,
  ApplicationPayload,
  ValidationResult,
  ValidationError,
  DietaryPreference,
  ArrivalDepartureTime,
} from "./types";
import { DIETARY_PREFERENCES, ARRIVAL_DEPARTURE_TIMES } from "./types";

/**
 * Normalize phone number by removing spaces, dashes, and parentheses
 */
export function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-\(\)]/g, "");
}

/**
 * Check if a phone number is in valid E.164 format
 * E.164: + followed by 7-15 digits
 */
export function isValidE164Phone(phone: string): boolean {
  const e164Regex = /^\+[1-9]\d{6,14}$/;
  return e164Regex.test(phone);
}

/**
 * Check if a string is a valid ISO date (YYYY-MM-DD)
 */
function isValidDate(dateStr: string): boolean {
  const date = dayjs(dateStr, "YYYY-MM-DD", true);
  return date.isValid();
}

/**
 * Zod schema for email validation
 */
const emailSchema = z.string().email();

/**
 * Validate application input and return sanitized payload with any errors
 */
export function validateApplicationInput(
  input: ApplicationFormInput,
  config: { departureCutoff: string }
): ValidationResult {
  const errors: ValidationError[] = [];
  let requiresOpsReview = false;

  // Trim and sanitize string fields
  const trimmedInput = {
    firstName: input.firstName?.trim() ?? "",
    lastName: input.lastName?.trim() ?? "",
    email: input.email?.trim().toLowerCase() ?? "",
    phone: normalizePhone(input.phone ?? ""),
    arrival: input.arrival?.trim() ?? "",
    arrivalTime: input.arrivalTime,
    departure: input.departure?.trim() ?? "",
    departureTime: input.departureTime,
    dietaryPreference: input.dietaryPreference?.trim().toLowerCase() ?? "",
    allergyFlag: input.allergyFlag ?? false,
    allergyNotes: input.allergyNotes?.trim(),
  };

  // Validate required fields
  if (!trimmedInput.firstName) {
    errors.push({
      field: "firstName",
      code: ErrorCodes.REQUIRED_FIELD,
      message: ErrorMessages[ErrorCodes.REQUIRED_FIELD],
    });
  }

  if (!trimmedInput.lastName) {
    errors.push({
      field: "lastName",
      code: ErrorCodes.REQUIRED_FIELD,
      message: ErrorMessages[ErrorCodes.REQUIRED_FIELD],
    });
  }

  if (!trimmedInput.email) {
    errors.push({
      field: "email",
      code: ErrorCodes.REQUIRED_FIELD,
      message: ErrorMessages[ErrorCodes.REQUIRED_FIELD],
    });
  } else {
    // Validate email format
    const emailResult = emailSchema.safeParse(trimmedInput.email);
    if (!emailResult.success) {
      errors.push({
        field: "email",
        code: ErrorCodes.INVALID_EMAIL,
        message: ErrorMessages[ErrorCodes.INVALID_EMAIL],
      });
    }
  }

  // Validate phone (WhatsApp requirement)
  if (!trimmedInput.phone) {
    errors.push({
      field: "phone",
      code: ErrorCodes.REQUIRED_FIELD,
      message: ErrorMessages[ErrorCodes.REQUIRED_FIELD],
    });
  } else if (!isValidE164Phone(trimmedInput.phone)) {
    errors.push({
      field: "phone",
      code: ErrorCodes.INVALID_PHONE,
      message: ErrorMessages[ErrorCodes.INVALID_PHONE],
    });
  }

  // Validate arrival date
  if (!trimmedInput.arrival) {
    errors.push({
      field: "arrival",
      code: ErrorCodes.REQUIRED_FIELD,
      message: ErrorMessages[ErrorCodes.REQUIRED_FIELD],
    });
  } else if (!isValidDate(trimmedInput.arrival)) {
    errors.push({
      field: "arrival",
      code: ErrorCodes.INVALID_DATE,
      message: ErrorMessages[ErrorCodes.INVALID_DATE],
    });
  }

  // Validate departure date
  if (!trimmedInput.departure) {
    errors.push({
      field: "departure",
      code: ErrorCodes.REQUIRED_FIELD,
      message: ErrorMessages[ErrorCodes.REQUIRED_FIELD],
    });
  } else if (!isValidDate(trimmedInput.departure)) {
    errors.push({
      field: "departure",
      code: ErrorCodes.INVALID_DATE,
      message: ErrorMessages[ErrorCodes.INVALID_DATE],
    });
  }

  // Validate departure is after arrival
  if (
    isValidDate(trimmedInput.arrival) &&
    isValidDate(trimmedInput.departure)
  ) {
    const arrival = dayjs(trimmedInput.arrival);
    const departure = dayjs(trimmedInput.departure);

    if (departure.isBefore(arrival) || departure.isSame(arrival, "day")) {
      errors.push({
        field: "departure",
        code: ErrorCodes.DEPARTURE_BEFORE_ARRIVAL,
        message: ErrorMessages[ErrorCodes.DEPARTURE_BEFORE_ARRIVAL],
      });
    }

    // Check for early departure (before cutoff)
    const cutoff = dayjs(config.departureCutoff);
    if (departure.isBefore(cutoff, "day")) {
      requiresOpsReview = true;
      errors.push({
        field: "departure",
        code: ErrorCodes.EARLY_DEPARTURE,
        message: ErrorMessages[ErrorCodes.EARLY_DEPARTURE],
      });
    }
  }

  // Validate arrival time
  if (!trimmedInput.arrivalTime || !ARRIVAL_DEPARTURE_TIMES.includes(trimmedInput.arrivalTime)) {
    errors.push({
      field: "arrivalTime",
      code: ErrorCodes.REQUIRED_FIELD,
      message: "Please select an arrival time",
    });
  }

  // Validate departure time
  if (!trimmedInput.departureTime || !ARRIVAL_DEPARTURE_TIMES.includes(trimmedInput.departureTime)) {
    errors.push({
      field: "departureTime",
      code: ErrorCodes.REQUIRED_FIELD,
      message: "Please select a departure time",
    });
  }

  // Validate dietary preference
  if (!DIETARY_PREFERENCES.includes(trimmedInput.dietaryPreference as DietaryPreference)) {
    errors.push({
      field: "dietaryPreference",
      code: ErrorCodes.INVALID_DIETARY,
      message: ErrorMessages[ErrorCodes.INVALID_DIETARY],
    });
  }

  // Filter out early departure error from blocking errors
  // (it's informational, not a validation failure)
  const blockingErrors = errors.filter(
    (e) => e.code !== ErrorCodes.EARLY_DEPARTURE
  );

  // If there are blocking errors, return failure
  if (blockingErrors.length > 0) {
    return {
      success: false,
      requiresOpsReview,
      errors,
    };
  }

  // Build validated payload
  const payload: ApplicationPayload = {
    firstName: trimmedInput.firstName,
    lastName: trimmedInput.lastName,
    email: trimmedInput.email,
    phone: trimmedInput.phone,
    arrival: trimmedInput.arrival,
    arrivalTime: trimmedInput.arrivalTime as ArrivalDepartureTime,
    departure: trimmedInput.departure,
    departureTime: trimmedInput.departureTime as ArrivalDepartureTime,
    dietaryPreference: trimmedInput.dietaryPreference as DietaryPreference,
    allergyFlag: trimmedInput.allergyFlag,
    allergyNotes: trimmedInput.allergyNotes || undefined,
  };

  return {
    success: true,
    payload,
    requiresOpsReview,
    errors,
  };
}
