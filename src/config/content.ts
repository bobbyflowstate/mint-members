import dayjs from "dayjs";

/**
 * Configuration type from Convex config query
 */
export interface AppConfig {
  burningManStartDate: string;
  burningManEndDate: string;
  dementhaStartDate: string;
  dementhaEndDate: string;
  departureCutoff: string;
  reservationFeeCents: string;
  campName: string;
  [key: string]: string;
}

/**
 * Default configuration values (mirrors convex/config.ts)
 * Used when config hasn't loaded yet
 */
export const DEFAULT_CONFIG: AppConfig = {
  burningManStartDate: "2025-08-24",
  burningManEndDate: "2025-09-01",
  dementhaStartDate: "2025-08-22",
  dementhaEndDate: "2025-09-01",
  departureCutoff: "2025-09-01",
  reservationFeeCents: "35000",
  campName: "DeMentha",
};

/**
 * Formatted content for the landing page
 */
export interface LandingContent {
  campName: string;
  heroTitle: string;
  heroSubtitle: string;
  
  // Burning Man dates
  burningManDates: string;
  burningManStartDate: string;
  burningManEndDate: string;
  
  // DeMentha camp dates
  dementhaDates: string;
  dementhaStartDate: string;
  dementhaEndDate: string;
  
  // Departure cutoff info
  departureCutoff: string;
  departureCutoffFormatted: string;
  
  // Dues/fees
  reservationFeeCents: number;
  reservationFeeFormatted: string;
  
  // Expectations copy
  expectations: {
    title: string;
    description: string;
  }[];
}

/**
 * Format a date string for display
 */
function formatDate(dateStr: string): string {
  return dayjs(dateStr).format("MMMM D, YYYY");
}

/**
 * Format a date range for display
 */
function formatDateRange(startStr: string, endStr: string): string {
  const start = dayjs(startStr);
  const end = dayjs(endStr);
  
  // If same month, format as "August 24 - September 1, 2025"
  if (start.year() === end.year()) {
    if (start.month() === end.month()) {
      return `${start.format("MMMM D")} - ${end.format("D, YYYY")}`;
    }
    return `${start.format("MMMM D")} - ${end.format("MMMM D, YYYY")}`;
  }
  
  return `${start.format("MMMM D, YYYY")} - ${end.format("MMMM D, YYYY")}`;
}

/**
 * Format cents as currency string
 */
function formatCurrency(cents: number): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(dollars);
}

/**
 * Derive landing page content from configuration
 * Merges provided config with defaults for any missing values
 */
export function getLandingContent(config?: Partial<AppConfig>): LandingContent {
  // Merge with defaults
  const mergedConfig: AppConfig = {
    ...DEFAULT_CONFIG,
    ...config,
  };
  
  const reservationFeeCents = parseInt(mergedConfig.reservationFeeCents, 10);
  
  return {
    campName: mergedConfig.campName,
    heroTitle: `Join ${mergedConfig.campName} at Burning Man 2025`,
    heroSubtitle: "Reserve your spot in our community and be part of an unforgettable experience in Black Rock City.",
    
    // Burning Man dates
    burningManDates: formatDateRange(
      mergedConfig.burningManStartDate,
      mergedConfig.burningManEndDate
    ),
    burningManStartDate: mergedConfig.burningManStartDate,
    burningManEndDate: mergedConfig.burningManEndDate,
    
    // DeMentha dates
    dementhaDates: formatDateRange(
      mergedConfig.dementhaStartDate,
      mergedConfig.dementhaEndDate
    ),
    dementhaStartDate: mergedConfig.dementhaStartDate,
    dementhaEndDate: mergedConfig.dementhaEndDate,
    
    // Departure cutoff
    departureCutoff: mergedConfig.departureCutoff,
    departureCutoffFormatted: formatDate(mergedConfig.departureCutoff),
    
    // Fees
    reservationFeeCents,
    reservationFeeFormatted: formatCurrency(reservationFeeCents),
    
    // Expectations for members
    expectations: [
      {
        title: "Reservation Fee",
        description: `A ${formatCurrency(reservationFeeCents)} reservation fee is required to secure your spot. This is non-refundable and goes toward camp infrastructure.`,
      },
      {
        title: "WhatsApp Required",
        description: "All camp communication happens via WhatsApp. You must have WhatsApp installed and provide a valid phone number.",
      },
      {
        title: "Departure Commitment",
        description: `Members are expected to stay through ${formatDate(mergedConfig.departureCutoff)}. Early departure requests require ops approval.`,
      },
    ],
  };
}

/**
 * Check if a departure date requires ops review
 */
export function requiresOpsReview(
  departureDate: string,
  config?: Partial<AppConfig>
): boolean {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const departure = dayjs(departureDate);
  const cutoff = dayjs(mergedConfig.departureCutoff);
  
  return departure.isBefore(cutoff, "day");
}
