# DeMentha Ops Runbook

This document describes standard operating procedures for managing the DeMentha reservation system.

## Access

The Ops Portal is available at `/ops` and requires authorized access.

### Authorized Users

Add authorized ops emails to the Convex config:
```bash
npx convex run config:setConfig --args '{"key": "opsEmails", "value": "[\"ops@dementha.com\", \"admin@dementha.com\"]"}'
```

## Daily Tasks

### 1. Check Review Queue

**Location**: `/ops/review`

1. Navigate to the Review Queue
2. Review each pending application:
   - Check applicant's requested departure date
   - Review reason for early departure (if provided)
   - Verify contact information is valid
3. Take action:
   - **Approve**: Click "Approve" to allow payment
   - **Deny**: Click "Deny" to reject the application
4. Add notes for context (optional but recommended)

### 2. Monitor Event Logs

**Location**: `/ops/logs`

1. Check for any `webhook_error` or `mutation_failed` events
2. Review recent `payment_failed` events - may need to contact applicants
3. Verify `payment_success` events are being recorded properly

## Handling Early Departure Requests

When an applicant requests to leave before the cutoff date (default: September 1):

1. The system automatically flags their application as `needs_ops_review`
2. They cannot proceed to payment until approved
3. Review the request considering:
   - Camp staffing needs for those dates
   - Whether they've committed to specific shifts
   - Reason for early departure
4. Contact via WhatsApp if clarification needed
5. Approve or deny with notes

## Payment Issues

### Failed Payments

1. Check `/ops/logs` for `payment_failed` events
2. Common causes:
   - Card declined
   - Session expired (30 min timeout)
   - User cancelled
3. Application reverts to `pending_payment` status
4. User can try again from `/apply`

### Missing Confirmation

If applicant claims payment succeeded but isn't confirmed:

1. Check Stripe Dashboard for the payment
2. Look for corresponding `payment_success` event in logs
3. If payment exists in Stripe but not logged:
   - Check for `webhook_error` events
   - Manually verify webhook configuration
   - May need to manually update status

## Stripe Webhook

**Endpoint**: `/api/stripe/webhook`

### Webhook Events Handled

- `checkout.session.completed` - Payment successful
- `checkout.session.expired` - Session timeout
- `checkout.session.async_payment_failed` - Delayed payment failure

### Troubleshooting

1. Verify webhook secret is configured correctly
2. Check Stripe Dashboard > Developers > Webhooks for delivery status
3. Review `webhook_error` events in logs

## Database Queries

### Via Convex Dashboard

1. Go to [Convex Dashboard](https://dashboard.convex.dev)
2. Select your project
3. Browse tables: `applications`, `event_logs`, `config`

### Via CLI

```bash
# List all applications
npx convex run applications:list

# List applications needing review
npx convex run applications:listNeedingReview

# Get recent events
npx convex run eventLogs:listRecent --args '{"limit": 100}'

# Get events for specific application
npx convex run eventLogs:getByApplicationId --args '{"applicationId": "<application_id>"}'

# Get events by type
npx convex run eventLogs:getByEventType --args '{"eventType": "payment_failed", "limit": 50}'
```

## Configuration

### View Current Config

```bash
npx convex run config:getConfig
```

### Update Config

```bash
# Update reservation fee (in cents)
npx convex run config:setConfig --args '{"key": "reservationFeeCents", "value": "35000"}'

# Update departure cutoff
npx convex run config:setConfig --args '{"key": "departureCutoff", "value": "2025-09-01"}'

# Update camp operational dates
npx convex run config:setConfig --args '{"key": "earliestArrival", "value": "2025-08-22"}'
npx convex run config:setConfig --args '{"key": "latestDeparture", "value": "2025-09-02"}'
```

> **Note**: For static configuration changes, prefer editing `src/config/camp.config.ts` instead.
> The database config is for runtime overrides only.

## Emergency Procedures

### System Down

1. Check Vercel status: https://www.vercel-status.com/
2. Check Convex status: https://status.convex.dev/
3. Check Stripe status: https://status.stripe.com/

### Manual Application Confirmation

If webhook fails but payment succeeded:

```bash
# Find application by email
npx convex run applications:getByEmail --args '{"email": "user@example.com"}'

# Manually update status (requires direct DB access via dashboard)
```

### Refund Process

1. Process refund in Stripe Dashboard
2. Update application status manually if needed
3. Log the action with notes

## Contact

For technical issues:
- Check error logs first
- Document the issue with screenshots
- Contact development team with:
  - Error messages
  - Affected application IDs
  - Timestamp of issue

## Appendix: Event Log Types

| Event Type | Description | Key Payload Fields |
|------------|-------------|-------------------|
| `form_submitted` | New application received | email, name, dates |
| `invalid_departure` | Early departure detected | requestedDeparture, cutoffDate |
| `payment_initiated` | Checkout started | email, amountCents, stripeSessionId |
| `payment_success` | Payment completed | email, amountCents, stripePaymentIntentId |
| `payment_failed` | Payment failed | email, reason |
| `ops_override_granted` | Early departure approved | email, approverEmail, notes |
| `ops_override_denied` | Early departure denied | email, approverEmail, reason |
| `webhook_error` | Webhook processing error | error, webhookType |
| `mutation_failed` | Backend mutation error | mutationName, error |
