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
  arrivalTime: "after 10 am",
  departure: "2025-09-01",
  departureTime: "after 10 am",
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

  describe("arrival/departure time validation", () => {
    it("should reject missing arrival time", () => {
      const input = {
        ...validInput,
        arrivalTime: undefined as unknown as typeof validInput.arrivalTime,
      };
      const result = validateApplicationInput(input, testConfig);

      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.field === "arrivalTime")).toBe(true);
    });

    it("should reject missing departure time", () => {
      const input = {
        ...validInput,
        departureTime: undefined as unknown as typeof validInput.departureTime,
      };
      const result = validateApplicationInput(input, testConfig);

      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.field === "departureTime")).toBe(true);
    });

    it("should reject invalid arrival time", () => {
      const input = {
        ...validInput,
        arrivalTime: "invalid time" as typeof validInput.arrivalTime,
      };
      const result = validateApplicationInput(input, testConfig);

      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.field === "arrivalTime")).toBe(true);
    });

    it("should accept all valid arrival/departure times", () => {
      const validTimes = ["after 10 am", "after 2 pm", "after 9 pm"] as const;

      for (const time of validTimes) {
        const input = {
          ...validInput,
          arrivalTime: time,
          departureTime: time,
        };
        const result = validateApplicationInput(input, testConfig);
        expect(result.success).toBe(true);
      }
    });
  });

  describe("same day arrival/departure edge case", () => {
    it("should reject when departure equals arrival (same day)", () => {
      const input = {
        ...validInput,
        arrival: "2025-08-25",
        departure: "2025-08-25",
      };
      const result = validateApplicationInput(input, testConfig);

      expect(result.success).toBe(false);
      expect(
        result.errors.some(
          (e) => e.code === ErrorCodes.DEPARTURE_BEFORE_ARRIVAL
        )
      ).toBe(true);
    });

    it("should accept departure one day after arrival", () => {
      const input = {
        ...validInput,
        arrival: "2025-08-25",
        departure: "2025-08-26",
      };
      const result = validateApplicationInput(input, testConfig);

      // Should fail only if it's before cutoff, not because of date order
      const hasDateOrderError = result.errors.some(
        (e) => e.code === ErrorCodes.DEPARTURE_BEFORE_ARRIVAL
      );
      expect(hasDateOrderError).toBe(false);
    });
  });

  describe("whitespace handling", () => {
    it("should trim leading and trailing whitespace from all fields", () => {
      const input = {
        ...validInput,
        firstName: "  John  ",
        lastName: "  Doe  ",
        email: "  john@example.com  ",
        phone: "  +14155551234  ",
        arrival: "  2025-08-22  ",
        departure: "  2025-09-01  ",
        dietaryPreference: "  omnivore  ",
        allergyNotes: "  Peanuts  ",
        allergyFlag: true,
      };
      const result = validateApplicationInput(input, testConfig);

      expect(result.success).toBe(true);
      expect(result.payload?.firstName).toBe("John");
      expect(result.payload?.lastName).toBe("Doe");
      expect(result.payload?.email).toBe("john@example.com");
      expect(result.payload?.allergyNotes).toBe("Peanuts");
    });
  });

  describe("email case handling", () => {
    it("should lowercase email addresses", () => {
      const input = {
        ...validInput,
        email: "JOHN@EXAMPLE.COM",
      };
      const result = validateApplicationInput(input, testConfig);

      expect(result.success).toBe(true);
      expect(result.payload?.email).toBe("john@example.com");
    });

    it("should lowercase mixed case emails", () => {
      const input = {
        ...validInput,
        email: "John.Doe@Example.COM",
      };
      const result = validateApplicationInput(input, testConfig);

      expect(result.success).toBe(true);
      expect(result.payload?.email).toBe("john.doe@example.com");
    });
  });

  describe("dietary preference case handling", () => {
    it("should lowercase dietary preferences", () => {
      const input = {
        ...validInput,
        dietaryPreference: "VEGETARIAN",
      };
      const result = validateApplicationInput(input, testConfig);

      expect(result.success).toBe(true);
      expect(result.payload?.dietaryPreference).toBe("vegetarian");
    });

    it("should handle mixed case dietary preferences", () => {
      const input = {
        ...validInput,
        dietaryPreference: "VeGaN",
      };
      const result = validateApplicationInput(input, testConfig);

      expect(result.success).toBe(true);
      expect(result.payload?.dietaryPreference).toBe("vegan");
    });
  });

  describe("null/undefined handling", () => {
    it("should handle null firstName gracefully", () => {
      const input = {
        ...validInput,
        firstName: null as unknown as string,
      };
      const result = validateApplicationInput(input, testConfig);

      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.field === "firstName")).toBe(true);
    });

    it("should handle undefined email gracefully", () => {
      const input = {
        ...validInput,
        email: undefined as unknown as string,
      };
      const result = validateApplicationInput(input, testConfig);

      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.field === "email")).toBe(true);
    });
  });

  describe("multiple validation errors", () => {
    it("should collect all validation errors at once", () => {
      const input = {
        ...validInput,
        firstName: "",
        lastName: "",
        email: "invalid",
        phone: "invalid",
      };
      const result = validateApplicationInput(input, testConfig);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(4);
      expect(result.errors.some((e) => e.field === "firstName")).toBe(true);
      expect(result.errors.some((e) => e.field === "lastName")).toBe(true);
      expect(result.errors.some((e) => e.field === "email")).toBe(true);
      expect(result.errors.some((e) => e.field === "phone")).toBe(true);
    });
  });

  describe("early departure edge cases", () => {
    it("should set requiresOpsReview but still succeed for early departure", () => {
      const input = {
        ...validInput,
        departure: "2025-08-30", // Before cutoff
      };
      const result = validateApplicationInput(input, testConfig);

      expect(result.success).toBe(true);
      expect(result.requiresOpsReview).toBe(true);
      expect(result.payload).toBeDefined();
    });

    it("should include early departure in errors but not block submission", () => {
      const input = {
        ...validInput,
        departure: "2025-08-30",
      };
      const result = validateApplicationInput(input, testConfig);

      const earlyDepartureError = result.errors.find(
        (e) => e.code === ErrorCodes.EARLY_DEPARTURE
      );
      expect(earlyDepartureError).toBeDefined();
      expect(result.success).toBe(true); // Still succeeds
    });

    it("should handle departure exactly on cutoff", () => {
      const input = {
        ...validInput,
        departure: "2025-09-01", // Exactly on cutoff
      };
      const result = validateApplicationInput(input, testConfig);

      expect(result.success).toBe(true);
      expect(result.requiresOpsReview).toBe(false);
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
