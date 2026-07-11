import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  getActiveApplication,
  listActiveProfiles,
  requireActiveApplication,
  vehicleTypeValidator,
} from "./lib/profileValidators";
import { buildVehicleCreatedPayload, logEvent } from "./lib/events";

/**
 * Shared vehicle list for the profile pickers. Gated to members with an
 * active application since entries include license plates.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const application = await getActiveApplication(ctx);
    if (!application) {
      return [];
    }

    const vehicles = await ctx.db.query("vehicles").collect();
    // Only profiles with a live application count toward occupancy.
    const profiles = await listActiveProfiles(ctx);

    return vehicles
      .map((vehicle) => {
        const riderCount = profiles.filter(
          (profile) => profile.vehicleId === vehicle._id
        ).length;
        const sleeperCount = profiles.filter(
          (profile) => profile.sleepingVehicleId === vehicle._id
        ).length;
        return {
          _id: vehicle._id,
          name: vehicle.name,
          vehicleType: vehicle.vehicleType,
          lengthFt: vehicle.lengthFt,
          description: vehicle.description,
          trailerName: vehicle.trailerName,
          licensePlate: vehicle.licensePlate,
          riderCount,
          sleeperCount,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    vehicleType: vehicleTypeValidator,
    lengthFt: v.number(),
    description: v.string(),
    trailerName: v.optional(v.string()),
    licensePlate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const application = await requireActiveApplication(ctx);

    const name = args.name.trim();
    if (!name) {
      throw new Error("Vehicle name is required");
    }
    if (!args.description.trim()) {
      throw new Error("Vehicle description is required");
    }
    if (!Number.isFinite(args.lengthFt) || args.lengthFt <= 0) {
      throw new Error("Vehicle length must be a positive number");
    }
    if (args.trailerName?.trim() && args.vehicleType !== "vehicle_with_trailer") {
      throw new Error("Trailer name only applies to a vehicle with a towable trailer");
    }

    const existing = await ctx.db.query("vehicles").collect();
    const duplicate = existing.find(
      (vehicle) => vehicle.name.toLowerCase() === name.toLowerCase()
    );
    if (duplicate) {
      throw new Error(
        `A vehicle named "${duplicate.name}" already exists — select it from the list instead`
      );
    }

    const now = Date.now();
    const vehicleId = await ctx.db.insert("vehicles", {
      name,
      vehicleType: args.vehicleType,
      lengthFt: args.lengthFt,
      description: args.description.trim(),
      trailerName: args.trailerName?.trim() || undefined,
      licensePlate: args.licensePlate?.trim() || undefined,
      createdByUserId: application.userId,
      createdAt: now,
      updatedAt: now,
    });

    await logEvent(ctx, {
      applicationId: application._id,
      eventType: "vehicle_created",
      payload: buildVehicleCreatedPayload({
        email: application.email,
        vehicleName: name,
        vehicleType: args.vehicleType,
      }),
      actor: application.email,
    });

    return vehicleId;
  },
});
