export default function SuccessPage() {
  return (
    <div className="mx-auto max-w-lg py-24 text-center">
      <h1 className="text-2xl font-bold">Thank you! 🎉</h1>
      <p className="mt-3 text-neutral-600">
        Your order is confirmed. Since this shirt was one-of-a-kind, it&apos;s now marked sold and
        removed from the store. You&apos;ll get a receipt and shipping updates by email from Stripe.
      </p>
      <a href="/" className="mt-6 inline-block text-sm font-medium underline">
        Back to the shop
      </a>
    </div>
  );
}
