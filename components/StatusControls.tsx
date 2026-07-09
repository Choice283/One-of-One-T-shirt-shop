'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function StatusControls({ productId, status }: { productId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function updateStatus(newStatus: string) {
    setBusy(true);
    await fetch(`/api/admin/products/${productId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    setBusy(false);
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm('Delete this listing permanently? This cannot be undone.')) return;
    setBusy(true);
    await fetch(`/api/admin/products/${productId}`, { method: 'DELETE' });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex gap-2 text-xs">
      {status !== 'available' && (
        <button disabled={busy} onClick={() => updateStatus('available')} className="rounded border px-2 py-1 hover:bg-neutral-50">
          Mark Available
        </button>
      )}
      {status !== 'sold' && (
        <button disabled={busy} onClick={() => updateStatus('sold')} className="rounded border px-2 py-1 hover:bg-neutral-50">
          Mark Sold
        </button>
      )}
      <button disabled={busy} onClick={handleDelete} className="rounded border border-red-300 px-2 py-1 text-red-600 hover:bg-red-50">
        Delete
      </button>
    </div>
  );
}
