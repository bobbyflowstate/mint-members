// Types
export type {
  ApplicationStatus,
  DietaryPreference,
  ApplicationFormInput,
  ApplicationPayload,
  ValidationResult,
  ValidationError,
  Application,
} from "./types";

export { DIETARY_PREFERENCES } from "./types";

// Validation
export {
  validateApplicationInput,
  normalizePhone,
  isValidE164Phone,
} from "./validation";

// Errors
export {
  ErrorCodes,
  ErrorMessages,
  ApplicationValidationError,
} from "./errors";
export type { ErrorCode } from "./errors";
