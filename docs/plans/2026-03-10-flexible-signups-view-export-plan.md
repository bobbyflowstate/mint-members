# Flexible Signups View + Export Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an ops-friendly, flexible signups table where admins can choose visible columns, sort/filter rows, query across `applications` + `confirmed_members` fields, and export exactly the current view to CSV.

**Architecture:** Introduce a shared `SignupViewState` model (columns, filters, sort, pagination/limit) used by both UI and Convex query args. Add an `ops_signup_rows` projection table keyed by application/user that denormalizes fields from `applications`, `confirmed_members`, and future `userId`-linked tables into a queryable row shape. Server applies filters/sort for consistent results and export safety. CSV export reads the same returned rows + selected columns. Query interpreter is deferred, but future-ready by compiling text into the same `SignupViewState` structure.

**Tech Stack:** Next.js App Router, React 19, Convex queries, TypeScript, existing ops auth gate/session password, client-side CSV download via Blob.

---

## Product Direction (v1)

- Primary experience: table controls (not query text).
- Export behavior: `Export current view`.
- Required colleague scenario support:
  - Filter `Arrival <= Saturday`
  - Visible columns `Name` + `Phone`
  - Export result set

## Future-Ready Constraint

- No interpreter in v1.
- All filters/sorts must be represented in typed view state so a later parser can output that same shape.
- All exportable fields must map to projection columns so new tables can be added without rewriting table UI.

---

### Task 0: Add denormalized ops projection for cross-table querying

**Files:**
- Modify: `convex/schema.ts`
- Create: `convex/opsSignupRows.ts`
- Modify: `convex/applications.ts`
- Modify: `convex/confirmedMembers.ts`
- Create: `convex/opsSignupRows.test.ts`

**Step 1: Add projection table**

Create `ops_signup_rows` with:
- Identity: `applicationId`, `userId`, `email`
- Application fields: name, phone, arrival/departure, status, createdAt
- Confirmed-member fields: ticket/vehicle/requests
- Metadata: `updatedAt`, `sourceVersion`

Add indexes for expected filters/sorts:
- `by_createdAt`
- `by_arrival`
- `by_departure`
- `by_status`
- `by_userId`
- `by_applicationId`

**Step 2: Add projector/upsert helper**

Implement helper function in `convex/opsSignupRows.ts`:
- `upsertOpsSignupRow(ctx, applicationId)`
- Reads application + related confirmed member record and writes one merged row.

**Step 3: Wire projector into write paths**

Call projector after writes in:
- `applications.createDraftApplication`
- `applications.setOpsOverride` (status/payment changes)
- any application status transitions already present
- `confirmedMembers.upsertMine`

**Step 4: Add backfill mutation**

Add admin/backfill mutation to rebuild projections for existing records.

**Step 5: Re-run tests**

Run: `npm test -- convex/opsSignupRows.test.ts`
Expected: PASS.

---

### Task 1: Define shared view-state model (interpreter-ready)

**Files:**
- Create: `src/lib/opsSignupsView/types.ts`
- Create: `src/lib/opsSignupsView/types.test.ts`

**Step 1: Write failing tests for model constraints**

Cover:
- Allowed columns (`firstName`, `lastName`, `fullName`, `email`, `phone`, `arrival`, `arrivalTime`, `departure`, `departureTime`, `status`, `createdAt`).
- Include cross-table columns from projection (`hasBurningManTicket`, `hasVehiclePass`, `requests`).
- Filter operators (`eq`, `contains`, `before`, `after`, `on_or_before`, `on_or_after`, `in`).
- Sort directions (`asc`, `desc`) and single active sort key.

Run: `npm test -- src/lib/opsSignupsView/types.test.ts`
Expected: FAIL.

**Step 2: Implement model and defaults**

Define:
- `SignupColumnId`
- `SignupFilter`
- `SignupSort`
- `SignupViewState`
- `DEFAULT_SIGNUPS_VIEW_STATE`

Add helper:
- `normalizeSignupViewState(input)` for server-safe defaults.

**Step 3: Re-run tests**

Run: `npm test -- src/lib/opsSignupsView/types.test.ts`
Expected: PASS.

---

### Task 2: Implement shared row evaluator for deterministic behavior

**Files:**
- Create: `src/lib/opsSignupsView/evaluate.ts`
- Create: `src/lib/opsSignupsView/evaluate.test.ts`

**Step 1: Write failing tests**

Cover:
- Date comparisons (`arrival on_or_before`, `departure before`).
- Text contains for name/email/phone.
- Status/payment filtering.
- Compound filters (`AND` semantics).

Run: `npm test -- src/lib/opsSignupsView/evaluate.test.ts`
Expected: FAIL.

**Step 2: Implement evaluator + sort comparator**

Create:
- `matchesSignupFilters(signup, filters)`
- `compareSignups(sort, a, b)`

**Step 3: Re-run tests**

Run: `npm test -- src/lib/opsSignupsView/evaluate.test.ts`
Expected: PASS.

---

### Task 3: Add secure Convex query for view-driven signups listing

**Files:**
- Modify: `convex/applications.ts`
- Create: `convex/applicationsSignupsView.test.ts`

**Step 1: Write failing auth tests**

Cover:
- Missing `opsPassword` handling.
- Invalid `opsPassword` rejection.
- Valid password returns filtered rows.

Run: `npm test -- convex/applicationsSignupsView.test.ts`
Expected: FAIL.

**Step 2: Add query**

Add `listSignupsForOpsView` query:
- Args: `{ opsPassword: string, viewState: SignupViewState, limit?: number }`
- Fetch from `ops_signup_rows` via `by_createdAt` descending.
- Apply shared filter/sort.
- Return `{ rows, totalBeforeFilter, totalAfterFilter, truncated }`.

**Step 3: Keep backward compatibility**

Do not break existing `list`/`listSignups` consumers in this pass.

**Step 4: Re-run tests**

Run: `npm test -- convex/applicationsSignupsView.test.ts`
Expected: PASS.

---

### Task 4: Refactor Signups UI to a configurable table view

**Files:**
- Modify: `src/components/ops/SignupsTable.tsx`
- Create: `src/components/ops/SignupsTable.view.test.tsx`

**Step 1: Write failing UI tests**

Cover:
- Toggle visible columns.
- Apply arrival `on_or_before` filter.
- Sort by arrival/date and name.
- Row count updates after filters.

Run: `npm test -- src/components/ops/SignupsTable.view.test.tsx`
Expected: FAIL.

**Step 2: Implement controls**

Add controls:
- Column picker (checkbox list).
- Filter bar:
  - Arrival date operator + date value
  - Departure date operator + date value
  - Payment/status selector
  - Free text search (name/email/phone)
- Sort selector + direction
- Clear filters/reset view button.

**Step 3: Wire to new Convex query**

Use `opsPassword` from session storage and pass normalized `viewState`.

**Step 4: Re-run tests**

Run: `npm test -- src/components/ops/SignupsTable.view.test.tsx`
Expected: PASS.

---

### Task 5: Add “Export Current View” CSV flow

**Files:**
- Create: `src/lib/opsSignupsView/csv.ts`
- Create: `src/lib/opsSignupsView/csv.test.ts`
- Modify: `src/components/ops/SignupsTable.tsx`

**Step 1: Write failing CSV tests**

Cover:
- Header order follows visible column order.
- Proper CSV escaping.
- Exported rows match current filtered/sorted rows.

Run: `npm test -- src/lib/opsSignupsView/csv.test.ts`
Expected: FAIL.

**Step 2: Implement CSV helpers**

Add:
- `buildSignupCsv(rows, visibleColumns)`
- `downloadCsv(filename, content)`

**Step 3: Add export actions**

Buttons:
- `Export current view` (default).
- Optional: `Export all columns` toggle.

Show disabled state when no rows match.

**Step 4: Re-run tests**

Run: `npm test -- src/lib/opsSignupsView/csv.test.ts`
Expected: PASS.

---

### Task 6: Persist view preferences for ops usability

**Files:**
- Modify: `src/components/ops/SignupsTable.tsx`
- Create: `src/lib/opsSignupsView/storage.ts`
- Create: `src/lib/opsSignupsView/storage.test.ts`

**Step 1: Write failing storage tests**

Cover:
- Save/load visible columns, filters, sort.
- Invalid stored state falls back safely.

Run: `npm test -- src/lib/opsSignupsView/storage.test.ts`
Expected: FAIL.

**Step 2: Implement localStorage persistence**

Persist under a stable key (e.g., `ops_signups_view_v1`) with versioning.

**Step 3: Re-run tests**

Run: `npm test -- src/lib/opsSignupsView/storage.test.ts`
Expected: PASS.

---

### Task 7: Add explicit extension seam for future query interpreter

**Files:**
- Create: `src/lib/opsSignupsView/compileViewState.ts`
- Create: `src/lib/opsSignupsView/compileViewState.test.ts`
- Modify: `src/components/ops/SignupsTable.tsx`

**Step 1: Add compile boundary**

Implement:
- `compileViewState(input)` where `input` is currently UI form state.
- This is the future insertion point for query text parser output.

**Step 2: Add tests**

Cover:
- UI state compiles to valid `SignupViewState`.
- Invalid combinations corrected (e.g., missing date with date operator).

Run: `npm test -- src/lib/opsSignupsView/compileViewState.test.ts`
Expected: PASS.

---

### Task 8: Ops docs and acceptance criteria

**Files:**
- Modify: `docs/ops-runbook.md`
- Modify: `README.md`

**Step 1: Document usage**

Add:
- How to build a filtered view.
- How `Export current view` works.
- Example walkthrough for “name + phone arriving Saturday or earlier.”
- Explain that data is sourced from projection rows merged from `applications` + `confirmed_members`.

**Step 2: Document v1 limitations**

State:
- No query interpreter in v1.
- Filters combine with AND.
- Large exports respect server cap (with truncation warning).

---

### Task 9: End-to-end verification

**Files:**
- Create: `tests/e2e/opsSignupsExport.test.ts`

**Step 1: Add e2e flow**

Scenario:
- Open `/ops/signups`.
- Set arrival `on_or_before` to a Saturday.
- Show only `Name` + `Phone`.
- Export current view and assert CSV header/body.

**Step 2: Run validation suite**

Run:
- `npm test -- src/lib/opsSignupsView/*.test.ts`
- `npm test -- convex/applicationsSignupsView.test.ts src/components/ops/SignupsTable.view.test.tsx`
- `npm run test:e2e -- --grep "ops signups export"`

Expected: PASS.

---

## Non-Goals (v1)

- Natural-language query interpreter UI.
- Saved named views shared across admins.
- Background async export jobs.

## Performance Strategy

- Use `ops_signup_rows` projection to avoid runtime N-way joins per request.
- Keep indexed fields for common date/status sorts and filters.
- Apply broad prefilter via index, then in-memory refine for complex combinations.
- Enforce server limits (for example 5,000 rows) with explicit `truncated` warnings in UI/export.
- Add backfill + consistency checks so projection can be rebuilt safely if schema evolves.

## v2 Follow-ups

- Query interpreter that compiles text into `SignupViewState`.
- Saved reusable presets.
- Additional boolean logic (`OR`, grouped conditions).
- Extend projector to additional `userId`-linked tables via a small field-mapping registry.
