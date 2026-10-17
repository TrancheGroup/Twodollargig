# TwoDollarGig

**TwoDollarGig** is a mobile-first, free true net hourly earnings calculator for Uber, DoorDash, Instacart, Lyft, Amazon Flex, and other gig workers.

The free calculator **never requires a signup**, instantly recalculates in the browser, saves only its *current* scenario in device localStorage, and exports CSV or prints to PDF at no cost.

## Run locally

Prerequisites: Node 20+.

    npm ci
    npm test
    npm run build
    npm run verify
    npm run dev

Open http://localhost:4173/. The preview server is static and does not emulate Netlify functions. To test the billing functions locally after adding credentials, use Netlify CLI `netlify dev`.

## Tax/earnings model (2026)

* **Gross earnings**: platform payouts and tips entered by the user.
* **Cash vehicle cost**: business miles × editable gas-per-mile + business miles × editable nonfuel vehicle-wear cost. For exact gas spending, choose "Total spent"; these methods are alternatives.
* **Other costs**: additional cash expenses not already in vehicle assumptions.
* **2026 IRS standard business mileage deduction**: 72.5¢/mile for Jan 1–Jun 30; 76¢/mile for Jul 1–Dec 31.
* **Estimated taxable business profit**: max(0, gross – standard mileage deduction – other costs).
* **Illustrative self-employment tax reserve**: profit × 92.35% × 15.3%. This is a simplified planning estimate and **does not** include separate income taxes, annual thresholds, Social Security wage caps, or all individual adjustments.
* **True net**: gross – cash vehicle cost – other costs – estimated SE-tax reserve.
* **True net hourly**: true net ÷ total hours. When hours are zero, hourly rate is shown as unavailable.

**Critical:** The mileage deduction is *not* an additional cash cost. The calculator never subtracts both the IRS deduction and actual vehicle expense from take-home earnings. Real vehicle costs vary; assumptions are adjustable.

IRS sources:
- https://www.irs.gov/tax-professionals/standard-mileage-rates
- https://www.irs.gov/taxtopics/tc554

## SEO structure

Build generates static, independently indexable pages from `src/pages.json`: the homepage plus 8 platform/intent-specific calculators. Every landing page has unique introduction, explanatory content, FAQs, FAQ structured data, canonical URL, title, description and platform selection. The shared functionality is imported from `src/app.js` and `src/calc.mjs`.

Pages:
- /
- /doordash-true-hourly-rate/
- /doordash-after-expenses-calculator/
- /uber-earnings-after-gas/
- /lyft-earnings-calculator/
- /instacart-pay-calculator/
- /amazon-flex-profit-calculator/
- /gig-worker-mileage-deduction/
- /gig-worker-tax-calculator/

Also generated: /privacy/, /terms/, /sitemap.xml, /robots.txt.

Set `SITE_URL=https://your-canonical-domain` at **build time** so the canonical and sitemap links point to the live website. Default: https://twodollargig.netlify.app.

## Netlify deployment

1. Connect GitHub repository `TrancheGroup/Twodollargig` to a Netlify project. It will use `netlify.toml`, run `npm run build`, and publish `dist/`.
2. Set `SITE_URL` for the production build, then build/deploy.
3. The free calculator needs **no backend, API credentials, authentication, or database**.
4. Do not turn on Pro until its dedicated database, Stripe prices and webhook are configured.

The `.netlify/` directory is gitignored. Production secrets must be configured in Netlify’s environment settings with **Functions** scope, not in `netlify.toml` or committed files.

## Pro ($2/month, optional $20/year)

Pro code is included but must be provisioned before it can take real payments. **Do not advertise live paid cloud history until the full subscription flow is tested.**

1. Create a **dedicated TwoDollarGig Supabase project** (do not reuse another project's customer database by accident).
2. Execute `supabase/schema.sql` once; confirm that RLS is enabled and anonymous users cannot read entries. Enable email OTP/magic links in Supabase Auth. Allow the production URL under Auth redirect URLs.
3. In the selected Stripe account, create two *recurring* prices: USD $2 per month and USD $20 per year. Copy the price IDs. Create a webhook endpoint `https://your-domain/.netlify/functions/stripe-webhook` listening for `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.
4. Set environment variables (sample in `.env.example`):
    * Build/client: `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY` (public values only).
    * Server-only functions: `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_MONTHLY_PRICE_ID`, `STRIPE_ANNUAL_PRICE_ID`.
5. Deploy again; make a real or Stripe test-mode checkout using matching keys, verify webhook event, entitlement row, cloud insert, reload of history on a second device, cancellation, and billing-portal link before enabling production payments.

**Security model:** Stripe webhook signatures verified server-side; API requests authorize users with Supabase Auth; subscription entitlement rows are webhook-owned; paid entries require authenticated user ID + paid entitlement through RLS. Server secrets never ship in `dist/`. Free calculations never call cloud storage.

## Testing / release checklist

Automated test workflow runs `npm test`, `npm run build`, generated-site integrity checks, and JavaScript syntax checks.

Manual browser checks still needed before claiming production-ready:
- Mobile viewport (360px wide), no input zoom/layout overflow
- On each landing page, correct preset, live edits without reload
- Switch gas input from per-mile to total; ensure no duplicate gas charge
- Work date 2026-06-30 vs 2026-07-01 changes the IRS rate
- Hours zero does not show Infinity or NaN
- Enter high miles and low gross; negative net rate shows properly
- CSV downloads and opens, Print/Save as PDF works on mobile/desktop
- localStorage persistence on reload; no free account prompt
- Pro test signup, monthly/annual checkout, webhook, cloud save, cross-device history, cancel, deleted entry RLS

The estimates disclaimer is displayed on every calculator results view. TwoDollarGig is an independent utility not affiliated with platform brands.
