# Ops Editable Attendee Profiles Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let ops admins edit attendee profile fields from `/ops/profiles` without impersonating members.

**Architecture:** Add explicit ops-only Convex mutations that accept `opsPassword` and `applicationId`, reuse the same validation rules as the member-facing profile mutations, and write audit events with an ops actor. Keep member-facing mutations identity-bound. Add an edit drawer/modal to the existing ops profiles table that submits section-specific saves and relies on `listForOps` reactivity for refreshed rows.

**Tech Stack:** Next.js App Router, React 19, Convex queries/mutations, Vitest, Testing Library, Tailwind CSS.

## Scope

Included:
- Ops can edit status/ticket/travel fields, burns/emergency contact, transport, sleeping, meals, and camp notes/playa name.
- Ops edits are authorized with the existing `OPS_PWD` flow.
- Ops edits create `attendee_profile_updated` audit events and refresh `ops_signup_rows`.
- Existing member profile behavior stays unchanged.

Excluded for first pass:
- Ops profile photo upload/replacement. Photo upload touches Convex file storage and is a separate, higher-risk workflow.
- New role model beyond the existing ops password.
- Bulk edit.

## Current Code Map

- Read-only ops page: `src/app/ops/profiles/page.tsx`
- Ops profile table: `src/components/ops/ProfilesTable.tsx`
- Member profile page: `src/app/profile/page.tsx`
- Member profile sections: `src/components/profile/*.tsx`
- Profile mutations and ops list query: `convex/attendeeProfiles.ts`
- Profile validators: `convex/lib/profileValidators.ts`
- Ops password helper: `convex/lib/auth.ts`
- Event logging helper: `convex/lib/events.ts`
- Ops projection refresh: `convex/opsSignupRows.ts`
- Completeness logic: `src/lib/attendeeProfile/completeness.ts`

## Task 1: Add Backend Test Harness for Ops Profile Saves

**Files:**
- Create: `convex/attendeeProfilesOps.test.ts`
- Modify: none

**Step 1: Write the failing tests**

Create `convex/attendeeProfilesOps.test.ts` with a minimal Convex context that supports:
- `db.get(id)`
- `db.query(table).withIndex(...).first()`
- `db.insert(table, doc)`
- `db.patch(id, patch)`
- `db.system.get(storageId)` only if needed later

Mock:

```ts
vi.mock("./opsSignupRows", () => ({
  upsertOpsSignupRow: vi.fn().mockResolvedValue({ operation: "updated", rowId: "row_1" }),
}));

vi.mock("./lib/events", async () => {
  const actual = await vi.importActual<typeof import("./lib/events")>("./lib/events");
  return {
    ...actual,
    logEvent: vi.fn().mockResolvedValue(undefined),
  };
});
```

Add tests for these behaviors first:

```ts
it("rejects invalid ops passwords");
it("rejects missing or inactive applications");
it("lets ops save burns and emergency contact for another member");
it("lets ops save meals on the application and creates a profile if missing");
it("logs attendee_profile_updated with an ops actor");
it("refreshes the ops signup row after a save");
```

**Step 2: Run tests to verify failure**

Run:

```bash
npm test -- convex/attendeeProfilesOps.test.ts
```

Expected: fails because ops profile mutations do not exist.

## Task 2: Refactor Shared Backend Helpers

**Files:**
- Modify: `convex/attendeeProfiles.ts`
- Test: `convex/attendeeProfilesOps.test.ts`

**Step 1: Extract application lookup helpers**

In `convex/attendeeProfiles.ts`, add local helpers near `getOrCreateProfile`:

```ts
async function getActiveApplicationById(
  ctx: MutationCtx,
  applicationId: Id<"applications">
): Promise<Doc<"applications"> | null> {
  const application = await ctx.db.get(applicationId);
  return countsForLogistics(application) ? application : null;
}

async function requireActiveApplicationById(
  ctx: MutationCtx,
  applicationId: Id<"applications">
): Promise<Doc<"applications">> {
  const application = await getActiveApplicationById(ctx, applicationId);
  if (!application) {
    throw new Error("Active application not found");
  }
  return application;
}
```

Add `Id` to the existing import from `./_generated/dataModel`.

**Step 2: Extract section implementation helpers**

Refactor member mutations so validation/patching lives in reusable functions:

```ts
async function saveStatusForApplication(ctx, application, args, actor) { ... }
async function saveBurnsEmergencyForApplication(ctx, application, args, actor) { ... }
async function saveTransportForApplication(ctx, application, args, actor) { ... }
async function saveSleepingForApplication(ctx, application, args, actor) { ... }
async function saveMealsForApplication(ctx, application, args, actor) { ... }
async function saveCampForApplication(ctx, application, args, actor) { ... }
```

Each helper should contain the current validation and writes from the member mutation. `finalizeSectionSave` should accept `actor`:

```ts
async function finalizeSectionSave(ctx, application, section, fields, actor) {
  await logEvent(ctx, {
    applicationId: application._id,
    eventType: "attendee_profile_updated",
    payload: buildAttendeeProfileUpdatedPayload({
      email: application.email,
      section,
      fields,
    }),
    actor,
  });
  await upsertOpsSignupRow(ctx, application._id);
}
```

Member mutations should pass `application.email` so existing behavior remains equivalent.

**Step 3: Run existing profile tests**

Run:

```bash
npm test -- convex/attendeeProfilesRoster.test.ts convex/lib/profileValidators.test.ts src/lib/attendeeProfile/completeness.test.ts
```

Expected: pass.

## Task 3: Add Ops Profile Mutations

**Files:**
- Modify: `convex/attendeeProfiles.ts`
- Test: `convex/attendeeProfilesOps.test.ts`

**Step 1: Add mutation args**

Each ops mutation should take:

```ts
opsPassword: v.string(),
applicationId: v.id("applications"),
```

plus the same section fields as the matching member mutation.

**Step 2: Implement ops mutations**

Add:

```ts
export const opsSaveStatus = mutation({ ... });
export const opsSaveBurnsEmergency = mutation({ ... });
export const opsSaveTransport = mutation({ ... });
export const opsSaveSleeping = mutation({ ... });
export const opsSaveMeals = mutation({ ... });
export const opsSaveCamp = mutation({ ... });
```

Each handler should:

```ts
requireOpsPassword(args.opsPassword);
const application = await requireActiveApplicationById(ctx, args.applicationId);
return await saveXForApplication(ctx, application, sectionArgs, "ops");
```

Do not include `opsPassword` or `applicationId` in the section payload passed to `saveXForApplication`.

**Step 3: Verify ops-specific tests**

Run:

```bash
npm test -- convex/attendeeProfilesOps.test.ts
```

Expected: pass.

## Task 4: Expand Ops Rows for Editable IDs

**Files:**
- Modify: `convex/attendeeProfiles.ts`
- Modify: `src/components/ops/ProfilesTable.tsx`
- Test: `convex/attendeeProfilesOps.test.ts`

**Step 1: Return editable IDs in `listForOps`**

Add these fields to each ops profile row:

```ts
profileId: profile?._id,
vehicleId: profile?.vehicleId,
sleepingVehicleId: profile?.sleepingVehicleId,
sleepingGroupId: profile?.sleepingGroupId,
```

`applicationId` is already present and should remain the primary save target.

**Step 2: Assert IDs are present**

Add or update a `listForOps` test to verify returned rows include the IDs needed to prefill edit controls.

**Step 3: Run the targeted tests**

Run:

```bash
npm test -- convex/attendeeProfilesOps.test.ts
```

Expected: pass.

## Task 5: Extract Reusable Ops Edit Form Component

**Files:**
- Create: `src/components/ops/ProfileEditDialog.tsx`
- Modify: `src/components/ops/ProfilesTable.tsx`
- Test: optional in this task; UI tests come later

**Step 1: Create the dialog shell**

Create `ProfileEditDialog.tsx` with props:

```ts
type ProfileEditDialogProps = {
  row: ProfileRow | null;
  opsPassword: string;
  onClose: () => void;
};
```

Export the `ProfileRow` type from `ProfilesTable.tsx` or move it to a small shared file:

```ts
export type ProfileRow = FunctionReturnType<typeof api.attendeeProfiles.listForOps>[number];
```

The dialog should be a fixed overlay with:
- member name/email header
- close button
- section tabs or stacked sections
- save buttons per section
- local save/error state per section

**Step 2: Add an Edit button to table rows**

In `ProfilesTable.tsx`, add an `"Actions"` header and an `Edit` button in each row:

```tsx
<button type="button" onClick={() => setEditingRow(row)}>Edit</button>
```

Render:

```tsx
<ProfileEditDialog row={editingRow} opsPassword={opsPassword} onClose={() => setEditingRow(null)} />
```

Update empty-state `colSpan` for the extra column.

**Step 3: Manually inspect layout**

Run:

```bash
npm run dev
```

Open `/ops/profiles`, enter the ops password, and confirm the edit dialog opens without changing data.

Expected: page still lists profiles and the dialog can open/close.

## Task 6: Wire Simple Sections in the Ops Dialog

**Files:**
- Modify: `src/components/ops/ProfileEditDialog.tsx`
- Test: `src/components/ops/ProfileEditDialog.test.tsx`

**Step 1: Write UI tests**

Create tests for:
- renders selected member name/email
- saves burns/emergency contact through `api.attendeeProfiles.opsSaveBurnsEmergency`
- saves meals through `api.attendeeProfiles.opsSaveMeals`
- shows mutation errors without closing the dialog

Mock Convex `useMutation` by API function identity.

**Step 2: Implement simple editable sections**

Implement first:
- Burns & emergency
- Meals
- Camp

Use existing `Field` from `src/components/forms/Field.tsx`, labels from `src/lib/attendeeProfile/options.ts`, and phone canonicalization from `src/lib/phone/format.ts`.

For each mutation call, pass:

```ts
{
  opsPassword,
  applicationId: row.applicationId,
  ...
}
```

**Step 3: Run UI tests**

Run:

```bash
npm test -- src/components/ops/ProfileEditDialog.test.tsx
```

Expected: pass.

## Task 7: Wire Status, Transport, and Sleeping Sections

**Files:**
- Modify: `src/components/ops/ProfileEditDialog.tsx`
- Test: `src/components/ops/ProfileEditDialog.test.tsx`

**Step 1: Add status fields**

Include:
- `hasTicket`
- `arrival`
- `arrivalTime`
- `departure`
- `departureTime`
- `earlyDepartureReason` when early departure is detected

Use `isEarlyDeparture` and the same config/content date bounds as the member profile page. If accessing full `LandingContent` in the dialog is awkward, pass `content` down from `src/app/ops/profiles/page.tsx` or query `api.config.getConfig` inside the dialog and call `getLandingContent`.

**Step 2: Add transport fields**

Include:
- `arrivalMode`
- `departureMode`
- `vehicleId`
- `vehiclePassStatus`
- `bikeStatus`

Use `api.vehicles.list` for vehicle options, matching the member-facing transport section.

**Step 3: Add sleeping fields**

Include:
- `sleepingType`
- `sleepingVehicleId`
- `sleepingGroupId`

Use `api.vehicles.list` and `api.sleepingGroups.list`.

**Step 4: Add tests for conditional validation**

Test that:
- early departure without reason surfaces an error
- transport requiring a vehicle sends `vehicleId`
- sleeping in a shiftpod/tent sends `sleepingGroupId`

**Step 5: Run UI tests**

Run:

```bash
npm test -- src/components/ops/ProfileEditDialog.test.tsx
```

Expected: pass.

## Task 8: Preserve Audit and Projection Behavior

**Files:**
- Modify: `convex/attendeeProfilesOps.test.ts`
- Modify: `convex/attendeeProfiles.ts` if needed

**Step 1: Add focused backend tests**

Assert for one ops save:

```ts
expect(logEvent).toHaveBeenCalledWith(
  expect.anything(),
  expect.objectContaining({
    applicationId,
    eventType: "attendee_profile_updated",
    actor: "ops",
  })
);

expect(upsertOpsSignupRow).toHaveBeenCalledWith(expect.anything(), applicationId);
```

Assert the event payload email is the edited member email, not the ops actor.

**Step 2: Run backend tests**

Run:

```bash
npm test -- convex/attendeeProfilesOps.test.ts
```

Expected: pass.

## Task 9: Full Verification

**Files:**
- No code changes expected

**Step 1: Run targeted unit tests**

Run:

```bash
npm test -- convex/attendeeProfilesOps.test.ts src/components/ops/ProfileEditDialog.test.tsx
```

Expected: pass.

**Step 2: Run related regression tests**

Run:

```bash
npm test -- convex/attendeeProfilesRoster.test.ts convex/confirmedMembers.test.ts src/lib/attendeeProfile/completeness.test.ts
```

Expected: pass.

**Step 3: Run lint**

Run:

```bash
npm run lint
```

Expected: pass.

**Step 4: Run production build**

Run:

```bash
npm run build
```

Expected: Convex codegen succeeds and Next.js builds.

## Task 10: Manual QA

**Files:**
- No code changes expected

**Step 1: Start dev server**

Run:

```bash
npm run dev
```

Expected: local Next.js server starts.

**Step 2: Validate ops workflow**

In the browser:
- open `/ops/profiles`
- enter ops password
- choose a member
- edit burns/emergency contact
- edit meals
- edit travel dates
- close and reopen the dialog

Expected:
- row updates after saves
- completeness count changes if required fields are filled
- invalid fields show inline errors
- member-facing `/profile` still shows the updated data for that member

**Step 3: Validate member workflow still works**

Sign in as a normal member and save each profile section from `/profile`.

Expected:
- no ops password is required
- current section saves still work
- early departure behavior is unchanged

## Suggested Commit Sequence

1. `test: cover ops profile editing mutations`
2. `feat: add ops attendee profile mutations`
3. `feat: add ops profile edit dialog`
4. `test: cover ops profile edit UI`

## Risk Notes

- Status saves can change `status` and `paymentAllowed` for early departures, by design. This should be called out in the UI so ops knows a date edit can move someone into review.
- Vehicle and sleeping IDs are shared resources. The first pass should select existing records only; creating vehicles/groups from the ops edit dialog can be added later.
- Photo upload should stay out of this change unless explicitly requested.
