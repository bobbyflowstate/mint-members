import { describe, it, expect } from "vitest";
import {
  validateApplicationInput,
  normalizePhone,
  isValidE164Phone,
} from "./validation";
import { ErrorCodes } from "./errors";
import type { ApplicationFormInput } from "./types";

// Valid form input for testing
const validInput: ApplicationFormInput = {
  firstName: "John",
  lastName: "Doe",
  email: "john@example.com",
  phone: "+14155551234",
  arrival: "2025-08-22",
  departure: "2025-09-01",
  dietaryPreference: "omnivore",
  allergyFlag: false,
};

// Config for testing
const testConfig = {
  departureCutoff: "2025-09-01",
};

describe("validateApplicationInput", () => {
  describe("valid input", () => {
    it("should return success with valid payload for correct input", () => {
      const result = validateApplicationInput(validInput, testConfig);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.payload).toBeDefined();
      expect(result.payload?.firstName).toBe("John");
      expect(result.payload?.lastName).toBe("Doe");
      expect(result.payload?.email).toBe("john@example.com");
    });

    it("should trim whitespace from string fields", () => {
      const input = {
        ...validInput,
        firstName: "  John  ",
        lastName: "  Doe  ",
        email: "  john@example.com  ",
      };

      const result = validateApplicationInput(input, testConfig);

      expect(result.success).toBe(true);
      expect(result.payload?.firstName).toBe("John");
      expect(result.payload?.lastName).toBe("Doe");
      expect(result.payload?.email).toBe("john@example.com");
    });

    it("should set requiresOpsReview to false when departure is on or after cutoff", () => {
      const result = validateApplicationInput(validInput, testConfig);

      expect(result.requiresOpsReview).toBe(false);
    });
  });

  describe("required fields", () => {
    it("should reject empty firstName", () => {
      const input = { ...validInput, firstName: "" };
      const result = validateApplicationInput(input, testConfig);

      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.field === "firstName")).toBe(true);
    });

    it("should reject empty lastName", () => {
      const input = { ...validInput, lastName: "" };
      const result = validateApplicationInput(input, testConfig);

      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.field === "lastName")).toBe(true);
    });

    it("should reject empty email", () => {
      const input = { ...validInput, email: "" };
      const result = validateApplicationInput(input, testConfig);

      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.field === "email")).toBe(true);
    });

    it("should reject empty phone", () => {
      const input = { ...validInput, phone: "" };
      const result = validateApplicationInput(input, testConfig);

      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.field === "phone")).toBe(true);
    });
  });

  describe("email validation", () => {
    it("should reject invalid email format", () => {
      const input = { ...validInput, email: "not-an-email" };
      const result = validateApplicationInput(input, testConfig);

      expect(result.success).toBe(false);
      expect(
        result.errors.some(
          (e) => e.field === "email" && e.code === ErrorCodes.INVALID_EMAIL
        )
      ).toBe(true);
    });

    it("should accept valid email formats", () => {
      const validEmails = [
        "test@example.com",
        "user.name@domain.org",
        "user+tag@example.co.uk",
      ];

      for (const email of validEmails) {
        const input = { ...validInput, email };
        const result = validateApplicationInput(input, testConfig);
        expect(result.success).toBe(true);
      }
    });
  });

  describe("phone validation (WhatsApp requirement)", () => {
    it("should reject phone without country code", () => {
      const input = { ...validInput, phone: "4155551234" };
      const result = validateApplicationInput(input, testConfig);

      expect(result.success).toBe(false);
      expect(
        result.errors.some(
          (e) => e.field === "phone" && e.code === ErrorCodes.INVALID_PHONE
        )
      ).toBe(true);
    });

    it("should reject invalid phone format", () => {
      const invalidPhones = ["123", "abcdefghij", "415-555-1234", "+1abc"];

      for (const phone of invalidPhones) {
        const input = { ...validInput, phone };
        const result = validateApplicationInput(input, testConfig);
        expect(result.success).toBe(false);
      }
    });

    it("should accept valid E.164 phone numbers", () => {
      const validPhones = ["+14155551234", "+442071234567", "+5511987654321"];

      for (const phone of validPhones) {
        const input = { ...validInput, phone };
        const result = validateApplicationInput(input, testConfig);
        expect(result.success).toBe(true);
        expect(result.payload?.phone).toBe(phone);
      }
    });
  });

  describe("date validation", () => {
    it("should reject departure before arrival", () => {
      const input = {
        ...validInput,
        arrival: "2025-08-25",
        departure: "2025-08-24",
      };
      const result = validateApplicationInput(input, testConfig);

      expect(result.success).toBe(false);
      expect(
        result.errors.some(
          (e) =>
            e.field === "departure" &&
            e.code === ErrorCodes.DEPARTURE_BEFORE_ARRIVAL
        )
      ).toBe(true);
    });

    it("should reject invalid date format", () => {
      const input = { ...validInput, arrival: "not-a-date" };
      const result = validateApplicationInput(input, testConfig);

      expect(result.success).toBe(false);
      expect(
        result.errors.some(
          (e) => e.field === "arrival" && e.code === ErrorCodes.INVALID_DATE
        )
      ).toBe(true);
    });
  });

  describe("early departure (ops review)", () => {
    it("should set requiresOpsReview to true when departure is before cutoff", () => {
      const input = {
        ...validInput,
        departure: "2025-08-30", // Before 2025-09-01 cutoff
      };
      const result = validateApplicationInput(input, testConfig);

      // Should still succeed but flag for review
      expect(result.success).toBe(true);
      expect(result.requiresOpsReview).toBe(true);
      expect(result.payload).toBeDefined();
    });

    it("should include early departure message in errors when review required", () => {
      const input = {
        ...validInput,
        departure: "2025-08-30",
      };
      const result = validateApplicationInput(input, testConfig);

      expect(
        result.errors.some((e) => e.code === ErrorCodes.EARLY_DEPARTURE)
      ).toBe(true);
    });
  });

  describe("dietary preference validation", () => {
    it("should reject unsupported dietary values", () => {
      const input = { ...validInput, dietaryPreference: "invalid-diet" };
      const result = validateApplicationInput(input, testConfig);

      expect(result.success).toBe(false);
      expect(
        result.errors.some(
          (e) =>
            e.field === "dietaryPreference" &&
            e.code === ErrorCodes.INVALID_DIETARY
        )
      ).toBe(true);
    });

    it("should accept all valid dietary preferences", () => {
      const validDiets = [
        "omnivore",
        "vegetarian",
        "vegan",
        "pescatarian",
        "other",
      ];

      for (const dietaryPreference of validDiets) {
        const input = { ...validInput, dietaryPreference };
        const result = validateApplicationInput(input, testConfig);
        expect(result.success).toBe(true);
      }
    });
  });

  describe("allergy notes", () => {
    it("should include allergyNotes when allergyFlag is true", () => {
      const input = {
        ...validInput,
        allergyFlag: true,
        allergyNotes: "Peanut allergy",
      };
      const result = validateApplicationInput(input, testConfig);

      expect(result.success).toBe(true);
      expect(result.payload?.allergyFlag).toBe(true);
      expect(result.payload?.allergyNotes).toBe("Peanut allergy");
    });

    it("should allow empty allergyNotes when allergyFlag is false", () => {
      const input = {
        ...validInput,
        allergyFlag: false,
        allergyNotes: undefined,
      };
      const result = validateApplicationInput(input, testConfig);

      expect(result.success).toBe(true);
      expect(result.payload?.allergyFlag).toBe(false);
    });
  });
});

describe("normalizePhone", () => {
  it("should remove spaces and dashes", () => {
    expect(normalizePhone("+1 415 555 1234")).toBe("+14155551234");
    expect(normalizePhone("+1-415-555-1234")).toBe("+14155551234");
  });

  it("should remove parentheses", () => {
    expect(normalizePhone("+1 (415) 555-1234")).toBe("+14155551234");
  });

  it("should preserve the plus sign", () => {
    expect(normalizePhone("+14155551234")).toBe("+14155551234");
  });
});

describe("isValidE164Phone", () => {
  it("should return true for valid E.164 numbers", () => {
    expect(isValidE164Phone("+14155551234")).toBe(true);
    expect(isValidE164Phone("+442071234567")).toBe(true);
    expect(isValidE164Phone("+5511987654321")).toBe(true);
  });

  it("should return false for numbers without plus sign", () => {
    expect(isValidE164Phone("14155551234")).toBe(false);
  });

  it("should return false for numbers that are too short", () => {
    expect(isValidE164Phone("+123")).toBe(false);
  });

  it("should return false for numbers that are too long", () => {
    expect(isValidE164Phone("+12345678901234567")).toBe(false);
  });

  it("should return false for numbers with non-numeric characters", () => {
    expect(isValidE164Phone("+1415555abcd")).toBe(false);
  });
});
