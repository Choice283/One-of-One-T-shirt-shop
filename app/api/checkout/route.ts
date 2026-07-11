import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { parseImages } from '@/lib/format';

// Creates a Stripe Checkout Session for exactly ONE product.
// Because every shirt is one-of-a-kind (qty 1), we flip the product to
// "pending" the moment checkout starts so a second buyer can't also check out
// the same shirt. If the buyer abandons checkout, the "checkout.session.expired"
// webhook flips it back to "available".
export async function POST(req: NextRequest) {
  const { productId, fulfillment } = await req.json();

  // "delivery" ships the shirt (existing flow); "pickup" skips shipping
  // entirely and just collects a name so Choice knows who's coming to grab it.
  const fulfillmentMethod: 'delivery' | 'pickup' = fulfillment === 'pickup' ? 'pickup' : 'delivery';

  if (!productId) {
    return NextResponse.json({ error: 'Missing productId' }, { status: 400 });
  }

  const product = await prisma.product.findUnique({ where: { id: productId } });

  if (!product) {
    return NextResponse.json({ error: 'Shirt not found' }, { status: 404 });
  }

  if (product.status !== 'available') {
    return NextResponse.json(
      { error: 'Sorry — this one-of-a-kind shirt just sold or is currently reserved by another buyer.' },
      { status: 409 }
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
  const images = parseImages(product.images);

  // Flat local-courier fee charged at checkout. The *actual* Uber Direct
  // delivery (with its own real-time quote) is created after payment
  // succeeds, in the webhook — see app/api/webhook/route.ts. We charge a
  // flat rate here because Uber Direct needs the buyer's address to price a
  // real quote, and Stripe only collects that address inside its own
  // checkout page, after this session already exists. If the real Uber
  // Direct fee ends up higher than this flat rate on some orders, that's a
  // cost Choice eats for now — a future upgrade could collect the address
  // first and quote before charging.
  const localDeliveryCents = Number(process.env.UBER_DELIVERY_FLAT_CENTS ?? 899);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: product.title,
              description: `Size ${product.size}${product.condition ? ` · ${product.condition}` : ''}`,
              // Blob-stored images are already full https:// URLs; only old
              // local-dev entries (relative /uploads/... paths) need the
              // baseUrl prefix.
              images: images[0]
                ? [images[0].startsWith('http') ? images[0] : `${baseUrl}${images[0]}`]
                : undefined
            },
            unit_amount: product.priceCents
          },
          quantity: 1
        }
      ],
      // Delivery collects a shipping address and charges the flat local-courier
      // fee — restricted to US only since Uber Direct couriers operate within
      // a single metro, not cross-border or long-distance. Pickup skips all of
      // that — instead we ask for a name via a custom field so Choice knows
      // who to expect in person. Email is collected by Stripe Checkout
      // automatically either way, no extra config needed.
      ...(fulfillmentMethod === 'delivery'
        ? {
            shipping_address_collection: { allowed_countries: ['US'] },
            shipping_options: [
              {
                shipping_rate_data: {
                  type: 'fixed_amount' as const,
                  fixed_amount: { amount: localDeliveryCents, currency: 'usd' },
                  display_name: 'Local Courier Delivery (via Uber Direct, same-day)',
                  delivery_estimate: {
                    minimum: { unit: 'hour' as const, value: 1 },
                    maximum: { unit: 'hour' as const, value: 3 }
                  }
                }
              }
            ]
          }
        : {
            custom_fields: [
              {
                key: 'pickup_name',
                label: { type: 'custom' as const, custom: 'Name for pickup' },
                type: 'text' as const,
                optional: false
              }
            ]
          }),
      // Uber Direct requires a dropoff phone number, so we collect it for
      // delivery orders (not needed for in-person pickup).
      ...(fulfillmentMethod === 'delivery' ? { phone_number_collection: { enabled: true } } : {}),
      metadata: { productId: product.id, fulfillment: fulfillmentMethod },
      // Stripe requires this to be MORE than 1800 seconds out — 30 min exactly
      // can land right on the boundary and get rejected, so we pad to 40 min.
      expires_at: Math.floor(Date.now() / 1000) + 40 * 60,
      success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/product/${product.id}`
    });

    await prisma.product.update({
      where: { id: product.id },
      data: { status: 'pending', stripeSessionId: session.id, fulfillment: fulfillmentMethod }
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    // Always log the real Stripe error server-side, and always return valid
    // JSON to the client — an uncaught throw here previously produced a raw
    // error page that broke res.json() on the frontend.
    console.error('Stripe checkout session creation failed:', err);
    const message = err instanceof Error ? err.message : 'Failed to start checkout.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
