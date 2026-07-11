import dayjs from "dayjs";
import { ArrivalDepartureTime } from "../applications/types";

/**
 * Window-aware early-departure rule.
 *
 * Everyone is expected to stay through the departure cutoff day at 6:00 PM.
 * A departure counts as early when the date is before the cutoff day, or on
 * the cutoff day itself in the morning (12:01 am to 11.00 am) or day
 * (11.01 am to 6.00 pm) window. The evening window on the cutoff day is
 * not early.
 *
 * This refines requiresOpsReview (src/config/content.ts), which only
 * compares dates — the spec confirmed the 11.01 am to 6.00 pm window on the
 * cutoff day counts as early.
 */
export function isEarlyDeparture(
  departureDate: string,
  departureTime: ArrivalDepartureTime | undefined,
  departureCutoff: string
): boolean {
  const departure = dayjs(departureDate);
  const cutoff = dayjs(departureCutoff);

  if (departure.isBefore(cutoff, "day")) {
    return true;
  }

  if (!departure.isSame(cutoff, "day")) {
    return false;
  }

  return (
    departureTime === "12:01 am to 11.00 am" ||
    departureTime === "11.01 am to 6.00 pm"
  );
}
