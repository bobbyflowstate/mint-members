# DeMentha Camp Reservation System

A modern reservation and signup system for DeMentha camp at Burning Man. Built with Next.js, Convex, and Stripe.

## Features

- 🎫 **Member Reservations** - Apply and pay for camp spots
- 📅 **Date Validation** - Automatic early departure detection with ops review workflow
- 💳 **Stripe Payments** - Secure payment processing via Stripe Checkout
- 📱 **WhatsApp Integration** - Phone validation with auto-formatting for WhatsApp communication
- 👥 **Ops Portal** - Admin dashboard for reviewing applications and viewing logs
- 📊 **Event Logging** - Complete audit trail of all actions

## Tech Stack

- **Frontend**: Next.js 16, React 19, Tailwind CSS
- **Backend**: Convex (database, functions, auth)
- **Payments**: Stripe Checkout
- **Testing**: Vitest, Playwright
- **Forms**: React Hook Form, Zod

## Getting Started

### Prerequisites

- Node.js 20+
- npm or pnpm
- Convex account
- Stripe account

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd mint-members
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.local.example .env.local
   ```

4. Configure your `.env.local`:
   ```
   NEXT_PUBLIC_CONVEX_URL=<your-convex-deployment-url>
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<your-stripe-publishable-key>
   STRIPE_SECRET_KEY=<your-stripe-secret-key>
   STRIPE_WEBHOOK_SECRET=<your-stripe-webhook-secret>
   ```

5. Start Convex:
   ```bash
   npx convex dev
   ```

6. Start the development server:
   ```bash
   npm run dev
   ```

7. Open [http://localhost:3000](http://localhost:3000)

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_CONVEX_URL` | Your Convex deployment URL | Yes |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (pk_test_... or pk_live_...) | Yes |
| `STRIPE_SECRET_KEY` | Stripe secret key (sk_test_... or sk_live_...) | Yes |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (whsec_...) | Yes |

### Getting Environment Variables

1. **Convex URL**: Run `npx convex dev` and copy the deployment URL from the output
2. **Stripe Keys**: Get from [Stripe Dashboard](https://dashboard.stripe.com/apikeys)
3. **Webhook Secret**: Create a webhook endpoint in Stripe Dashboard pointing to `/api/stripe/webhook`

## Scripts

```bash
# Development
npm run dev          # Start Next.js dev server
npm run convex       # Run Convex CLI commands

# Testing
npm run test         # Run unit tests (Vitest)
npm run test:ci      # Run tests in CI mode
npm run test:e2e     # Run e2e tests (Playwright)

# Build & Deploy
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

## Project Structure

```
├── convex/              # Convex backend
│   ├── applications.ts  # Application mutations/queries
│   ├── payments.ts      # Payment mutations
│   ├── paymentsActions.ts # Stripe action (Node.js runtime)
│   ├── eventLogs.ts     # Event logging
│   ├── config.ts        # Configuration
│   └── schema.ts        # Database schema
├── src/
│   ├── app/            # Next.js App Router pages
│   │   ├── apply/      # Application form & confirmation pages
│   │   ├── ops/        # Ops admin portal
│   │   └── api/        # API routes (Stripe webhook)
│   ├── components/     # React components
│   │   ├── marketing/  # Landing page components
│   │   ├── forms/      # Form components
│   │   └── ops/        # Ops portal components
│   ├── config/         # Configuration helpers
│   └── lib/            # Utilities
│       ├── applications/ # Validation & types
│       └── logging/    # Client-side logging
├── tests/
│   └── e2e/           # Playwright e2e tests
└── docs/
    └── plans/         # Implementation plans
```

## Deployment

### Vercel (Recommended)

1. Connect your repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Deploy

### Convex Production

```bash
npx convex deploy
```

## Monitoring

### Event Logs

View event logs via:
- Ops Portal: `/ops/logs`
- Convex Dashboard: Browse `event_logs` table
- CLI: `npx convex run eventLogs:listRecent`

### Log Types

- `form_submitted` - Application submitted
- `invalid_departure` - Early departure detected
- `payment_initiated` - Stripe checkout started
- `payment_success` - Payment completed
- `payment_failed` - Payment failed/cancelled
- `ops_override_granted` - Early departure approved
- `ops_override_denied` - Early departure denied
- `webhook_error` - Stripe webhook error
- `mutation_failed` - Backend error

## Contributing

1. Create a feature branch
2. Make changes
3. Run tests: `npm run test:ci`
4. Run lint: `npm run lint`
5. Submit PR

## License

Private - DeMentha Camp
