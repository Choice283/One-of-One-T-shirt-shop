import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';

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
      if (productId) {
        await prisma.product.update({
          where: { id: productId },
          data: { status: 'sold', stripeSessionId: session.id }
        });
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
