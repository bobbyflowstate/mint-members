# Post-Burning-Man Seasons and Teams Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** After Burning Man 2026, add yearly seasons and season-scoped Teams without risking the live 2026 application, payment, and ops workflows.

**Architecture:** Do this as a staged compatibility migration. First add season data without changing existing behavior, then audit/backfill 2026 records, then switch reads/writes to active-season semantics, then build Teams on top of the season foundation. No runtime query should require `seasonId` until prod has been audited and backfilled.

**Tech Stack:** Next.js App Router, Convex schema/functions, Vitest, existing ops password authorization.

## Timing and Release Policy

Do not deploy this before Burning Man 2026 unless there is a production-critical reason. The current site is live for 2026 operations, and season scoping touches high-risk paths: application creation, payment-adjacent status, capacity, member details, ops views, invites, and future Teams source data.

Recommended timeline:
- September 2026: implement and test in a dedicated branch/worktree.
- After 2026 ops no longer depend on live application changes: deploy schema-only compatibility changes.
- After audit/backfill verification: deploy active-season read/write changes.
- Before 2027 applications open: create and activate the 2027 season.

## Non-Negotiable Safety Rules

- Season fields must start optional.
- Existing unscoped prod rows must continue to work until backfill is verified.
- Every migration must have a dry-run mode.
- Every read-path behavior change must have tests covering scoped and legacy rows.
- Do not remove old non-season indexes during this migration.
- Do not build Teams against unverified season data.

### Task 1: Create Dedicated Worktree

**Files:**
- No code files.

**Step 1: Check current branch and dirty state**

Run:

```bash
git status --short
git branch --show-current
```

Expected: understand current branch and confirm no unrelated work will be mixed in.

**Step 2: Create a post-event branch/worktree**

Run:

```bash
git switch -c codex/post-bm-seasons-teams
```

Expected: branch created from the intended base.

**Step 3: Commit or stash unrelated local edits before implementation**

Run:

```bash
git status --short
```

Expected: only intentional files are dirty before starting Task 2.

### Task 2: Add Schema-Only Season Foundation

**Files:**
- Modify: `convex/schema.ts`
- Modify: `convex/schema.test.ts`

**Step 1: Write failing schema tests**

Add tests asserting:
- `seasons` table exists.
- yearly tables still exist.
- no existing table is removed.

Run:

```bash
npm test -- convex/schema.test.ts
```

Expected: FAIL because `seasons` does not exist yet.

**Step 2: Add compatible schema**

In `convex/schema.ts`, add:
- `seasons` table with `year`, `name`, event/camp dates, `departureCutoff`, optional `maxMembers`, `isActive`, `createdAt`, `updatedAt`.
- optional `seasonId` on yearly tables:
  - `applications`
  - `confirmed_members`
  - `ops_signup_rows`
  - `ops_authorizations`
  - `email_allowlist`
  - `ops_manual_invites`
  - `newbie_invites`
- new season indexes, while keeping old indexes.

Do not change runtime queries in this task.

**Step 3: Verify schema tests**

Run:

```bash
npm test -- convex/schema.test.ts
npm run build
```

Expected: PASS.

**Step 4: Commit**

```bash
git add convex/schema.ts convex/schema.test.ts
git commit -m "feat: add compatible season schema"
```

### Task 3: Add Season Admin Helpers Without Runtime Dependency

**Files:**
- Create: `convex/seasons.ts`
- Create: `convex/seasons.test.ts`

**Step 1: Write failing tests**

Test:
- `ensureSeasonForConfiguredYear` creates a season from `CONFIG_DEFAULTS`.
- the mutation is ops-password protected.
- it marks only one season active.
- lookup returns `null` rather than throwing when no active season exists.

Run:

```bash
npm test -- convex/seasons.test.ts
```

Expected: FAIL because `convex/seasons.ts` does not exist.

**Step 2: Implement helpers**

Create:
- `getActiveSeason(ctx)` helper returning `Doc<"seasons"> | null`.
- `ensureSeasonForConfiguredYear` mutation requiring `opsPassword`.

Do not use these helpers from application/payment/member flows yet.

**Step 3: Verify**

Run:

```bash
npm test -- convex/seasons.test.ts
npm run build
```

Expected: PASS.

**Step 4: Commit**

```bash
git add convex/seasons.ts convex/seasons.test.ts
git commit -m "feat: add season admin helpers"
```

### Task 4: Add Dry-Run Production Audit

**Files:**
- Modify: `convex/migrations.ts`
- Create: `convex/seasonsMigration.test.ts`

**Step 1: Write failing tests**

Test dry-run output counts unscoped records in:
- `applications`
- `confirmed_members`
- `ops_signup_rows`
- `ops_authorizations`
- `email_allowlist`
- `ops_manual_invites`
- `newbie_invites`

Run:

```bash
npm test -- convex/seasonsMigration.test.ts
```

Expected: FAIL because audit mutation does not exist.

**Step 2: Implement dry-run audit**

Add an ops-protected mutation:

```ts
auditSeasonBackfill({ opsPassword, year: "2026" })
```

It must return counts only. It must not write.

**Step 3: Verify**

Run:

```bash
npm test -- convex/seasonsMigration.test.ts
npm run build
```

Expected: PASS.

**Step 4: Commit**

```bash
git add convex/migrations.ts convex/seasonsMigration.test.ts
git commit -m "feat: add season backfill audit"
```

### Task 5: Deploy Schema and Audit Only

**Files:**
- No new code beyond Tasks 2-4.

**Step 1: Run full local verification**

Run:

```bash
npm test
npm run build
```

Expected: PASS.

**Step 2: Deploy schema/helper/audit changes**

Use the project’s normal deploy path.

Expected: production behavior is unchanged because runtime application/member queries have not changed.

**Step 3: Run production audit**

Run Convex audit mutation with ops password.

Expected: counts are captured before any writes.

**Step 4: Save audit results**

Add a dated note under `docs/ops-runbook.md` or a new migration note with:
- audit date
- table counts
- expected backfill target season
- operator

### Task 6: Backfill 2026 Season IDs

**Files:**
- Modify: `convex/migrations.ts`
- Modify: `convex/seasonsMigration.test.ts`

**Step 1: Write failing tests**

Test:
- backfill patches only rows missing `seasonId`.
- backfill does not overwrite existing `seasonId`.
- backfill returns updated/skipped counts.
- second run is idempotent.

Run:

```bash
npm test -- convex/seasonsMigration.test.ts
```

Expected: FAIL because write mode does not exist.

**Step 2: Implement write mode**

Add:

```ts
backfillSeasonIds({ opsPassword, seasonId, dryRun })
```

Require `dryRun: false` explicitly for writes.

**Step 3: Verify locally**

Run:

```bash
npm test -- convex/seasonsMigration.test.ts
npm run build
```

Expected: PASS.

**Step 4: Deploy and run dry-run**

Run production dry-run and compare counts to Task 5 audit.

Expected: no unexpected table count changes.

**Step 5: Run production backfill**

Run write mode once.

Expected: all intended unscoped rows receive 2026 `seasonId`.

**Step 6: Run audit again**

Expected: unscoped yearly row counts are zero or explicitly explained.

**Step 7: Commit**

```bash
git add convex/migrations.ts convex/seasonsMigration.test.ts docs/ops-runbook.md
git commit -m "feat: add season backfill migration"
```

### Task 7: Switch Writes to Active Season

**Files:**
- Modify: `convex/applications.ts`
- Modify: `convex/opsManualInvites.ts`
- Modify: `convex/newbieInvites.ts`
- Modify: `convex/confirmedMembers.ts`
- Modify: `convex/opsSignupRows.ts`
- Tests: create focused season behavior tests.

**Step 1: Write failing tests**

Cover:
- new applications get active `seasonId`.
- user can apply in a new season even if they applied in a past season.
- user cannot apply twice in the same season.
- manual invites get active `seasonId`.
- newbie invites get active `seasonId`.
- confirmed member rows get active/application `seasonId`.
- ops projection rows copy application `seasonId`.

Run focused tests.

Expected: FAIL on current lifetime behavior.

**Step 2: Implement write changes**

Use active season for new yearly records only. Do not change read paths in this task.

**Step 3: Verify**

Run:

```bash
npm test
npm run build
```

Expected: PASS.

**Step 4: Commit**

```bash
git add convex src
git commit -m "feat: scope new yearly writes to active season"
```

### Task 8: Switch Reads to Active Season

**Files:**
- Modify: `convex/applications.ts`
- Modify: `convex/confirmedMembers.ts`
- Modify: `convex/newbieInvites.ts`
- Modify: `convex/opsManualInvites.ts`

**Step 1: Write failing tests**

Cover:
- `getMyApplication` returns active-season application.
- capacity counts active-season confirmed applications only.
- ops review queues only include active season.
- ops signup/member views only include active season.
- sponsor eligibility uses active-season confirmed alumni.
- old seasons are not mixed into current ops counts.

Run focused tests.

Expected: FAIL where current code uses lifetime `by_userId`, `by_email`, or `by_status`.

**Step 2: Implement read changes**

After backfill has been verified, switch reads to season-scoped indexes.

**Step 3: Verify**

Run:

```bash
npm test
npm run build
```

Expected: PASS.

**Step 4: Commit**

```bash
git add convex src
git commit -m "feat: scope current-year reads to active season"
```

### Task 9: Add Teams Schema

**Files:**
- Modify: `convex/schema.ts`
- Create: `convex/teams.ts`
- Create: `convex/teams.test.ts`

**Step 1: Write failing tests**

Test:
- teams are scoped by `seasonId`.
- one person can hold multiple assignments.
- assignments support roles `captain`, `manager`, and `turk`.
- manager/turk assignments can point to parent assignments.

Run:

```bash
npm test -- convex/teams.test.ts
```

Expected: FAIL because Teams do not exist.

**Step 2: Implement schema and mutations**

Add:
- `teams`: `seasonId`, `name`, optional `description`, `sortOrder`, timestamps.
- `team_assignments`: `seasonId`, `teamId`, role, optional `parentAssignmentId`, optional `applicationId`, optional `userId`, `displayName`, timestamps.

Do not enforce unique assignment per person; the product requirement allows multiple roles and positions.

**Step 3: Verify**

Run:

```bash
npm test -- convex/teams.test.ts
npm run build
```

Expected: PASS.

**Step 4: Commit**

```bash
git add convex/schema.ts convex/teams.ts convex/teams.test.ts
git commit -m "feat: add season-scoped teams model"
```

### Task 10: Build Ops Teams Page

**Files:**
- Modify: `src/app/ops/layout.tsx`
- Create: `src/app/ops/teams/page.tsx`
- Create: `src/components/ops/TeamsManager.tsx`
- Tests: component tests if local patterns allow.

**Step 1: Build read-only skeleton first**

Create `/ops/teams` showing current-season teams grouped as:

```text
Team
  Captain assignments
  Manager assignments
  Turk assignments
```

**Step 2: Add assignment controls**

Ops can:
- create/edit team name
- add Captain
- add Manager
- add Turk placeholder
- remove assignment

Use existing ops password/session pattern.

**Step 3: Verify**

Run:

```bash
npm test
npm run build
```

Expected: PASS.

**Step 4: Commit**

```bash
git add src convex
git commit -m "feat: add ops teams manager"
```

### Task 11: Build Member Teams Page

**Files:**
- Create: `src/app/teams/page.tsx`
- Create: `src/components/teams/TeamsHierarchy.tsx`

**Step 1: Create read-only hierarchy**

Show active-season Teams to signed-in members.

**Step 2: Handle empty states**

Include clear empty states:
- no Teams created
- Team has no Captain
- Manager has no Turks

**Step 3: Verify**

Run:

```bash
npm test
npm run build
```

Expected: PASS.

**Step 4: Commit**

```bash
git add src
git commit -m "feat: add member teams hierarchy"
```

## Final Verification

Before opening a PR:

```bash
npm test
npm run build
git status --short
```

Expected:
- all tests pass
- build passes
- only intentional files changed

## Rollback Plan

If anything goes wrong before read paths are switched, disable usage by not calling season helpers from runtime flows. Schema additions with optional fields can remain.

If anything goes wrong after read paths are switched, deploy a revert that returns reads to the pre-season indexes. Do not delete season data during rollback.
