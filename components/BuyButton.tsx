'use client';

import { useState } from 'react';

type Fulfillment = 'delivery' | 'pickup';

// Two buttons, one component: which one was clicked decides whether the
// Stripe session that gets created asks for a shipping address (delivery)
// or just a name for pickup (pickup) — see app/api/checkout/route.ts.
export default function BuyButton({ productId }: { productId: string }) {
  const [loadingMethod, setLoadingMethod] = useState<Fulfillment | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleBuy(fulfillment: Fulfillment) {
    setLoadingMethod(fulfillment);
    setError(null);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, fulfillment })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong. Please try again.');
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setLoadingMethod(null);
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={() => handleBuy('delivery')}
        disabled={loadingMethod !== null}
        className="w-full rounded-md bg-neutral-900 px-6 py-3 font-medium text-white transition hover:bg-neutral-700 disabled:opacity-60"
      >
        {loadingMethod === 'delivery' ? 'Redirecting to checkout…' : 'Ship to Me'}
      </button>
      <button
        onClick={() => handleBuy('pickup')}
        disabled={loadingMethod !== null}
        className="w-full rounded-md border border-neutral-900 px-6 py-3 font-medium text-neutral-900 transition hover:bg-neutral-100 disabled:opacity-60"
      >
        {loadingMethod === 'pickup' ? 'Redirecting to checkout…' : 'Pick Up Locally'}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
