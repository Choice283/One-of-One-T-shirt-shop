import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'One-of-a-Kind Tees',
  description: 'Unique, single-quantity designer t-shirts. Once it sells, it\'s gone for good.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-neutral-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
            <Link href="/" className="text-lg font-bold tracking-tight">
              One-of-a-Kind Tees
            </Link>
            <p className="text-sm text-neutral-500">Every shirt is unique. Once it&apos;s gone, it&apos;s gone.</p>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        <footer className="mt-16 border-t border-neutral-200 py-6 text-center text-sm text-neutral-400">
          &copy; {new Date().getFullYear()} One-of-a-Kind Tees
        </footer>
      </body>
    </html>
  );
}
