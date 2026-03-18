# Newbie Invite Flow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let confirmed alumni members sponsor newbies from the post-payment details screen, automatically allow those newbies to sign in and apply, and label alumni vs. newbie records clearly across ops views.

**Architecture:** Keep the existing allowlist gate as the single admission check for `/apply`, but enrich the allowlist and application data with a member type and sponsorship metadata. Add a new sponsor-invite flow for confirmed members that creates an invite record, inserts the newbie email into the allowlist, and sends a transactional email linking back to `/apply`.

**Tech Stack:** Next.js, React, Convex mutations/queries/actions, Convex Auth with Resend, Vitest, Playwright.

## Product Assumptions

- Confirmed members can invite newbies immediately after payment confirmation.
- Submitting an invite adds the newbie email to the allowlist right away.
- Newbies use the same application form and payment flow as alumni.
- The system should distinguish at least two member types: `alumni` and `newbie`.
- Sponsor invites are primarily informational for ops, not an approval queue.
- Sponsored newbies should be able to apply immediately after sponsorship.

## Decisions Confirmed

- Invite limits: unlimited.
- Duplicate sponsorships: first sponsor wins; later sponsors should be told the newbie has already been sponsored.
- Editing behavior: no edit or cancel flow in v1.
- Email sender: use the same configured sender/admin email already used by auth mail.
- Email copy for v1: `You've been invited to DeMentha by [Sponsor Name]. Please sign up here: [base url]`
- Ops review is not part of v1 for newbie invites.
- Sponsorship alone is sufficient to allowlist a newbie.
- Sponsored newbies should be able to sign in and apply immediately after the invite is submitted.

## Proposed Data Model

### Task 1: Add explicit member type and invite records

**Files:**
- Modify: `/Users/ashok/src/clients/dementha/mint-members/convex/schema.ts`
- Modify: `/Users/ashok/src/clients/dementha/mint-members/convex/schema.test.ts`

**Step 1: Extend allowlist entries with source metadata**

Add fields to `email_allowlist`:

- `memberType`: `"alumni"` | `"newbie"`
- `source`: `"ops"` | `"sponsor_invite"`
- `sponsorUserId?`
- `sponsorApplicationId?`
- `sponsorEmail?`
- `sponsorName?`
- `invitedAt?`

This keeps the allowlist as the gate while preserving how the email got there.

**Step 2: Extend applications with member type**

Add `memberType` to `applications` so the type is snapshotted at submission time instead of inferred later from the allowlist.

**Step 3: Add a `newbie_invites` table**

Store one row per successful sponsorship:

- `sponsorUserId`
- `sponsorApplicationId`
- `sponsorEmail`
- `sponsorName`
- `newbieFirstName`
- `newbieLastName`
- `newbieEmail`
- `newbiePhone`
- `whyTheyBelong`
- `preparednessAcknowledged`
- `allowlistEmailId?`
- `applicationId?`
- `inviteEmailSentAt?`
- `createdAt`
- `updatedAt`

Add indexes by `newbieEmail` and `sponsorUserId`.

This table is the source of truth for answering who sponsored which newbie.
Invite progress should be derived, not stored:

- `invited`: invite exists and `applicationId` is empty
- `applied`: `applicationId` exists and the linked application is not yet `confirmed`
- `confirmed`: `applicationId` exists and the linked application status is `confirmed`

**Step 4: Update tests**

Adjust schema assertions so the new tables/fields are covered.

### Task 2: Define event logging for sponsorship lifecycle

**Files:**
- Modify: `/Users/ashok/src/clients/dementha/mint-members/convex/schema.ts`
- Modify: `/Users/ashok/src/clients/dementha/mint-members/convex/lib/events.ts`
- Modify: `/Users/ashok/src/clients/dementha/mint-members/src/lib/events/eventPayload.test.ts`

**Step 1: Add event types**

Add event types such as:

- `newbie_invited`
- `newbie_invite_email_sent`
- `newbie_invite_email_failed`

**Step 2: Add payload builders**

Create payload builders containing sponsor name/email, newbie email, member type, and invite identifiers for auditability.

## Backend Flow

### Task 3: Enrich allowlist behavior without breaking current ops workflows

**Files:**
- Modify: `/Users/ashok/src/clients/dementha/mint-members/convex/allowlist.ts`
- Modify: `/Users/ashok/src/clients/dementha/mint-members/src/components/ops/AllowlistTable.tsx`
- Modify: `/Users/ashok/src/clients/dementha/mint-members/src/app/ops/allowlist/page.tsx`

**Step 1: Preserve current CSV upload behavior**

Ops-added emails should default to:

- `memberType: "alumni"`
- `source: "ops"`

**Step 2: Return richer allowlist rows**

Make ops queries return member type and sponsor/source metadata so the allowlist page can show whether an email is an alumni seed or a sponsored newbie.

**Step 3: Keep self-check behavior simple**

`isEmailAllowed` can remain boolean; the richer metadata should come from separate ops and/or member queries.

### Task 4: Add sponsor invite mutation and query surface

**Files:**
- Create: `/Users/ashok/src/clients/dementha/mint-members/convex/newbieInvites.ts`
- Modify: `/Users/ashok/src/clients/dementha/mint-members/convex/_generated/api.d.ts` after codegen
- Modify: `/Users/ashok/src/clients/dementha/mint-members/convex/confirmedMembers.ts`
- Test: `/Users/ashok/src/clients/dementha/mint-members/convex/confirmedMembers.test.ts`

**Step 1: Create `submitInvite` mutation**

Requirements:

- Require auth.
- Require the sponsor’s application status to be `confirmed`.
- Validate full name, phone, email, explanation, and checkbox acknowledgement.
- Normalize newbie email and phone.
- Reject empty explanation or unchecked acknowledgement.
- Reject the invite if that newbie email already has a successful sponsor; return a clear message that they have already been sponsored.

**Step 2: Insert allowlist + invite row transactionally**

In one mutation:

- create the `newbie_invites` row
- add the newbie email to `email_allowlist` with `memberType: "newbie"` and sponsor metadata if it is not already present
- log `newbie_invited`

If the newbie email is already sponsored, do not reassign ownership and do not create a second successful invite row.

**Step 3: Expose sponsor history**

Add a query like `listMine` so confirmed members can see invites they have already submitted and avoid re-inviting the same person blindly.

### Task 5: Send invite email through Resend

**Files:**
- Create: `/Users/ashok/src/clients/dementha/mint-members/convex/newbieInvitesActions.ts`
- Possibly modify: `/Users/ashok/src/clients/dementha/mint-members/convex/auth.ts`
- Modify: `/Users/ashok/src/clients/dementha/mint-members/.env.local.example`

**Step 1: Reuse the existing Resend setup pattern**

This repo already uses Resend for auth emails in [`convex/auth.ts`](/Users/ashok/src/clients/dementha/mint-members/convex/auth.ts). Follow the same environment-variable style for invite mail.

**Step 2: Add an action to send the invite email**

The email should include:

- sponsor name
- a short explanation that they were invited to apply
- a link to `/apply`
- instructions to sign in with the invited email address

Use the exact v1 copy unless product changes it:

- `You've been invited to DeMentha by [Sponsor Name]. Please sign up here: [base url]`

**Step 3: Decide call timing**

Preferred approach:

- the mutation writes the durable invite + allowlist state
- the client then calls an action to send the email
- failed email delivery does not remove allowlist access
- failure is logged and surfaced to the sponsor/ops for retry

This avoids mixing external email I/O into the mutation path.

### Task 6: Stamp member type onto the application at submission time

**Files:**
- Modify: `/Users/ashok/src/clients/dementha/mint-members/convex/applications.ts`
- Test: `/Users/ashok/src/clients/dementha/mint-members/convex/applicationsSignupsView.test.ts`

**Step 1: Read the allowlist entry during application creation**

When `createDraftApplication` verifies allowlist access, also read `memberType` from that allowlist row and persist it on the `applications` record.

**Step 2: Link application back to invite record if applicable**

If the applicant is a newbie and there is a matching `newbie_invites` row by email, store `applicationId` on the invite so progress can be derived.

## Frontend Flow

### Task 7: Add invite UI to the confirmed-member details form

**Files:**
- Modify: `/Users/ashok/src/clients/dementha/mint-members/src/components/forms/ConfirmedMemberDetailsForm.tsx`
- Create: `/Users/ashok/src/clients/dementha/mint-members/src/lib/newbieInvites/validation.ts`
- Create: `/Users/ashok/src/clients/dementha/mint-members/src/lib/newbieInvites/validation.test.ts`

**Step 1: Keep existing logistics controls intact**

Do not bury the current ticket/vehicle/request fields. Add a new sponsorship section below them.

**Step 2: Add sponsor form fields**

Fields:

- newbie full name
- newbie phone number
- newbie email
- sponsor explanation
- acknowledgement checkbox

**Step 3: Add invite history/status UI**

After submission, show previously invited newbies and their derived progress state: invited, applied, or confirmed.

**Step 4: Handle partial failure cleanly**

If the invite record is created but email send fails, show a warning like:

- the newbie can still apply because their email is allowlisted
- ops may need a resend control later

### Task 8: Make application-page messaging type-aware

**Files:**
- Modify: `/Users/ashok/src/clients/dementha/mint-members/src/app/apply/page.tsx`
- Modify: `/Users/ashok/src/clients/dementha/mint-members/src/components/forms/ApplicationForm.tsx`

**Step 1: Update blocked messaging**

Current copy says applications are only open to alumni. Replace with copy that fits both cases, for example:

- alumni explicitly invited by ops
- newbies sponsored by a confirmed member

**Step 2: Optionally show detected member type**

If useful, show a small badge or note once the signed-in user is recognized as allowlisted, e.g. `Alumni` or `Sponsored Newbie`.

## Ops Visibility

### Task 9: Surface alumni/newbie labels in ops views

**Files:**
- Modify: `/Users/ashok/src/clients/dementha/mint-members/convex/confirmedMembers.ts`
- Modify: `/Users/ashok/src/clients/dementha/mint-members/convex/opsSignupRows.ts`
- Modify: `/Users/ashok/src/clients/dementha/mint-members/src/components/ops/ConfirmedMembersTable.tsx`
- Modify: `/Users/ashok/src/clients/dementha/mint-members/src/components/ops/SignupsTable.tsx`
- Modify: `/Users/ashok/src/clients/dementha/mint-members/src/components/ops/AllowlistTable.tsx`
- Modify: `/Users/ashok/src/clients/dementha/mint-members/src/lib/opsSignupsView/types.ts`
- Modify: `/Users/ashok/src/clients/dementha/mint-members/src/lib/opsSignupsView/evaluate.ts`

**Step 1: Add member type to projection rows**

`ops_signup_rows` should include `memberType` so filtering/exporting remains cheap and stable.

**Step 2: Show member type in ops tables**

Add a clear column/badge for `Alumni` vs `Newbie` on:

- allowlist
- signups
- confirmed members

**Step 3: Include sponsor metadata where helpful**

This is required. Ops must be able to see who sponsored which newbie from:

- the allowlist
- the dedicated invites view
- signup or confirmed-member rows for newbie records when that data is available

### Task 10: Add a dedicated ops view for invite tracking

**Files:**
- Create: `/Users/ashok/src/clients/dementha/mint-members/src/app/ops/invites/page.tsx`
- Create: `/Users/ashok/src/clients/dementha/mint-members/src/components/ops/NewbieInvitesTable.tsx`
- Modify: `/Users/ashok/src/clients/dementha/mint-members/src/app/ops/layout.tsx`

**Step 1: Give ops one place to inspect sponsorships**

Columns:

- sponsor
- newbie name
- newbie email
- newbie phone
- explanation
- acknowledgement
- derived status
- created at

This will matter quickly once invites start coming in.

## Testing

### Task 11: Add backend tests for invite rules

**Files:**
- Create: `/Users/ashok/src/clients/dementha/mint-members/convex/newbieInvites.test.ts`
- Modify: `/Users/ashok/src/clients/dementha/mint-members/convex/confirmedMembers.test.ts`
- Modify: `/Users/ashok/src/clients/dementha/mint-members/convex/schema.test.ts`

**Step 1: Cover sponsor eligibility**

Test that:

- non-authenticated users cannot invite
- non-confirmed applicants cannot invite
- confirmed members can invite

**Step 2: Cover persistence rules**

Test that:

- invite creation inserts/updates allowlist correctly
- newbie invites are tagged with `memberType: "newbie"`
- alumni CSV/ops entries remain `memberType: "alumni"`
- sponsor identity is preserved on the invite row and allowlist row

**Step 3: Cover duplicate and linking behavior**

Test the chosen policy for repeated invites and for newbie application linkage after signup.

### Task 12: Add frontend tests for the new sponsor form

**Files:**
- Create: `/Users/ashok/src/clients/dementha/mint-members/src/components/forms/ConfirmedMemberDetailsForm.test.tsx`
- Modify: existing relevant view tests under `/Users/ashok/src/clients/dementha/mint-members/src/components/ops`

**Step 1: Validate the new UI**

Test required fields, acknowledgement checkbox, success state, and email-send failure warnings.

**Step 2: Validate ops labels**

Test that alumni/newbie badges render in ops tables.

### Task 13: Add end-to-end coverage

**Files:**
- Modify: `/Users/ashok/src/clients/dementha/mint-members/tests/e2e/applicationFlow.test.ts`
- Create: `/Users/ashok/src/clients/dementha/mint-members/tests/e2e/newbieInviteFlow.test.ts`

**Step 1: Cover the happy path**

Scenario:

- alumni signs up and pays
- alumni opens `/apply`
- alumni submits newbie invite
- newbie signs in with invited email
- newbie can access and submit application

**Step 2: Cover a failure mode**

At least one test for invite email failure or duplicate invite handling, depending on the chosen implementation.

## Recommended Delivery Order

1. Schema and event model.
2. Sponsor invite mutation/query.
3. Invite email action.
4. Confirmed-member form UI.
5. Application stamping/linking.
6. Ops labels and invite dashboard.
7. E2E coverage and copy polish.

## Notes On Scope Control

- Keep newbie onboarding on the existing `/apply` flow; do not create a separate newbie-specific application form unless requirements change.
- Do not add ops approval for invites in v1 unless product explicitly wants it.
- Treat allowlist insertion as the source of truth for signup access.
- Defer invite revocation/resend UI if schedule is tight; design the schema so those can be added later.
