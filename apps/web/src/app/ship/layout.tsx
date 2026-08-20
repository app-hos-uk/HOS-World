'use client';

import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export default function ShipLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-stone-950 text-stone-100">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">{children}</main>
      <Footer />
    </div>
  );
}
