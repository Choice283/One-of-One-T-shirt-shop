// Thin wrapper around the Uber Direct API: OAuth token fetch/cache, quotes,
// and delivery creation. Used from app/api/webhook/route.ts once a Stripe
// payment has actually succeeded — never called before payment, since it
// dispatches a real courier once you're out of test mode.
//
// Docs: https://developer.uber.com/docs/deliveries

type UberAddress = {
  streetAddress: string[];
  city: string;
  state: string;
  zipCode: string;
  country?: string;
};

type UberQuote = {
  id: string;
  fee: number; // cents
  currency: string;
  dropoff_eta: string;
  duration: number;
};

type UberDelivery = {
  id: string;
  status: string;
  tracking_url: string;
  fee: number;
};

let cachedToken: { value: string; expiresAt: number } | null = null;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var ${name} for Uber Direct`);
  }
  return value;
}

function addressToJson(address: UberAddress): string {
  return JSON.stringify({
    street_address: address.streetAddress,
    city: address.city,
    state: address.state,
    zip_code: address.zipCode,
    country: address.country ?? 'US'
  });
}

// Client-credentials OAuth token, cached in memory until shortly before it
// expires. Uber Direct tokens are long-lived (~30 days) so this rarely
// re-fetches, but memory caching resets on every deploy/cold start, which is
// fine — a fresh token is one extra request.
async function getUberAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value;
  }

  const clientId = requireEnv('UBER_CLIENT_ID');
  const clientSecret = requireEnv('UBER_CLIENT_SECRET');

  const res = await fetch('https://auth.uber.com/oauth/v2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
      scope: 'eats.deliveries'
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Uber Direct auth failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };

  cachedToken = {
    value: data.access_token,
    // Refresh 5 minutes before actual expiry to avoid edge-of-window failures.
    expiresAt: Date.now() + (data.expires_in - 300) * 1000
  };

  return cachedToken.value;
}

function getStorePickupAddress(): UberAddress {
  return {
    streetAddress: [requireEnv('STORE_PICKUP_STREET')],
    city: requireEnv('STORE_PICKUP_CITY'),
    state: requireEnv('STORE_PICKUP_STATE'),
    zipCode: requireEnv('STORE_PICKUP_ZIP'),
    country: process.env.STORE_PICKUP_COUNTRY ?? 'US'
  };
}

// Prices a delivery between the store and a dropoff address. Not currently
// called before checkout (see checkout/route.ts comment on the flat fee) —
// this is called from the webhook right before createUberDelivery so we can
// pass a valid quote_id, and is also ready to use later if we move to
// real-time quoting before payment.
export async function createUberQuote(dropoff: UberAddress): Promise<UberQuote> {
  const token = await getUberAccessToken();
  const customerId = requireEnv('UBER_CUSTOMER_ID');

  const res = await fetch(`https://api.uber.com/v1/customers/${customerId}/delivery_quotes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      pickup_address: addressToJson(getStorePickupAddress()),
      dropoff_address: addressToJson(dropoff)
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Uber Direct quote failed (${res.status}): ${text}`);
  }

  return res.json();
}

export type CreateDeliveryParams = {
  quoteId: string;
  dropoffAddress: UberAddress;
  dropoffName: string;
  dropoffPhoneNumber: string;
  manifestDescription: string; // e.g. the shirt title
  externalId?: string; // our Product id, for cross-referencing in Uber's dashboard
};

// Creates the actual courier delivery. Only call this after payment has
// succeeded — it dispatches a real Uber Direct request (or a fake one, in
// test mode).
export async function createUberDelivery(params: CreateDeliveryParams): Promise<UberDelivery> {
  const token = await getUberAccessToken();
  const customerId = requireEnv('UBER_CUSTOMER_ID');

  const res = await fetch(`https://api.uber.com/v1/customers/${customerId}/deliveries`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      quote_id: params.quoteId,
      pickup_address: addressToJson(getStorePickupAddress()),
      pickup_name: process.env.STORE_PICKUP_NAME ?? 'One-of-a-Kind Tees',
      pickup_phone_number: requireEnv('STORE_PICKUP_PHONE'),
      dropoff_address: addressToJson(params.dropoffAddress),
      dropoff_name: params.dropoffName,
      dropoff_phone_number: params.dropoffPhoneNumber,
      external_id: params.externalId,
      manifest_items: [
        {
          name: params.manifestDescription,
          quantity: 1,
          // Rough flat-rate package dims for a single folded shirt in a
          // mailer — good enough for courier routing, not meant to be exact.
          weight: 500, // grams
          dimensions: { length: 30, height: 5, depth: 25 }
        }
      ]
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Uber Direct delivery creation failed (${res.status}): ${text}`);
  }

  return res.json();
}

export type { UberAddress, UberQuote, UberDelivery };
