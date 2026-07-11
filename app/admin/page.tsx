import Link from 'next/link';
import Image from 'next/image';
import { prisma } from '@/lib/prisma';
import { formatPrice, parseImages } from '@/lib/format';
import StatusControls from '@/components/StatusControls';

export const dynamic = 'force-dynamic';

const statusStyles: Record<string, string> = {
  available: 'bg-green-100 text-green-800',
  pending: 'bg-amber-100 text-amber-800',
  sold: 'bg-neutral-200 text-neutral-600'
};

// Only rendered for sold "delivery" orders — shows whether the Uber Direct
// courier was successfully dispatched by the webhook. "Failed" means
// payment succeeded but the Uber Direct call errored, so Choice needs to
// create the delivery by hand from the Uber Direct dashboard (hover the
// badge for the error message).
function CourierBadge({ trackingUrl, error }: { trackingUrl: string | null; error: string | null }) {
  if (trackingUrl) {
    return (
      <a
        href={trackingUrl}
        target="_blank"
        rel="noreferrer"
        className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 underline"
      >
        Courier dispatched
      </a>
    );
  }

  if (error) {
    return (
      <span
        className="rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-800"
        title={error}
      >
        Courier failed
      </span>
    );
  }

  return (
    <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
      Courier pending
    </span>
  );
}

export default async function AdminDashboard() {
  const products = await prisma.product.findMany({ orderBy: { createdAt: 'desc' } });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Admin · All Listings ({products.length})</h1>
        <Link href="/admin/new" className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white">
          + New Listing
        </Link>
      </div>

      <div className="mt-6 divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
        {products.length === 0 && <p className="p-6 text-sm text-neutral-500">No listings yet.</p>}
        {products.map((product) => {
          const images = parseImages(product.images);
          return (
            <div key={product.id} className="flex items-center gap-4 p-4">
              <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded bg-neutral-100">
                {images[0] && <Image src={images[0]} alt={product.title} fill className="object-cover" sizes="64px" />}
              </div>
              <div className="flex-1">
                <p className="font-medium">{product.title}</p>
                <p className="text-xs text-neutral-500">
                  Size {product.size} · {formatPrice(product.priceCents)}
                </p>
              </div>
              <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusStyles[product.status]}`}>
                {product.status}
              </span>
              {product.status === 'sold' && product.fulfillment === 'delivery' && (
                <CourierBadge trackingUrl={product.uberTrackingUrl} error={product.deliveryError} />
              )}
              <StatusControls productId={product.id} status={product.status} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
