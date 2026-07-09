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

  const standardCents = Number(process.env.SHIPPING_STANDARD_CENTS ?? 599);
  const expressCents = Number(process.env.SHIPPING_EXPRESS_CENTS ?? 1499);

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
      // Delivery collects a shipping address and offers Standard/Express rates.
      // Pickup skips all of that — instead we ask for a name via a custom
      // field so Choice knows who to expect in person. Email is collected by
      // Stripe Checkout automatically either way, no extra config needed.
      ...(fulfillmentMethod === 'delivery'
        ? {
            shipping_address_collection: { allowed_countries: ['US', 'CA'] },
            shipping_options: [
              {
                shipping_rate_data: {
                  type: 'fixed_amount' as const,
                  fixed_amount: { amount: standardCents, currency: 'usd' },
                  display_name: 'Standard Shipping (5-7 business days)',
                  delivery_estimate: {
                    minimum: { unit: 'business_day' as const, value: 5 },
                    maximum: { unit: 'business_day' as const, value: 7 }
                  }
                }
              },
              {
                shipping_rate_data: {
                  type: 'fixed_amount' as const,
                  fixed_amount: { amount: expressCents, currency: 'usd' },
                  display_name: 'Express Shipping (1-2 business days)',
                  delivery_estimate: {
                    minimum: { unit: 'business_day' as const, value: 1 },
                    maximum: { unit: 'business_day' as const, value: 2 }
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
      metadata: { productId: product.id, fulfillment: fulfillmentMethod },
      // Stripe requires this to be MORE than 1800 seconds out — 30 min exactly
      // can land right on the boundary and get rejected, so we pad to 40 min.
      expires_at: Math.floor(Date.now() / 1000) + 40 * 60,
      success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/product/${product.id}`
    });

    await prisma.product.update({
      where: { id: product.id },
      data: { status: 'pending', stripeSessionId: session.id }
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
