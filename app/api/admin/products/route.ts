import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import path from 'path';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';

// GET: list every product (all statuses) for the admin dashboard.
export async function GET() {
  const products = await prisma.product.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json(products);
}

// POST: create a new one-of-a-kind listing. Expects multipart/form-data with
// title, description, priceDollars, size, condition, and 1+ files under "images".
export async function POST(req: NextRequest) {
  const formData = await req.formData();

  const title = formData.get('title')?.toString().trim();
  const description = formData.get('description')?.toString().trim() ?? '';
  const priceDollars = Number(formData.get('priceDollars'));
  const size = formData.get('size')?.toString().trim();
  const condition = formData.get('condition')?.toString().trim() || null;
  const files = formData.getAll('images').filter((f): f is File => f instanceof File && f.size > 0);

  if (!title || !size || !priceDollars || priceDollars <= 0) {
    return NextResponse.json({ error: 'Title, size, and a valid price are required.' }, { status: 400 });
  }
  if (files.length === 0) {
    return NextResponse.json({ error: 'At least one photo is required.' }, { status: 400 });
  }

  const productId = randomUUID();

  // Uploaded to Vercel Blob (cloud storage) rather than the local filesystem —
  // serverless hosts wipe local disk writes between requests, so photos saved
  // to /public/uploads would vanish. Blob gives back a permanent public URL,
  // which is also exactly what Stripe needs (it can't reach a local file path).
  const imagePaths: string[] = [];
  for (const [i, file] of files.entries()) {
    const ext = path.extname(file.name) || '.jpg';
    const filename = `${productId}/${i}${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const blob = await put(filename, buffer, {
      access: 'public',
      contentType: file.type || 'image/jpeg'
    });
    imagePaths.push(blob.url);
  }

  const product = await prisma.product.create({
    data: {
      id: productId,
      title,
      description,
      priceCents: Math.round(priceDollars * 100),
      size,
      condition,
      images: JSON.stringify(imagePaths),
      status: 'available'
    }
  });

  return NextResponse.json(product, { status: 201 });
}
