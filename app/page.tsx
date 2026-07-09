import Image from 'next/image';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { formatPrice, parseImages } from '@/lib/format';

// Always fetch fresh — sold shirts must disappear immediately for
// everyone browsing, since each one only exists once.
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const products = await prisma.product.findMany({
    where: { status: 'available' },
    orderBy: { createdAt: 'desc' }
  });

  if (products.length === 0) {
    return (
      <div className="py-24 text-center text-neutral-500">
        <p className="text-lg">No shirts available right now.</p>
        <p className="mt-1 text-sm">Check back soon — new one-of-a-kind pieces drop regularly.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4">
      {products.map((product) => {
        const images = parseImages(product.images);
        return (
          <Link
            key={product.id}
            href={`/product/${product.id}`}
            className="group block overflow-hidden rounded-lg border border-neutral-200 bg-white transition hover:shadow-md"
          >
            <div className="relative aspect-square w-full bg-neutral-100">
              {images[0] && (
                <Image
                  src={images[0]}
                  alt={product.title}
                  fill
                  className="object-cover transition group-hover:scale-105"
                  sizes="(max-width: 768px) 50vw, 25vw"
                />
              )}
            </div>
            <div className="p-3">
              <h2 className="truncate text-sm font-medium">{product.title}</h2>
              <p className="mt-1 text-xs text-neutral-500">Size {product.size}</p>
              <p className="mt-1 font-semibold">{formatPrice(product.priceCents)}</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
