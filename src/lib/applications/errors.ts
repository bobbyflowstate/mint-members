/**
 * Error codes for application validation
 */
export const ErrorCodes = {
  // Field validation errors
  REQUIRED_FIELD: "REQUIRED_FIELD",
  INVALID_EMAIL: "INVALID_EMAIL",
  INVALID_PHONE: "INVALID_PHONE",
  INVALID_DATE: "INVALID_DATE",
  INVALID_DIETARY: "INVALID_DIETARY",
  
  // Business rule errors
  DEPARTURE_BEFORE_ARRIVAL: "DEPARTURE_BEFORE_ARRIVAL",
  EARLY_DEPARTURE: "EARLY_DEPARTURE",
  WHATSAPP_REQUIRED: "WHATSAPP_REQUIRED",
  
  // System errors
  VALIDATION_FAILED: "VALIDATION_FAILED",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Error messages mapped to codes
 */
export const ErrorMessages: Record<ErrorCode, string> = {
  [ErrorCodes.REQUIRED_FIELD]: "This field is required",
  [ErrorCodes.INVALID_EMAIL]: "Please enter a valid email address",
  [ErrorCodes.INVALID_PHONE]: "Please enter a valid phone number with country code (e.g., +1234567890)",
  [ErrorCodes.INVALID_DATE]: "Please enter a valid date",
  [ErrorCodes.INVALID_DIETARY]: "Please select a valid dietary preference",
  [ErrorCodes.DEPARTURE_BEFORE_ARRIVAL]: "Departure date must be after arrival date",
  [ErrorCodes.EARLY_DEPARTURE]: "Early departure requires ops approval",
  [ErrorCodes.WHATSAPP_REQUIRED]: "A valid WhatsApp-compatible phone number is required",
  [ErrorCodes.VALIDATION_FAILED]: "Validation failed",
};

/**
 * Application validation error class
 */
export class ApplicationValidationError extends Error {
  public readonly code: ErrorCode;
  public readonly field?: string;

  constructor(code: ErrorCode, field?: string, customMessage?: string) {
    super(customMessage ?? ErrorMessages[code]);
    this.name = "ApplicationValidationError";
    this.code = code;
    this.field = field;
  }
}
