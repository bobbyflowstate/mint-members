import { describe, expect, it } from "vitest";
import {
  ApplicationForCompleteness,
  ProfileForCompleteness,
  computeProfileCompleteness,
} from "./completeness";

const CUTOFF = "2025-08-31";

const baseApplication: ApplicationForCompleteness = {
  departure: "2025-09-01",
  departureTime: "11.01 am to 6.00 pm",
  dietaryPreference: "omnivore",
  allergyFlag: false,
};

const completeProfile: ProfileForCompleteness = {
  hasTicket: true,
  profilePhotoStorageId: "storage1",
  numBurnsAttended: 3,
  emergencyContactName: "Jane Doe",
  emergencyContactPhone: "+15551231234",
  arrivalMode: "burner_express",
  departureMode: "flying",
  vehiclePassStatus: "have",
  bikeStatus: "bringing_own",
  sleepingType: "need_camp_shiftpod",
};

function sectionByKey(
  result: ReturnType<typeof computeProfileCompleteness>,
  key: string
) {
  const section = result.sections.find((s) => s.key === key);
  if (!section) throw new Error(`missing section ${key}`);
  return section;
}

describe("computeProfileCompleteness", () => {
  it("marks all sections complete for a fully filled profile", () => {
    const result = computeProfileCompleteness(completeProfile, baseApplication, CUTOFF);
    expect(result.completeCount).toBe(result.totalCount);
    expect(result.totalCount).toBe(6);
  });

  it("marks the photo section incomplete until a photo is uploaded", () => {
    const withoutPhoto = computeProfileCompleteness(
      { ...completeProfile, profilePhotoStorageId: undefined },
      baseApplication,
      CUTOFF
    );
    expect(sectionByKey(withoutPhoto, "photo").complete).toBe(false);
    expect(sectionByKey(withoutPhoto, "photo").missing).toContain(
      "Upload a profile photo"
    );
    // An otherwise-complete profile drops below total — the new section
    // must read as unfinished for existing members.
    expect(withoutPhoto.completeCount).toBe(withoutPhoto.totalCount - 1);

    const withPhoto = computeProfileCompleteness(
      completeProfile,
      baseApplication,
      CUTOFF
    );
    expect(sectionByKey(withPhoto, "photo").complete).toBe(true);
  });

  it("marks everything missing for an empty profile", () => {
    const result = computeProfileCompleteness({}, baseApplication, CUTOFF);
    expect(sectionByKey(result, "photo").complete).toBe(false);
    expect(sectionByKey(result, "status").complete).toBe(false);
    expect(sectionByKey(result, "burnsEmergency").complete).toBe(false);
    expect(sectionByKey(result, "transport").complete).toBe(false);
    expect(sectionByKey(result, "sleeping").complete).toBe(false);
    // Meals comes from the application, which is always filled at sign-up.
    expect(sectionByKey(result, "meals").complete).toBe(true);
  });

  it("treats zero burns as answered", () => {
    const result = computeProfileCompleteness(
      { ...completeProfile, numBurnsAttended: 0 },
      baseApplication,
      CUTOFF
    );
    expect(sectionByKey(result, "burnsEmergency").complete).toBe(true);
  });

  it("requires an early departure reason when leaving early", () => {
    const earlyApplication: ApplicationForCompleteness = {
      ...baseApplication,
      departure: "2025-08-31",
      departureTime: "11.01 am to 6.00 pm",
    };
    const missingReason = computeProfileCompleteness(
      completeProfile,
      earlyApplication,
      CUTOFF
    );
    expect(sectionByKey(missingReason, "status").complete).toBe(false);
    expect(sectionByKey(missingReason, "status").missing).toContain(
      "Early departure reason"
    );

    const withReason = computeProfileCompleteness(
      completeProfile,
      { ...earlyApplication, earlyDepartureReason: "Work travel" },
      CUTOFF
    );
    expect(sectionByKey(withReason, "status").complete).toBe(true);
  });

  it("requires a vehicle when a travel mode involves a vehicle", () => {
    const driving = computeProfileCompleteness(
      { ...completeProfile, arrivalMode: "driving_own_vehicle" },
      baseApplication,
      CUTOFF
    );
    expect(sectionByKey(driving, "transport").missing).toContain("Vehicle");

    const withVehicle = computeProfileCompleteness(
      { ...completeProfile, arrivalMode: "driving_own_vehicle", vehicleId: "veh1" },
      baseApplication,
      CUTOFF
    );
    expect(sectionByKey(withVehicle, "transport").complete).toBe(true);

    const riding = computeProfileCompleteness(
      { ...completeProfile, departureMode: "riding_with_attendee" },
      baseApplication,
      CUTOFF
    );
    expect(sectionByKey(riding, "transport").missing).toContain("Vehicle");
  });

  it("requires the matching sleeping reference per sleeping type", () => {
    const rvMissing = computeProfileCompleteness(
      { ...completeProfile, sleepingType: "rv_trailer_vehicle" },
      baseApplication,
      CUTOFF
    );
    expect(sectionByKey(rvMissing, "sleeping").complete).toBe(false);

    const rvSet = computeProfileCompleteness(
      { ...completeProfile, sleepingType: "rv_trailer_vehicle", sleepingVehicleId: "veh1" },
      baseApplication,
      CUTOFF
    );
    expect(sectionByKey(rvSet, "sleeping").complete).toBe(true);

    const podMissing = computeProfileCompleteness(
      { ...completeProfile, sleepingType: "own_shiftpod_or_tent" },
      baseApplication,
      CUTOFF
    );
    expect(sectionByKey(podMissing, "sleeping").complete).toBe(false);

    const podSet = computeProfileCompleteness(
      { ...completeProfile, sleepingType: "own_shiftpod_or_tent", sleepingGroupId: "sg1" },
      baseApplication,
      CUTOFF
    );
    expect(sectionByKey(podSet, "sleeping").complete).toBe(true);

    // Camp shiftpod needs no reference.
    const campPod = computeProfileCompleteness(
      { ...completeProfile, sleepingType: "need_camp_shiftpod" },
      baseApplication,
      CUTOFF
    );
    expect(sectionByKey(campPod, "sleeping").complete).toBe(true);
  });

  it("requires allergy details only when the allergy flag is set", () => {
    const flagged = computeProfileCompleteness(completeProfile, {
      ...baseApplication,
      allergyFlag: true,
    }, CUTOFF);
    expect(sectionByKey(flagged, "meals").complete).toBe(false);

    const detailed = computeProfileCompleteness(completeProfile, {
      ...baseApplication,
      allergyFlag: true,
      allergyNotes: "Peanuts",
    }, CUTOFF);
    expect(sectionByKey(detailed, "meals").complete).toBe(true);
  });
});
