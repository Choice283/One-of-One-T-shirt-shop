import { prisma } from '@/lib/prisma';

// Server component so we can look up the order by the Stripe session id in
// the URL and show the Uber Direct tracking link once the webhook has
// created the delivery. The webhook usually beats the buyer back to this
// page, but if it hasn't yet, we just don't show a tracking link yet — no
// polling, keep it simple.
export default async function SuccessPage({
  searchParams
}: {
  searchParams: { session_id?: string };
}) {
  const product = searchParams.session_id
    ? await prisma.product.findFirst({ where: { stripeSessionId: searchParams.session_id } })
    : null;

  return (
    <div className="mx-auto max-w-lg py-24 text-center">
      <h1 className="text-2xl font-bold">Thank you! 🎉</h1>
      <p className="mt-3 text-neutral-600">
        Your order is confirmed. Since this shirt was one-of-a-kind, it&apos;s now marked sold and
        removed from the store. You&apos;ll get a receipt by email from Stripe.
      </p>

      {product?.uberTrackingUrl && (
        <p className="mt-3 text-neutral-600">
          Your shirt is on its way via Uber Direct —{' '}
          <a href={product.uberTrackingUrl} className="font-medium underline" target="_blank" rel="noreferrer">
            track your delivery
          </a>
          .
        </p>
      )}

      {product?.deliveryError && (
        <p className="mt-3 text-sm text-neutral-500">
          We&apos;re still finalizing your courier dispatch — you&apos;ll get tracking details shortly.
        </p>
      )}

      <a href="/" className="mt-6 inline-block text-sm font-medium underline">
        Back to the shop
      </a>
    </div>
  );
}
