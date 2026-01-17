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
  reservationFeeCents: "15000",
  maxMembers: "0",
  applicationsOpen: "true",
};

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
      
      expect(content.reservationFeeCents).toBe(15000);
      expect(content.reservationFeeFormatted).toBe("$150");
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
      expect(content.expectations[0].title).toBe("Reservation Fee");
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
    it("should include reservation fee amount in expectations", () => {
      const customConfig: AppConfig = {
        ...mockConfig,
        reservationFeeCents: "40000",
      };
      const content = getLandingContent(customConfig);
      
      const reservationExpectation = content.expectations.find(
        (e) => e.title === "Reservation Fee"
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
    const result = requiresOpsReview("2025-08-30", "2025-09-01");
    expect(result).toBe(true);
  });

  it("should return false when departure is on cutoff date", () => {
    const result = requiresOpsReview("2025-09-01", "2025-09-01");
    expect(result).toBe(false);
  });

  it("should return false when departure is after cutoff", () => {
    const result = requiresOpsReview("2025-09-02", "2025-09-01");
    expect(result).toBe(false);
  });
});
