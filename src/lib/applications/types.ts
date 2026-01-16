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
  | "pescatarian"
  | "other";

export const DIETARY_PREFERENCES: DietaryPreference[] = [
  "omnivore",
  "vegetarian",
  "vegan",
  "pescatarian",
  "other",
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
  departure: string;
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
  departure: string; // ISO date string
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
