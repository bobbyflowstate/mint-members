import { internalMutation } from "./_generated/server";

/**
 * Migration: Update arrival/departure time format
 * Maps old format to new format:
 * - "after 10 am" -> "12:01 am to 11.00 am"
 * - "after 2 pm" -> "11.01 am to 6.00 pm"
 * - "after 9 pm" -> "6.01 pm to 12.00 am"
 */
export const migrateTimeFormat = internalMutation({
  args: {},
  handler: async (ctx) => {
    const timeMapping: Record<string, string> = {
      "after 10 am": "12:01 am to 11.00 am",
      "after 2 pm": "11.01 am to 6.00 pm",
      "after 9 pm": "6.01 pm to 12.00 am",
    };

    // Get all applications
    const applications = await ctx.db.query("applications").collect();

    let updatedCount = 0;

    for (const app of applications) {
      let needsUpdate = false;
      const updates: Partial<{
        arrivalTime: "12:01 am to 11.00 am" | "11.01 am to 6.00 pm" | "6.01 pm to 12.00 am";
        departureTime: "12:01 am to 11.00 am" | "11.01 am to 6.00 pm" | "6.01 pm to 12.00 am";
        updatedAt: number;
      }> = {
        updatedAt: Date.now(),
      };

      // Check if arrivalTime needs migration
      if (app.arrivalTime in timeMapping) {
        updates.arrivalTime = timeMapping[app.arrivalTime] as "12:01 am to 11.00 am" | "11.01 am to 6.00 pm" | "6.01 pm to 12.00 am";
        needsUpdate = true;
      }

      // Check if departureTime needs migration
      if (app.departureTime in timeMapping) {
        updates.departureTime = timeMapping[app.departureTime] as "12:01 am to 11.00 am" | "11.01 am to 6.00 pm" | "6.01 pm to 12.00 am";
        needsUpdate = true;
      }

      // Update the record if needed
      if (needsUpdate) {
        await ctx.db.patch(app._id, updates);
        updatedCount++;
        console.log(`Updated application ${app._id}: ${app.arrivalTime} -> ${updates.arrivalTime}, ${app.departureTime} -> ${updates.departureTime}`);
      }
    }

    return {
      success: true,
      totalApplications: applications.length,
      updatedCount,
      message: `Successfully migrated ${updatedCount} out of ${applications.length} applications`,
    };
  },
});
