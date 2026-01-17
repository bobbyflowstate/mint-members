import { describe, it, expect } from "vitest";
import {
  ErrorCodes,
  ErrorMessages,
  ApplicationValidationError,
  type ErrorCode,
} from "./errors";

describe("ErrorCodes", () => {
  it("should have all expected field validation error codes", () => {
    expect(ErrorCodes.REQUIRED_FIELD).toBe("REQUIRED_FIELD");
    expect(ErrorCodes.INVALID_EMAIL).toBe("INVALID_EMAIL");
    expect(ErrorCodes.INVALID_PHONE).toBe("INVALID_PHONE");
    expect(ErrorCodes.INVALID_DATE).toBe("INVALID_DATE");
    expect(ErrorCodes.INVALID_DIETARY).toBe("INVALID_DIETARY");
  });

  it("should have all expected business rule error codes", () => {
    expect(ErrorCodes.DEPARTURE_BEFORE_ARRIVAL).toBe("DEPARTURE_BEFORE_ARRIVAL");
    expect(ErrorCodes.EARLY_DEPARTURE).toBe("EARLY_DEPARTURE");
    expect(ErrorCodes.WHATSAPP_REQUIRED).toBe("WHATSAPP_REQUIRED");
  });

  it("should have all expected system error codes", () => {
    expect(ErrorCodes.VALIDATION_FAILED).toBe("VALIDATION_FAILED");
  });
});

describe("ErrorMessages", () => {
  it("should have messages for all error codes", () => {
    const allErrorCodes = Object.values(ErrorCodes);

    for (const code of allErrorCodes) {
      expect(ErrorMessages[code as ErrorCode]).toBeDefined();
      expect(typeof ErrorMessages[code as ErrorCode]).toBe("string");
      expect(ErrorMessages[code as ErrorCode].length).toBeGreaterThan(0);
    }
  });

  it("should have user-friendly messages", () => {
    expect(ErrorMessages[ErrorCodes.REQUIRED_FIELD]).toBe("This field is required");
    expect(ErrorMessages[ErrorCodes.INVALID_EMAIL]).toBe("Please enter a valid email address");
    expect(ErrorMessages[ErrorCodes.INVALID_PHONE]).toContain("country code");
    expect(ErrorMessages[ErrorCodes.DEPARTURE_BEFORE_ARRIVAL]).toContain("after arrival");
  });
});

describe("ApplicationValidationError", () => {
  describe("constructor", () => {
    it("should create error with code and default message", () => {
      const error = new ApplicationValidationError(ErrorCodes.REQUIRED_FIELD);

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe("ApplicationValidationError");
      expect(error.code).toBe(ErrorCodes.REQUIRED_FIELD);
      expect(error.message).toBe(ErrorMessages[ErrorCodes.REQUIRED_FIELD]);
      expect(error.field).toBeUndefined();
    });

    it("should create error with code and field", () => {
      const error = new ApplicationValidationError(
        ErrorCodes.INVALID_EMAIL,
        "email"
      );

      expect(error.code).toBe(ErrorCodes.INVALID_EMAIL);
      expect(error.field).toBe("email");
      expect(error.message).toBe(ErrorMessages[ErrorCodes.INVALID_EMAIL]);
    });

    it("should create error with custom message", () => {
      const customMessage = "Custom validation error message";
      const error = new ApplicationValidationError(
        ErrorCodes.VALIDATION_FAILED,
        "custom_field",
        customMessage
      );

      expect(error.code).toBe(ErrorCodes.VALIDATION_FAILED);
      expect(error.field).toBe("custom_field");
      expect(error.message).toBe(customMessage);
    });

    it("should prefer custom message over default", () => {
      const customMessage = "Override default message";
      const error = new ApplicationValidationError(
        ErrorCodes.REQUIRED_FIELD,
        undefined,
        customMessage
      );

      expect(error.message).toBe(customMessage);
      expect(error.message).not.toBe(ErrorMessages[ErrorCodes.REQUIRED_FIELD]);
    });
  });

  describe("inheritance", () => {
    it("should be throwable and catchable as Error", () => {
      const error = new ApplicationValidationError(ErrorCodes.INVALID_DATE, "arrival");

      expect(() => {
        throw error;
      }).toThrow(ApplicationValidationError);

      expect(() => {
        throw error;
      }).toThrow(Error);
    });

    it("should have stack trace", () => {
      const error = new ApplicationValidationError(ErrorCodes.REQUIRED_FIELD);

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain("ApplicationValidationError");
    });
  });

  describe("error codes with all fields", () => {
    it("should work with INVALID_PHONE code", () => {
      const error = new ApplicationValidationError(ErrorCodes.INVALID_PHONE, "phone");

      expect(error.code).toBe("INVALID_PHONE");
      expect(error.field).toBe("phone");
      expect(error.message).toContain("phone number");
    });

    it("should work with EARLY_DEPARTURE code", () => {
      const error = new ApplicationValidationError(
        ErrorCodes.EARLY_DEPARTURE,
        "departure"
      );

      expect(error.code).toBe("EARLY_DEPARTURE");
      expect(error.field).toBe("departure");
      expect(error.message).toContain("ops approval");
    });

    it("should work with WHATSAPP_REQUIRED code", () => {
      const error = new ApplicationValidationError(ErrorCodes.WHATSAPP_REQUIRED);

      expect(error.code).toBe("WHATSAPP_REQUIRED");
      expect(error.message).toContain("WhatsApp");
    });
  });
});
