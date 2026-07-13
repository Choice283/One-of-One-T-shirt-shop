# Uber Direct Integration — Troubleshooting Notes

Internal notes for diagnosing Uber Direct issues without needing a full test
checkout. Keep this file out of anything public — it doesn't contain real
secrets (those are all placeholders below), but it does describe your account
setup.

## Quick status check (no checkout needed)

You can test whether your Uber Direct account/API access is working directly
from a terminal, without placing an order through the site. This is much
faster than running a full Stripe checkout every time you want to check
status.

**1. Get a fresh access token** (tokens expire after ~30 days, so always get a
new one rather than reusing an old one):

```powershell
curl.exe --request POST "https://auth.uber.com/oauth/v2/token" --header "Content-Type: application/x-www-form-urlencoded" --data-urlencode "client_id=YOUR_CLIENT_ID" --data-urlencode "client_secret=YOUR_CLIENT_SECRET" --data-urlencode "grant_type=client_credentials" --data-urlencode "scope=eats.deliveries"
```

Get `YOUR_CLIENT_ID` / `YOUR_CLIENT_SECRET` from
https://direct.uber.com/accounts/5a661c54-1d44-490d-b957-1da4f333ab87/developer

This returns JSON with an `access_token` field — copy the token value (the
long string between the quotes).

**2. Create a test quote body file** (only needs to be done once — reuse
`quote.json` afterward). In PowerShell, use `-Encoding ascii`, NOT `utf8` —
`utf8` silently adds a BOM character that breaks Uber's JSON parser:

```powershell
@'
{
  "pickup_address": "{\"street_address\": [\"160 W 79th Street\"],\"state\":\"IL\",\"city\":\"Chicago\",\"zip_code\":\"60620\",\"country\":\"US\"}",
  "dropoff_address": "{\"street_address\": [\"233 S Wacker Dr\"],\"state\":\"IL\",\"city\":\"Chicago\",\"zip_code\":\"60606\",\"country\":\"US\"}"
}
'@ | Set-Content -Path quote.json -Encoding ascii
```

**3. Request a quote** using the token from step 1:

```powershell
curl.exe -X POST "https://api.uber.com/v1/customers/5a661c54-1d44-490d-b957-1da4f333ab87/delivery_quotes" -H "Content-Type: application/json" -H "Authorization: Bearer YOUR_ACCESS_TOKEN" -d "@quote.json"
```

(Customer ID and account ID are the same value for this account:
`5a661c54-1d44-490d-b957-1da4f333ab87`.)

## What the responses mean

- **A real quote** (JSON with a `fee`, `dropoff_eta`, `duration`, etc.) — the
  account works. Everything should function normally through the site.
- **`{"error":"invalid_client","error_description":"client ID is invalid"}`**
  — the client ID/secret in the token request is wrong or still has
  placeholder text in it. Double-check step 1.
- **`{"code":"invalid_params",...,"metadata":{"customer_token":"Invalid
  customer token"}}`** — the Customer ID in the URL (step 3) is wrong or
  still has placeholder text.
- **`{"code":"invalid_params",...,"metadata":{"param_details":"This account
  has been disabled. Please reach out to directbilling-group@uber.com to
  resolve"}}`** — this is Uber's own API telling you the account is
  disabled at the API/developer-access level, separate from general account
  billing status (the "Billing active" you see on the Organizations page in
  the dashboard is a different, broader status and can show active even
  while this is disabled).

## Known issue log

**2026-07-11 — Account disabled for API access.** Dashboard shows account
and billing as active, "New delivery" setup checklist fully completed, but
the Delivery Quotes API consistently returns the "account has been disabled"
error above. Emailed directbilling-group@uber.com with account ID and error
details. A phone support call gave a confusing, hard-to-parse explanation
involving "DNS" and a suggestion to contact an "account manager" — unclear
if this applies to a direct API account (which this is) versus a
POS-integration account (which this is not, as far as we know). Asked for a
written follow-up to get a clearer answer. Status: unresolved as of last
check — rerun the quick status check above anytime to see if it's been
fixed, since Uber's fix won't come with a notification.

## Related code

- `lib/uberDirect.ts` — the actual integration code (OAuth token caching,
  createUberQuote, createUberDelivery).
- `app/api/webhook/route.ts` — calls the above after a Stripe payment
  succeeds, records `deliveryError` on the Product if it fails, and emails
  an alert via `lib/email.ts`.
- `app/admin/page.tsx` — shows a courier status badge per sold delivery
  order, using the same error info.
