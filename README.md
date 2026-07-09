# One-of-a-Kind Tees

A small storefront for selling **single-quantity, one-of-a-kind t-shirts** ($10–$100, any size).
Every listing is exactly one physical shirt. Once someone buys it, it's marked "sold" and disappears
from the store — no restocking, no duplicate sizes.

## Stack
- Next.js 14 (App Router) + TypeScript + Tailwind
- Prisma + SQLite (swap to Postgres later just by changing `DATABASE_URL` + the `provider` in `prisma/schema.prisma`)
- Stripe Checkout (payment + shipping address + shipping rate selection)
- Images stored locally in `public/uploads/<productId>/` (swap to S3/Cloudinary later if you outgrow local disk)

## How it works
1. You log into `/admin` (HTTP Basic Auth) and create a listing with photos, price, size, description.
2. It shows up on the homepage for anyone browsing.
3. A buyer clicks "Buy Now" → a Stripe Checkout Session is created for that one shirt, and the listing
   is immediately flipped to `pending` so nobody else can buy it while checkout is in progress.
4. If they pay, Stripe's webhook flips the listing to `sold` (gone from the store forever).
5. If they abandon checkout, the session expires after 30 minutes and the webhook flips it back to `available`.

## Local setup

1. Install dependencies:
   ```
   npm install
   ```
2. Copy `.env.example` to `.env` and fill in:
   - `STRIPE_SECRET_KEY` — from https://dashboard.stripe.com/test/apikeys (use a **test** key while developing)
   - `ADMIN_USER` / `ADMIN_PASS` — whatever you want to log into `/admin` with
   - Leave `STRIPE_WEBHOOK_SECRET` blank for now — you'll get it in the next step
3. Create the database:
   ```
   npx prisma migrate dev --name init
   ```
4. In a second terminal, forward Stripe webhooks to your local server (requires the free Stripe CLI):
   ```
   stripe listen --forward-to localhost:3000/api/webhook
   ```
   Copy the `whsec_...` value it prints into `STRIPE_WEBHOOK_SECRET` in `.env`.
5. Run the app:
   ```
   npm run dev
   ```
6. Visit `http://localhost:3000/admin/new` to add your first shirt (browser will prompt for the
   `ADMIN_USER` / `ADMIN_PASS` you set), then `http://localhost:3000` to see the storefront.

Use Stripe's test card `4242 4242 4242 4242`, any future expiry, any CVC, to test a full purchase.

## Deploying
- Any host that runs Next.js works (Vercel is the easiest). Switch `DATABASE_URL` to a real Postgres
  database for production (SQLite is fine for local dev but doesn't work well on serverless hosts).
- Add the same env vars in your host's dashboard, using your **live** Stripe key once you're ready to
  take real payments.
- Add a **live** webhook endpoint in the Stripe Dashboard pointing to `https://yourdomain.com/api/webhook`,
  subscribed to `checkout.session.completed` and `checkout.session.expired`.
- If you deploy somewhere without persistent local disk (like Vercel), move image storage to S3 or
  Cloudinary — local `public/uploads` won't survive redeploys on serverless hosts.

## Project structure
```
app/
  page.tsx                 storefront home (grid of available shirts)
  product/[id]/page.tsx    single shirt detail + Buy Now
  success/page.tsx         post-purchase thank-you page
  admin/page.tsx           admin dashboard (all listings + status controls)
  admin/new/page.tsx       new listing form
  api/checkout/route.ts    creates the Stripe Checkout Session
  api/webhook/route.ts     handles Stripe events (mark sold / release hold)
  api/admin/products/      create/list/update/delete listings
components/
  BuyButton.tsx            client-side buy button + redirect to Stripe
  StatusControls.tsx       admin buttons: mark available/sold, delete
lib/
  prisma.ts, stripe.ts, format.ts
prisma/schema.prisma       Product model
middleware.ts              Basic Auth gate for /admin and /api/admin/*
```

## What's intentionally left simple (MVP scope)
- Single admin login via Basic Auth — fine for one owner, swap for real auth if you add staff.
- No shopping cart — every purchase is "buy this one shirt now," which fits one-of-a-kind inventory.
- No email confirmations beyond what Stripe sends automatically — add a service like Resend later if
  you want a custom "your shirt shipped" email.
