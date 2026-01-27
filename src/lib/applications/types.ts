/**
 * Application status values
 */
export type ApplicationStatus =
  | "draft"
  | "pending_payment"
  | "needs_ops_review"
  | "payment_processing"
  | "confirmed"
  | "rejected";

/**
 * Dietary preference options
 */
export type DietaryPreference =
  | "omnivore"
  | "vegetarian"
  | "vegan"
  | "pescatarian";

export const DIETARY_PREFERENCES: DietaryPreference[] = [
  "omnivore",
  "vegetarian",
  "vegan",
  "pescatarian",
];

/**
 * Arrival/Departure time options
 */
export type ArrivalDepartureTime =
  | "12:01 am to 11.00 am"
  | "11.01 am to 6.00 pm"
  | "6.01 pm to 12.00 am";

export const ARRIVAL_DEPARTURE_TIMES: ArrivalDepartureTime[] = [
  "12:01 am to 11.00 am",
  "11.01 am to 6.00 pm",
  "6.01 pm to 12.00 am",
];

/**
 * Raw input from the application form (before validation)
 */
export interface ApplicationFormInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  arrival: string;
  arrivalTime: ArrivalDepartureTime;
  departure: string;
  departureTime: ArrivalDepartureTime;
  dietaryPreference: string;
  allergyFlag: boolean;
  allergyNotes?: string;
}

/**
 * Validated and sanitized application payload
 */
export interface ApplicationPayload {
  firstName: string;
  lastName: string;
  email: string;
  phone: string; // Canonical E.164 format
  arrival: string; // ISO date string
  arrivalTime: ArrivalDepartureTime;
  departure: string; // ISO date string
  departureTime: ArrivalDepartureTime;
  dietaryPreference: DietaryPreference;
  allergyFlag: boolean;
  allergyNotes?: string;
}

/**
 * Result of validation
 */
export interface ValidationResult {
  success: boolean;
  payload?: ApplicationPayload;
  requiresOpsReview: boolean;
  errors: ValidationError[];
}

/**
 * Validation error details
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

/**
 * Full application document (as stored in Convex)
 */
export interface Application extends ApplicationPayload {
  _id: string;
  status: ApplicationStatus;
  checkoutSessionId?: string;
  earlyDepartureRequested: boolean;
  paymentAllowed: boolean;
  createdAt: number;
  updatedAt: number;
}
