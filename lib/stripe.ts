import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  // We only throw at call time (not import time) in dev so the rest of the
  // app can still run before you've added Stripe keys.
  console.warn('STRIPE_SECRET_KEY is not set — checkout will fail until you add it to .env');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder', {
  apiVersion: '2024-06-20'
});
