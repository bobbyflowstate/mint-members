/**
 * Camp Configuration
 * 
 * Edit this file to customize your camp's reservation system.
 * All dates are in YYYY-MM-DD format.
 */

export const campConfig = {
  // ═══════════════════════════════════════════════════════════════════════════
  // CAMP IDENTITY
  // ═══════════════════════════════════════════════════════════════════════════
  
  /** Camp name displayed throughout the site */
  campName: "DeMentha",
  
  /** Year of the event */
  year: 2025,

  // ═══════════════════════════════════════════════════════════════════════════
  // BURNING MAN DATES (official event dates)
  // ═══════════════════════════════════════════════════════════════════════════
  
  /** Official Burning Man start date */
  burningManStartDate: "2025-08-24",
  
  /** Official Burning Man end date (Exodus begins) */
  burningManEndDate: "2025-09-01",

  // ═══════════════════════════════════════════════════════════════════════════
  // CAMP DATES (when your camp is operational)
  // ═══════════════════════════════════════════════════════════════════════════
  
  /** Earliest date members can arrive (early build crew may arrive earlier) */
  earliestArrival: "2025-08-22",
  
  /** Latest date members should depart (camp teardown deadline) */
  latestDeparture: "2025-09-02",
  
  /** 
   * Departure cutoff date for full members.
   * Departing before this date requires ops approval.
   */
  departureCutoff: "2025-09-01",

  // ═══════════════════════════════════════════════════════════════════════════
  // FEES
  // ═══════════════════════════════════════════════════════════════════════════
  
  /** 
   * Reservation fee in cents (e.g., 35000 = $350.00)
   * This is collected via Stripe during the application process.
   */
  reservationFeeCents: 35000,

  // ═══════════════════════════════════════════════════════════════════════════
  // CAPACITY (optional - for future use)
  // ═══════════════════════════════════════════════════════════════════════════
  
  /** Maximum number of camp members (0 = unlimited) */
  maxMembers: 0,
  
  /** Whether new applications are currently accepted */
  applicationsOpen: true,

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTACT & LINKS (optional)
  // ═══════════════════════════════════════════════════════════════════════════
  
  /** Contact email for camp inquiries */
  contactEmail: "",
  
  /** WhatsApp group invite link (shown after successful registration) */
  whatsAppLink: "",
} as const;

/** Type for the camp configuration */
export type CampConfig = typeof campConfig;
