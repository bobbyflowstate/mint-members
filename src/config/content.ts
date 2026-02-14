import dayjs from "dayjs";

/**
 * Configuration type from Convex config query
 * 
 * SINGLE SOURCE OF TRUTH: All config values come from convex/config.ts
 * Edit CONFIG_DEFAULTS there to change values.
 */
export interface AppConfig {
  campName: string;
  year: string;
  burningManStartDate: string;
  burningManEndDate: string;
  earliestArrival: string;
  latestDeparture: string;
  departureCutoff: string;
  reservationFeeCents: string;
  maxMembers: string;
  applicationsOpen: string;
  paymentsEnabled: string;
  [key: string]: string;
}

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
  
  // Camp operational dates (for date picker constraints)
  campDates: string;
  earliestArrival: string;
  latestDeparture: string;
  
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
 * Derive landing page content from Convex configuration
 * Config comes from useQuery(api.config.getConfig)
 */
export function getLandingContent(config: AppConfig): LandingContent {
  const reservationFeeCents = parseInt(config.reservationFeeCents, 10);
  const year = config.year || "2025";
  
  return {
    campName: config.campName,
    heroTitle: `Join ${config.campName} at Burning Man ${year}`,
    heroSubtitle: "Reserve your spot at DeMentha and join our minty oasis in Black Rock City.",
    
    // Burning Man dates
    burningManDates: formatDateRange(
      config.burningManStartDate,
      config.burningManEndDate
    ),
    burningManStartDate: config.burningManStartDate,
    burningManEndDate: config.burningManEndDate,
    
    // Camp operational dates
    campDates: formatDateRange(
      config.earliestArrival,
      config.latestDeparture
    ),
    earliestArrival: config.earliestArrival,
    latestDeparture: config.latestDeparture,
    
    // Departure cutoff
    departureCutoff: config.departureCutoff,
    departureCutoffFormatted: formatDate(config.departureCutoff),
    
    // Fees
    reservationFeeCents,
    reservationFeeFormatted: formatCurrency(reservationFeeCents),
    
    // Expectations for members
    expectations: [
      {
        title: "Non Refundable Reservation Fee",
        description: `A ${formatCurrency(reservationFeeCents)} reservation fee is required to secure your spot. This is Non Refundable and goes toward camp infrastructure.`,
      },
      {
        title: "WhatsApp Required",
        description: "All camp communication happens via WhatsApp. You must have WhatsApp installed and provide a valid phone number.",
      },
      {
        title: "Departure Commitment",
        description: `Members are expected to stay through ${formatDate(config.departureCutoff)}. Early departure requests require ops approval.`,
      },
    ],
  };
}

/**
 * Check if a departure date requires ops review
 */
export function requiresOpsReview(
  departureDate: string,
  departureCutoff: string
): boolean {
  const departure = dayjs(departureDate);
  const cutoff = dayjs(departureCutoff);
  
  return departure.isBefore(cutoff, "day");
}
