# Dementha Landing + Signup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Launch a Dementha-branded landing page plus a reservation signup flow that persists submissions in Convex, enforces departure-cutoff rules, charges a reservation fee via Stripe, and logs every important event for later auditing.

**Architecture:** Next.js 14 App Router deployed to Vercel handles the UI; Convex provides persisted storage, auth, and custom functions (mutations/actions) that encapsulate business rules and event logging. Stripe Checkout processes reservation payments with webhook confirmation feeding back into Convex. Domain logic (validation, cutoff enforcement, WhatsApp requirement, logging payload builders) lives in shared TypeScript modules that are unit-tested with Vitest. Event logs are written into a Convex table so Ops can inspect them from a simple admin screen.

**Tech Stack:** Next.js 14, React 18, Tailwind CSS, Convex, @convex-dev/auth, Stripe Checkout/API, React Hook Form, Zod, dayjs (date math), Vitest, Testing Library, TypeScript.

---

### Task 1: Scaffold Next.js + Tailwind workspace

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `postcss.config.mjs`, `tailwind.config.ts`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`

**Step 1: Generate the project skeleton**

Run: `npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir`
Expected: CLI creates the starter with the App Router, Tailwind, eslint, and src directory formatting.

**Step 2: Verify dev server boots**

Run: `pnpm dev`
Expected: Default Next.js starter splash renders at http://localhost:3000.

**Step 3: Commit baseline**

```bash
git add .
git commit -m "chore: scaffold next app"
```

---

### Task 2: Install shared dependencies + configure testing

**Files:**
- Modify: `package.json`, `tsconfig.json`
- Create: `vitest.config.ts`, `src/test/setup.ts`

**Step 1: Add runtime deps**

Run: `pnpm add @convex-dev/auth convex @convex-dev/auth/react @convex-dev/auth/server @convex/listener react-hook-form zod dayjs clsx @stripe/stripe-js stripe @tanstack/react-query`.

**Step 2: Add dev/test deps**

Run: `pnpm add -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom ts-node @types/node @types/react-dom @types/jsonwebtoken`
Expected: package.json lists scripts `"test": "vitest"` and `"test:ci": "vitest run"`.

**Step 3: Configure Vitest**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: { reporter: ['text', 'lcov'] },
  },
});
```

Create `src/test/setup.ts` importing `@testing-library/jest-dom` and clearing mocks in `afterEach`.

**Step 4: Run tests to confirm harness**

Run: `pnpm vitest`
Expected: PASS with zero tests collected.

**Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts src/test/setup.ts
git commit -m "chore: add deps and vitest"
```

---

### Task 3: Initialize Convex + auth scaffolding

**Files:**
- Create: `convex/tsconfig.json`, `convex/auth.config.ts`, `convex/schema.ts`
- Modify: `.env.local`, `.gitignore`

**Step 1: Run Convex init**

Run: `npx convex dev --once`
Expected: `convex/` directory with generated client files appears.

**Step 2: Configure gitignore/env**

Add `.env.local` entries:

```
NEXT_PUBLIC_CONVEX_URL=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
RESERVATION_FEE_CENTS=
```
Ignore `.env.local` and `.convex/`.

**Step 3: Auth config**

Create `convex/auth.config.ts` using `createAuthConfig` with email magic-link provider, linking to Convex docs. Set session cookie name `dementhaAuth`.

**Step 4: Register Convex in Next**

Add `"convex": "npx convex"` script and ensure `ConvexProviderWithAuth` will live in `app/providers.tsx` later.

**Step 5: Commit**

```bash
git add convex .env.local.example .gitignore package.json pnpm-lock.yaml
git commit -m "chore: init convex"
```

---

### Task 4: Define Convex schema (applications, ops_authorizations, event_logs, config)

**Files:**
- Modify: `convex/schema.ts`

**Step 1: Write failing schema tests**

In `convex/schema.test.ts` (run via Vitest with `ts-node`), assert exported tables include `applications`, `ops_authorizations`, `event_logs`, `config`. Write tests verifying validation of `status` union and indexes (arrival/departure, status).
Run: `pnpm vitest convex/schema.test.ts`
Expected: FAIL (tables not defined yet).

**Step 2: Implement schema**

Define tables:

```ts
const applications = defineTable({
  firstName: v.string(),
  lastName: v.string(),
  email: v.string(),
  phone: v.string(),
  arrival: v.string(),
  departure: v.string(),
  status: v.union(v.literal('draft'), v.literal('pending_payment'), v.literal('needs_ops_review'), v.literal('payment_processing'), v.literal('confirmed'), v.literal('rejected')),
  dietaryPreference: v.string(),
  allergyFlag: v.boolean(),
  allergyNotes: v.optional(v.string()),
  checkoutSessionId: v.optional(v.string()),
  earlyDepartureRequested: v.boolean(),
  paymentAllowed: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
});
```

Add `ops_authorizations` (applicationId, approverEmail, status, expiresAt). Add `event_logs` (applicationId optional, stripeSessionId optional, eventType, payload, actor, createdAt) with indexes on `applicationId` and `createdAt`. Add `config` table storing key/value JSON for `departureCutoff`, dates, dues amount.

**Step 3: Re-run tests**

`pnpm vitest convex/schema.test.ts` → PASS.

**Step 4: Commit**

```bash
git add convex/schema.ts convex/schema.test.ts
git commit -m "feat: define convex schema"
```

---

### Task 5: Global config helpers for cutoff/dates

**Files:**
- Create: `convex/config.ts`, `src/config/content.ts`
- Modify: `convex/schema.ts` (ensure config table JSON typed)

**Step 1: Config query + mutation**

In `convex/config.ts`, add `getConfig` query returning merged defaults and DB overrides, and `setConfig` mutation (admin use).

**Step 2: Frontend config hook**

`src/config/content.ts` exports `getLandingContent(config)` deriving hero copy, Burning Man + Dementha dates, dues amount, and `departureCutoff` as ISO string.

**Step 3: Unit tests**

Create `src/config/content.test.ts` verifying fallback defaults and overrides. Run `pnpm vitest src/config/content.test.ts`.

**Step 4: Commit**

```bash
git add convex/config.ts src/config/content.ts src/config/content.test.ts
git commit -m "feat: config helpers"
```

---

### Task 6: Domain types + validation utilities (w/ tests)

**Files:**
- Create: `src/lib/applications/types.ts`, `src/lib/applications/validation.ts`, `src/lib/applications/errors.ts`
- Create tests: `src/lib/applications/validation.test.ts`

**Step 1: Write failing tests**

In `validation.test.ts`, import `validateApplicationInput` (to be created) and assert it rejects: missing WhatsApp phone, departure before arrival, departure before config cutoff (should set `needsOpsReview` flag but still return sanitized payload), unsupported dietary values. Include positive test verifying sanitized object.
Run `pnpm vitest src/lib/applications/validation.test.ts` → FAIL.

**Step 2: Implement validation**

Use Zod to define `ApplicationPayloadSchema`. Implement `validateApplicationInput(raw, config)` returning `{ payload, requiresOpsReview, errors }`. Always include `requiresOpsReview=true` when departure < cutoff; do not throw, but include message for UI.

**Step 3: Phone + WhatsApp enforcement**

Add helper `assertWhatsApp(phone: string)` checking E.164 via regex and returning canonical form; unit-test separately.

**Step 4: Re-run tests**

`pnpm vitest src/lib/applications/validation.test.ts` → PASS.

**Step 5: Commit**

`git add src/lib/applications && git commit -m "feat: application validation"`

---

### Task 7: Event logging infrastructure

**Files:**
- Create: `convex/eventLogs.ts`, `convex/lib/events.ts`
- Tests: `src/lib/events/eventPayload.test.ts`

**Step 1: Implement mutation**

`storeEvent` mutation inserts event row with type, payload, actor, correlation IDs. Enforce payload size limit (encode via `JSON.stringify`).

**Step 2: Helper**

`convex/lib/events.ts` exports `logEvent(ctx, details)` and `EVENT_TYPES` union. Provide typed builders for `form_submitted`, `invalid_departure`, `payment_initiated`, `payment_success`, `payment_failed`, `ops_override_granted`, `ops_override_denied`, `webhook_error`.

**Step 3: Unit tests**

`eventPayload.test.ts` ensures builders output normalized payload + metadata. Run `pnpm vitest src/lib/events/eventPayload.test.ts`.

**Step 4: Commit**

`git add convex/eventLogs.ts convex/lib/events.ts src/lib/events && git commit -m "feat: event logging helpers"`

---

### Task 8: Convex mutations/actions for applications + payments

**Files:**
- Create: `convex/applications.ts`, `convex/payments.ts`
- Modify: `convex/_generated/server.ts` (generated import), `package.json` (stripe config script)

**Step 1: createDraftApplication mutation**

Implements:
- Calls `validateApplicationInput`
- Writes application row with status `needs_ops_review` if cutoff violation else `pending_payment`
- Sets `paymentAllowed` false when review required
- Calls `logEvent` with `form_submitted` and `invalid_departure` when applicable
- Returns application ID + flags for UI

**Step 2: setOpsOverride mutation**

Allows authorized Ops user to approve early departure: updates `ops_authorizations`, flips `paymentAllowed`, logs `ops_override_*` event.

**Step 3: createReservationCheckout action**

Guards `paymentAllowed` true. Uses `stripe.checkout.sessions.create` with reservation amount from config, success/cancel URLs. Stores session ID + status `payment_processing`, logs event.

**Step 4: handleCheckoutWebhook mutation**

Expects Stripe session ID, verifies amount + status, updates application to `confirmed`, logs `payment_success` or `payment_failed`.

**Step 5: Tests**

Create `src/lib/applications/statusTransitions.test.ts` mocking helper functions to ensure `needs_ops_review` logic and event calls. Run `pnpm vitest src/lib/applications/statusTransitions.test.ts`.

**Step 6: Commit**

`git add convex/applications.ts convex/payments.ts src/lib/applications/statusTransitions.test.ts && git commit -m "feat: application mutations"`

---

### Task 9: Stripe webhook route handler

**Files:**
- Create: `app/api/stripe/webhook/route.ts`
- Tests: `src/app/api/stripe/webhook/route.test.ts`

**Step 1: Implement route**

Use Next.js Route Handler with `POST` receiving raw body. Verify signature via `stripe.webhooks.constructEvent`. On `checkout.session.completed`, call Convex mutation `handleCheckoutWebhook` with session ID + metadata. For other events, log and return 200.

**Step 2: Unit test handler**

Mock Stripe library to throw on invalid signature and assert we return 400. Validate success flow calls Convex client. Run `pnpm vitest src/app/api/stripe/webhook/route.test.ts` (use `node` env).

**Step 3: Commit**

`git add app/api/stripe/webhook src/app/api/stripe/webhook/route.test.ts && git commit -m "feat: stripe webhook"`

---

### Task 10: Convex + Auth providers in Next layout

**Files:**
- Create: `app/providers.tsx`
- Modify: `app/layout.tsx`

**Step 1: Implement provider**

Wrap children with `ConvexProviderWithAuth` from `@convex-dev/auth/react`, pass `ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!)`. Provide `SignedIn`/`SignedOut` boundaries.

**Step 2: Layout wiring**

Update `app/layout.tsx` to include global fonts, `<Providers>` component, metadata (title, description), and `<Toaster>` for notifications (install `sonner` or similar if desired).

**Step 3: Commit**

`git add app/providers.tsx app/layout.tsx && git commit -m "feat: add convex providers"`

---

### Task 11: Marketing landing page content

**Files:**
- Modify/Create: `app/page.tsx`, `src/components/marketing/Hero.tsx`, `src/components/marketing/Stats.tsx`, `src/components/marketing/Expectations.tsx`, `src/data/landingContent.ts`

**Step 1: Content data**

Use `src/data/landingContent.ts` to export arrays for expectation cards (reservation fee, WhatsApp requirement, departure commitment). Pull config for dates + dues.

**Step 2: Components**

Build hero with CTA to `/apply`, stats tiles showing Burning Man + DeMentha dates + dues. Use Tailwind for layout.

**Step 3: Page assembly**

`app/page.tsx` stitches hero + expectation sections, ensures metadata tags for SEO.

**Step 4: Snapshot test**

Add `src/components/marketing/__tests__/Hero.test.tsx` verifying CTA text/dates render from config stub. Run `pnpm vitest src/components/marketing/__tests__/Hero.test.tsx`.

**Step 5: Commit**

`git add app/page.tsx src/components/marketing src/data/landingContent.ts && git commit -m "feat: marketing landing page"`

---

### Task 12: Application form UI + client validation

**Files:**
- Create: `app/apply/page.tsx`, `src/components/forms/ApplicationForm.tsx`, `src/components/forms/DepartureNotice.tsx`, `src/components/forms/Field.tsx`
- Tests: `src/components/forms/ApplicationForm.test.tsx`

**Step 1: Build form component**

Use `react-hook-form` with Zod resolver to enforce same schema as backend. Fields: name, email, phone, arrival/departure datetime inputs, dietary dropdown, allergy toggle + textarea. Show `DepartureNotice` when `requiresOpsReview` flag flips (rendered after submission response).

**Step 2: Hook to Convex**

On submit, call `useMutation(api.applications.createDraftApplication)`; if response returns `paymentAllowed=false`, show review message and disable payment button. When allowed, show payment button that triggers `createReservationCheckout` mutation.

**Step 3: Unit test**

Test that entering early departure surfaces review banner + disables payment. Use Testing Library + msw to mock Convex responses. Run `pnpm vitest src/components/forms/ApplicationForm.test.tsx`.

**Step 4: Commit**

`git add app/apply/page.tsx src/components/forms && git commit -m "feat: application form"`

---

### Task 13: Payment initiation + confirmation screens

**Files:**
- Create: `src/components/forms/PaymentCTA.tsx`, `app/apply/success/page.tsx`, `app/apply/error/page.tsx`

**Step 1: Payment CTA**

`PaymentCTA` renders Stripe Checkout button. On click, call Convex action to get session ID, then redirect via `loadStripe`. Log client console on failure.

**Step 2: Success + error routes**

`/apply/success` thanks the member, reiterates WhatsApp instructions. `/apply/error` allows them to retry linking to `createReservationCheckout` again.

**Step 3: Tests**

Unit-test `PaymentCTA` to ensure button disabled when `paymentAllowed=false` and that `loadStripe` invoked; mock `loadStripe`. Run `pnpm vitest src/components/forms/PaymentCTA.test.tsx`.

**Step 4: Commit**

`git add app/apply/success app/apply/error src/components/forms/PaymentCTA.tsx && git commit -m "feat: payment cta and confirmations"`

---

### Task 14: Ops review + log viewer pages

**Files:**
- Create: `app/ops/layout.tsx`, `app/ops/review/page.tsx`, `app/ops/logs/page.tsx`, `src/components/ops/ReviewTable.tsx`, `src/components/ops/EventLogTable.tsx`, `src/components/ops/AuthGate.tsx`

**Step 1: Simple auth gate**

Implement middleware or `AuthGate` component requiring signed-in user with `role === 'ops'` stored via Convex `users` table or config list. Deny unauthorized.

**Step 2: Review table**

Query `api.applications.listNeedingReview` and display rows with arrival/departure, reason, contact info, action buttons to approve/deny (calls `setOpsOverride`). Show log snippet per row.

**Step 3: Logs page**

List recent events by `createdAt` with filters for application ID / type. Provide search input hitting `eventLogs.page` query with pagination.

**Step 4: Tests**

Add `src/components/ops/ReviewTable.test.tsx` verifying button disabled when mutation pending and that status labels render. Run `pnpm vitest src/components/ops/ReviewTable.test.tsx`.

**Step 5: Commit**

`git add app/ops src/components/ops && git commit -m "feat: ops review + logs"`

---

### Task 15: Logging guarantees + error boundaries

**Files:**
- Modify: `convex/applications.ts`, `convex/payments.ts`, `app/apply/page.tsx`
- Create tests: `src/lib/logging/logging.test.ts`

**Step 1: Wrap Convex mutations**

Ensure every mutation/action catches errors, logs `webhook_error`/`mutation_failed` events, and rethrows sanitized error message for UI.

**Step 2: Frontend error boundary**

Add React error boundary around `/apply` form to show fallback message and log to console. Provide instrumentation hook to call `logClientEvent` (convex action writing to `event_logs` with actor `client`).

**Step 3: Tests**

Add tests ensuring `logEvent` called when `createReservationCheckout` rejects. Use Vitest spies. Run `pnpm vitest src/lib/logging/logging.test.ts`.

**Step 4: Commit**

`git add convex/applications.ts convex/payments.ts app/apply/page.tsx src/lib/logging && git commit -m "feat: harden logging"`

---

### Task 16: End-to-end testing + QA checklist

**Files:**
- Create: `tests/e2e/applicationFlow.test.ts` (Playwright or Cypress)
- Modify: `package.json` scripts (`"test:e2e"`)

**Step 1: Configure Playwright**

`pnpm create playwright@latest` targeting Chromium only. Add env overrides for Stripe via test keys/mocks.

**Step 2: Write scenario**

Test flows: (a) normal arrival/departure -> payment allowed; (b) early departure -> review message and payment blocked; (c) Ops override -> payment allowed after reloading. Use mock Stripe via `stripe-mock` or intercept network.

**Step 3: Run e2e**

`pnpm test:e2e` expecting PASS locally.

**Step 4: Commit**

`git add tests/e2e package.json playwright.config.ts && git commit -m "test: add e2e coverage"`

---

### Task 17: Deployment, environment, and monitoring checklist

**Files:**
- Create: `vercel.json`, `README.md`, `.env.production`

**Step 1: Document env vars**

In README, list each env var (Convex deployment URL, Stripe keys, reservation fee amount, WhatsApp ops email) and how to obtain.

**Step 2: Vercel config**

`vercel.json` sets build command `pnpm run build`, includes header to deny `/ops/*` caching, and rewrites `/api/stripe/webhook` to Edge function disabled.

**Step 3: Convex deployment**

Run `npx convex deploy` and note deployment URL. Configure `convex.json` if needed for prod.

**Step 4: Monitoring**

Document how to inspect `event_logs` via Convex dashboard and Next.js logging on Vercel. Include instructions to export logs with `convex query eventLogs.list`.

**Step 5: Commit**

`git add vercel.json README.md && git commit -m "docs: deployment + env"`

---

### Task 18: Launch checklist + communications

**Files:**
- Create: `docs/ops-runbook.md`

**Step 1: Write runbook**

Document process for OPS: checking review queue, granting overrides, confirming Stripe receipts, contacting applicants.

**Step 2: Include logging SOP**

Add instructions on filtering `event_logs` for specific application ID.

**Step 3: Review spec dependencies**

Ensure Stripe account ready, OPS email defined, alumni email copy tracked via `docs/ops-runbook.md`.

**Step 4: Commit**

`git add docs/ops-runbook.md && git commit -m "docs: ops runbook"`

