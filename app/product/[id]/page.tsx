import Image from 'next/image';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { formatPrice, parseImages } from '@/lib/format';
import BuyButton from '@/components/BuyButton';

export const dynamic = 'force-dynamic';

export default async function ProductPage({ params }: { params: { id: string } }) {
  const product = await prisma.product.findUnique({ where: { id: params.id } });

  if (!product) {
    notFound();
  }

  const images = parseImages(product.images);
  const isAvailable = product.status === 'available';

  return (
    <div className="grid gap-10 md:grid-cols-2">
      <div className="space-y-3">
        <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-neutral-100">
          {images[0] && (
            <Image src={images[0]} alt={product.title} fill className="object-cover" sizes="50vw" priority />
          )}
        </div>
        {images.length > 1 && (
          <div className="grid grid-cols-4 gap-2">
            {images.slice(1).map((src, i) => (
              <div key={i} className="relative aspect-square overflow-hidden rounded bg-neutral-100">
                <Image src={src} alt={`${product.title} extra ${i + 1}`} fill className="object-cover" sizes="12vw" />
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h1 className="text-2xl font-bold">{product.title}</h1>
        <p className="mt-2 text-xl font-semibold">{formatPrice(product.priceCents)}</p>

        <dl className="mt-4 space-y-1 text-sm text-neutral-600">
          <div className="flex gap-2">
            <dt className="font-medium text-neutral-900">Size:</dt>
            <dd>{product.size}</dd>
          </div>
          {product.condition && (
            <div className="flex gap-2">
              <dt className="font-medium text-neutral-900">Condition:</dt>
              <dd>{product.condition}</dd>
            </div>
          )}
        </dl>

        <p className="mt-4 whitespace-pre-line text-neutral-700">{product.description}</p>

        <div className="mt-6 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          This is a one-of-a-kind piece — only one exists. Once it sells, this listing is gone for good.
        </div>

        <div className="mt-6">
          {isAvailable ? (
            <BuyButton productId={product.id} />
          ) : (
            <button disabled className="w-full cursor-not-allowed rounded-md bg-neutral-300 px-6 py-3 font-medium text-neutral-600">
              Sold Out
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
