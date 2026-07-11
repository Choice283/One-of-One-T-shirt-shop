import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { createUberDelivery, createUberQuote } from '@/lib/uberDirect';

// Stripe needs the raw request body to verify the webhook signature,
// so we must disable Next's default body parsing for this route.
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const productId = session.metadata?.productId;
      const fulfillment = session.metadata?.fulfillment;

      if (productId) {
        await prisma.product.update({
          where: { id: productId },
          data: { status: 'sold', stripeSessionId: session.id }
        });

        // Only "delivery" orders get an Uber Direct courier — "pickup"
        // orders just wait for Choice to hand the shirt over in person.
        // This runs after the sale is already recorded, so a failure here
        // never risks losing the sale — it just means Choice needs to spot
        // the deliveryError and dispatch the courier manually (e.g. by
        // creating the delivery straight from the Uber Direct dashboard).
        if (fulfillment === 'delivery') {
          try {
            const address = session.shipping_details?.address;
            const phone = session.customer_details?.phone;
            const name = session.shipping_details?.name ?? session.customer_details?.name;

            if (!address || !address.line1 || !address.city || !address.state || !address.postal_code) {
              throw new Error('Stripe session is missing a complete shipping address');
            }
            if (!phone) {
              throw new Error('Stripe session is missing a dropoff phone number');
            }

            const product = await prisma.product.findUnique({ where: { id: productId } });

            const dropoffAddress = {
              streetAddress: [address.line1, address.line2].filter((line): line is string => Boolean(line)),
              city: address.city,
              state: address.state,
              zipCode: address.postal_code,
              country: address.country ?? 'US'
            };

            const quote = await createUberQuote(dropoffAddress);
            const delivery = await createUberDelivery({
              quoteId: quote.id,
              dropoffAddress,
              dropoffName: name ?? 'Buyer',
              dropoffPhoneNumber: phone,
              manifestDescription: product?.title ?? 'One-of-a-Kind Tee',
              externalId: productId
            });

            await prisma.product.update({
              where: { id: productId },
              data: {
                uberDeliveryId: delivery.id,
                uberTrackingUrl: delivery.tracking_url,
                deliveryError: null
              }
            });
          } catch (err) {
            // Payment already succeeded — never throw here, just record the
            // failure so it's visible (e.g. in the admin panel or DB) and
            // Choice can dispatch the courier by hand.
            console.error(`Uber Direct delivery creation failed for product ${productId}:`, err);
            const message = err instanceof Error ? err.message : 'Uber Direct delivery creation failed';
            await prisma.product.update({
              where: { id: productId },
              data: { deliveryError: message }
            });
          }
        }
      }
      break;
    }

    // Buyer closed the tab / the 30-minute hold ran out without paying —
    // release the shirt back to the store.
    case 'checkout.session.expired': {
      const session = event.data.object as Stripe.Checkout.Session;
      const productId = session.metadata?.productId;
      if (productId) {
        const product = await prisma.product.findUnique({ where: { id: productId } });
        if (product && product.status === 'pending') {
          await prisma.product.update({
            where: { id: productId },
            data: { status: 'available', stripeSessionId: null }
          });
        }
      }
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
