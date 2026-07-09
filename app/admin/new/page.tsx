'use client';

import { useRouter } from 'next/navigation';
import { useState, FormEvent } from 'react';

export default function NewListingPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);

    const res = await fetch('/api/admin/products', {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'Failed to create listing.');
      setSubmitting(false);
      return;
    }

    router.push('/admin');
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-xl font-bold">New One-of-a-Kind Listing</h1>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium">Title</label>
          <input name="title" required className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2" placeholder="Hand-painted Denim Jacket Tee" />
        </div>

        <div>
          <label className="block text-sm font-medium">Description</label>
          <textarea name="description" rows={4} className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2" placeholder="Materials, story behind the design, fit notes..." />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium">Price (USD)</label>
            <input name="priceDollars" type="number" min="10" max="100" step="0.01" required className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2" placeholder="45.00" />
          </div>
          <div>
            <label className="block text-sm font-medium">Size</label>
            <select name="size" required className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2">
              <option value="">Select...</option>
              <option value="XS">XS</option>
              <option value="S">S</option>
              <option value="M">M</option>
              <option value="L">L</option>
              <option value="XL">XL</option>
              <option value="XXL">XXL</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium">Condition (optional)</label>
          <input name="condition" className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2" placeholder="New / Like New / Vintage" />
        </div>

        <div>
          <label className="block text-sm font-medium">Photos</label>
          <input name="images" type="file" accept="image/*" multiple required className="mt-1 w-full text-sm" />
          <p className="mt-1 text-xs text-neutral-500">First photo becomes the cover image. Upload multiple angles if you have them.</p>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={submitting} className="w-full rounded-md bg-neutral-900 px-6 py-3 font-medium text-white disabled:opacity-60">
          {submitting ? 'Uploading…' : 'Publish Listing'}
        </button>
      </form>
    </div>
  );
}
