import { describe, it, expect } from "vitest";
import {
  getLandingContent,
  requiresOpsReview,
  DEFAULT_CONFIG,
  type AppConfig,
} from "./content";

describe("getLandingContent", () => {
  describe("with default config", () => {
    it("should return content with default values when no config provided", () => {
      const content = getLandingContent();
      
      expect(content.campName).toBe("DeMentha");
      expect(content.heroTitle).toContain("DeMentha");
      expect(content.heroTitle).toContain("Burning Man 2025");
    });

    it("should format reservation fee correctly", () => {
      const content = getLandingContent();
      
      expect(content.reservationFeeCents).toBe(35000);
      expect(content.reservationFeeFormatted).toBe("$350");
    });

    it("should format Burning Man dates correctly", () => {
      const content = getLandingContent();
      
      expect(content.burningManDates).toBe("August 24 - September 1, 2025");
    });

    it("should format camp dates correctly", () => {
      const content = getLandingContent();
      
      expect(content.campDates).toBe("August 22 - September 2, 2025");
      expect(content.earliestArrival).toBe("2025-08-22");
      expect(content.latestDeparture).toBe("2025-09-02");
    });

    it("should format departure cutoff correctly", () => {
      const content = getLandingContent();
      
      expect(content.departureCutoff).toBe("2025-09-01");
      expect(content.departureCutoffFormatted).toBe("September 1, 2025");
    });

    it("should include expectations array", () => {
      const content = getLandingContent();
      
      expect(content.expectations).toHaveLength(3);
      expect(content.expectations[0].title).toBe("Reservation Fee");
      expect(content.expectations[1].title).toBe("WhatsApp Required");
      expect(content.expectations[2].title).toBe("Departure Commitment");
    });
  });

  describe("with custom config overrides", () => {
    it("should use provided config values over defaults", () => {
      const customConfig: Partial<AppConfig> = {
        campName: "Test Camp",
        reservationFeeCents: "50000",
      };
      
      const content = getLandingContent(customConfig);
      
      expect(content.campName).toBe("Test Camp");
      expect(content.heroTitle).toContain("Test Camp");
      expect(content.reservationFeeCents).toBe(50000);
      expect(content.reservationFeeFormatted).toBe("$500");
    });

    it("should use custom dates when provided", () => {
      const customConfig: Partial<AppConfig> = {
        burningManStartDate: "2026-08-30",
        burningManEndDate: "2026-09-07",
        departureCutoff: "2026-09-07",
      };
      
      const content = getLandingContent(customConfig);
      
      expect(content.burningManDates).toBe("August 30 - September 7, 2026");
      expect(content.departureCutoff).toBe("2026-09-07");
    });

    it("should merge partial config with defaults", () => {
      const customConfig: Partial<AppConfig> = {
        reservationFeeCents: "25000",
      };
      
      const content = getLandingContent(customConfig);
      
      // Custom value used
      expect(content.reservationFeeCents).toBe(25000);
      // Defaults still present
      expect(content.campName).toBe("DeMentha");
      expect(content.departureCutoff).toBe("2025-09-01");
    });
  });

  describe("expectations content", () => {
    it("should include reservation fee amount in expectations", () => {
      const content = getLandingContent({ reservationFeeCents: "40000" });
      
      const reservationExpectation = content.expectations.find(
        (e) => e.title === "Reservation Fee"
      );
      
      expect(reservationExpectation?.description).toContain("$400");
    });

    it("should include departure cutoff date in expectations", () => {
      const content = getLandingContent({ departureCutoff: "2025-08-31" });
      
      const departureExpectation = content.expectations.find(
        (e) => e.title === "Departure Commitment"
      );
      
      expect(departureExpectation?.description).toContain("August 31, 2025");
    });
  });
});

describe("requiresOpsReview", () => {
  it("should return true when departure is before cutoff", () => {
    const result = requiresOpsReview("2025-08-30", {
      departureCutoff: "2025-09-01",
    });
    
    expect(result).toBe(true);
  });

  it("should return false when departure is on cutoff date", () => {
    const result = requiresOpsReview("2025-09-01", {
      departureCutoff: "2025-09-01",
    });
    
    expect(result).toBe(false);
  });

  it("should return false when departure is after cutoff", () => {
    const result = requiresOpsReview("2025-09-02", {
      departureCutoff: "2025-09-01",
    });
    
    expect(result).toBe(false);
  });

  it("should use default cutoff when no config provided", () => {
    // Default cutoff is 2025-09-01
    expect(requiresOpsReview("2025-08-30")).toBe(true);
    expect(requiresOpsReview("2025-09-01")).toBe(false);
    expect(requiresOpsReview("2025-09-02")).toBe(false);
  });
});

describe("DEFAULT_CONFIG", () => {
  it("should have all required fields", () => {
    expect(DEFAULT_CONFIG).toHaveProperty("burningManStartDate");
    expect(DEFAULT_CONFIG).toHaveProperty("burningManEndDate");
    expect(DEFAULT_CONFIG).toHaveProperty("earliestArrival");
    expect(DEFAULT_CONFIG).toHaveProperty("latestDeparture");
    expect(DEFAULT_CONFIG).toHaveProperty("departureCutoff");
    expect(DEFAULT_CONFIG).toHaveProperty("reservationFeeCents");
    expect(DEFAULT_CONFIG).toHaveProperty("campName");
  });

  it("should have valid date formats", () => {
    // ISO date format check (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    
    expect(DEFAULT_CONFIG.burningManStartDate).toMatch(dateRegex);
    expect(DEFAULT_CONFIG.burningManEndDate).toMatch(dateRegex);
    expect(DEFAULT_CONFIG.earliestArrival).toMatch(dateRegex);
    expect(DEFAULT_CONFIG.latestDeparture).toMatch(dateRegex);
    expect(DEFAULT_CONFIG.departureCutoff).toMatch(dateRegex);
  });

  it("should have valid reservation fee (numeric string)", () => {
    const fee = parseInt(DEFAULT_CONFIG.reservationFeeCents, 10);
    expect(fee).toBeGreaterThan(0);
    expect(Number.isInteger(fee)).toBe(true);
  });
});
