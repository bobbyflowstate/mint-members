import { describe, it, expect } from "vitest";
import {
  getLandingContent,
  requiresOpsReview,
  type AppConfig,
} from "./content";

// Mock config that matches Convex CONFIG_DEFAULTS
const mockConfig: AppConfig = {
  campName: "DeMentha",
  year: "2025",
  burningManStartDate: "2025-08-24",
  burningManEndDate: "2025-09-01",
  earliestArrival: "2025-08-22",
  latestDeparture: "2025-09-02",
  departureCutoff: "2025-09-01",
  reservationFeeCents: "10000",
  maxMembers: "0",
  applicationsOpen: "true",
};

// Helper to create config with custom values
function createConfig(overrides: Partial<AppConfig>): AppConfig {
  return { ...mockConfig, ...overrides };
}

describe("getLandingContent", () => {
  describe("with standard config", () => {
    it("should return content with config values", () => {
      const content = getLandingContent(mockConfig);
      
      expect(content.campName).toBe("DeMentha");
      expect(content.heroTitle).toContain("DeMentha");
      expect(content.heroTitle).toContain("Burning Man 2025");
    });

    it("should format reservation fee correctly", () => {
      const content = getLandingContent(mockConfig);
      
      expect(content.reservationFeeCents).toBe(10000);
      expect(content.reservationFeeFormatted).toBe("$100");
    });

    it("should format Burning Man dates correctly", () => {
      const content = getLandingContent(mockConfig);
      
      expect(content.burningManDates).toBe("August 24 - September 1, 2025");
    });

    it("should format camp dates correctly", () => {
      const content = getLandingContent(mockConfig);
      
      expect(content.campDates).toBe("August 22 - September 2, 2025");
      expect(content.earliestArrival).toBe("2025-08-22");
      expect(content.latestDeparture).toBe("2025-09-02");
    });

    it("should format departure cutoff correctly", () => {
      const content = getLandingContent(mockConfig);
      
      expect(content.departureCutoff).toBe("2025-09-01");
      expect(content.departureCutoffFormatted).toBe("September 1, 2025");
    });

    it("should include expectations array", () => {
      const content = getLandingContent(mockConfig);
      
      expect(content.expectations).toHaveLength(3);
      expect(content.expectations[0].title).toBe("Non Refundable Reservation Fee");
      expect(content.expectations[1].title).toBe("WhatsApp Required");
      expect(content.expectations[2].title).toBe("Departure Commitment");
    });
  });

  describe("with custom config values", () => {
    it("should use provided config values", () => {
      const customConfig: AppConfig = {
        ...mockConfig,
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
      const customConfig: AppConfig = {
        ...mockConfig,
        burningManStartDate: "2026-08-30",
        burningManEndDate: "2026-09-07",
        departureCutoff: "2026-09-07",
        year: "2026",
      };
      
      const content = getLandingContent(customConfig);
      
      expect(content.burningManDates).toBe("August 30 - September 7, 2026");
      expect(content.departureCutoff).toBe("2026-09-07");
    });
  });

  describe("expectations content", () => {
    it("should not fall back to legacy hardcoded fee copy", () => {
      const content = getLandingContent(mockConfig);

      expect(content.reservationFeeFormatted).toBe("$100");
      expect(content.reservationFeeFormatted).not.toBe("$150");

      const reservationExpectation = content.expectations.find(
        (e) => e.title === "Non Refundable Reservation Fee"
      );
      expect(reservationExpectation?.description).toContain("$100");
      expect(reservationExpectation?.description).not.toContain("$150");
    });

    it("should include reservation fee amount in expectations", () => {
      const customConfig: AppConfig = {
        ...mockConfig,
        reservationFeeCents: "40000",
      };
      const content = getLandingContent(customConfig);
      
      const reservationExpectation = content.expectations.find(
        (e) => e.title === "Non Refundable Reservation Fee"
      );
      
      expect(reservationExpectation?.description).toContain("$400");
    });

    it("should include departure cutoff date in expectations", () => {
      const customConfig: AppConfig = {
        ...mockConfig,
        departureCutoff: "2025-08-31",
      };
      const content = getLandingContent(customConfig);
      
      const departureExpectation = content.expectations.find(
        (e) => e.title === "Departure Commitment"
      );
      
      expect(departureExpectation?.description).toContain("August 31, 2025");
    });
  });
});

describe("requiresOpsReview", () => {
  it("should return true when departure is before cutoff", () => {
    const result = requiresOpsReview(
      "2025-08-30",
      "6.01 pm to 12.00 am",
      "2025-09-01"
    );
    expect(result).toBe(true);
  });

  it("should return true when departure is on cutoff date but before last time slot", () => {
    const result = requiresOpsReview(
      "2025-09-01",
      "11.01 am to 6.00 pm",
      "2025-09-01"
    );
    expect(result).toBe(true);
  });

  it("should return false when departure is on cutoff date in the last time slot", () => {
    const result = requiresOpsReview(
      "2025-09-01",
      "6.01 pm to 12.00 am",
      "2025-09-01"
    );
    expect(result).toBe(false);
  });

  it("should return false when departure is after cutoff", () => {
    const result = requiresOpsReview(
      "2025-09-02",
      "12:01 am to 11.00 am",
      "2025-09-01"
    );
    expect(result).toBe(false);
  });

  it("should handle year boundaries correctly", () => {
    // Departure in previous year should require review
    const result = requiresOpsReview(
      "2024-12-31",
      "6.01 pm to 12.00 am",
      "2025-01-01"
    );
    expect(result).toBe(true);
  });

  it("should handle one day before cutoff", () => {
    const result = requiresOpsReview(
      "2025-08-31",
      "12:01 am to 11.00 am",
      "2025-09-01"
    );
    expect(result).toBe(true);
  });
});

describe("Date formatting edge cases", () => {
  describe("same month date ranges", () => {
    it("should format same month range correctly", () => {
      const config = createConfig({
        burningManStartDate: "2025-08-24",
        burningManEndDate: "2025-08-31",
      });
      const content = getLandingContent(config);

      // Same month should show "August 24 - 31, 2025"
      expect(content.burningManDates).toBe("August 24 - 31, 2025");
    });
  });

  describe("different month date ranges", () => {
    it("should format cross-month range correctly", () => {
      const config = createConfig({
        burningManStartDate: "2025-08-24",
        burningManEndDate: "2025-09-01",
      });
      const content = getLandingContent(config);

      expect(content.burningManDates).toBe("August 24 - September 1, 2025");
    });
  });

  describe("cross-year date ranges", () => {
    it("should format cross-year range correctly", () => {
      const config = createConfig({
        burningManStartDate: "2025-12-28",
        burningManEndDate: "2026-01-02",
        year: "2025-2026",
      });
      const content = getLandingContent(config);

      expect(content.burningManDates).toBe("December 28, 2025 - January 2, 2026");
    });
  });
});

describe("Currency formatting edge cases", () => {
  it("should format small amounts correctly", () => {
    const config = createConfig({ reservationFeeCents: "100" });
    const content = getLandingContent(config);

    expect(content.reservationFeeFormatted).toBe("$1");
    expect(content.reservationFeeCents).toBe(100);
  });

  it("should format zero correctly", () => {
    const config = createConfig({ reservationFeeCents: "0" });
    const content = getLandingContent(config);

    expect(content.reservationFeeFormatted).toBe("$0");
    expect(content.reservationFeeCents).toBe(0);
  });

  it("should format large amounts correctly", () => {
    const config = createConfig({ reservationFeeCents: "100000" });
    const content = getLandingContent(config);

    expect(content.reservationFeeFormatted).toBe("$1,000");
    expect(content.reservationFeeCents).toBe(100000);
  });

  it("should handle amounts that are not multiples of 100", () => {
    const config = createConfig({ reservationFeeCents: "15099" });
    const content = getLandingContent(config);

    // Should round to nearest dollar
    expect(content.reservationFeeCents).toBe(15099);
  });
});

describe("Camp name variations", () => {
  it("should handle camp names with special characters", () => {
    const config = createConfig({ campName: "Camp O'Brien & Friends" });
    const content = getLandingContent(config);

    expect(content.campName).toBe("Camp O'Brien & Friends");
    expect(content.heroTitle).toContain("Camp O'Brien & Friends");
  });

  it("should handle empty camp name gracefully", () => {
    const config = createConfig({ campName: "" });
    const content = getLandingContent(config);

    expect(content.campName).toBe("");
    expect(content.heroTitle).toContain("Burning Man");
  });

  it("should handle long camp names", () => {
    const longName = "The Very Long Camp Name That Goes On And On";
    const config = createConfig({ campName: longName });
    const content = getLandingContent(config);

    expect(content.campName).toBe(longName);
    expect(content.heroTitle).toContain(longName);
  });
});

describe("Year handling", () => {
  it("should use config year in hero title", () => {
    const config = createConfig({ year: "2030" });
    const content = getLandingContent(config);

    expect(content.heroTitle).toContain("2030");
  });

  it("should default to 2025 if year is missing", () => {
    const config = createConfig({ year: "" });
    const content = getLandingContent(config);

    expect(content.heroTitle).toContain("2025");
  });
});

describe("Expectations array", () => {
  it("should always have exactly 3 expectations", () => {
    const content = getLandingContent(mockConfig);

    expect(content.expectations).toHaveLength(3);
  });

  it("should have title and description for each expectation", () => {
    const content = getLandingContent(mockConfig);

    for (const expectation of content.expectations) {
      expect(expectation.title).toBeDefined();
      expect(typeof expectation.title).toBe("string");
      expect(expectation.title.length).toBeGreaterThan(0);

      expect(expectation.description).toBeDefined();
      expect(typeof expectation.description).toBe("string");
      expect(expectation.description.length).toBeGreaterThan(0);
    }
  });

  it("should update fee in expectations when config changes", () => {
    const config = createConfig({ reservationFeeCents: "50000" });
    const content = getLandingContent(config);

    const feeExpectation = content.expectations.find(
      (e) => e.title === "Non Refundable Reservation Fee"
    );
    expect(feeExpectation?.description).toContain("$500");
  });
});

describe("Date string preservation", () => {
  it("should preserve original ISO date strings", () => {
    const config = createConfig({
      earliestArrival: "2025-08-22",
      latestDeparture: "2025-09-02",
      departureCutoff: "2025-09-01",
    });
    const content = getLandingContent(config);

    expect(content.earliestArrival).toBe("2025-08-22");
    expect(content.latestDeparture).toBe("2025-09-02");
    expect(content.departureCutoff).toBe("2025-09-01");
  });
});
