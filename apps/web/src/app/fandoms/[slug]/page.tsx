import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getFandomBySlug } from '@/lib/fandomCatalog';
import { FandomDetailClient } from './FandomDetailClient';

interface FandomDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: FandomDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const fandom = getFandomBySlug(slug);
  if (!fandom) {
    return { title: 'Fandom not found' };
  }

  return {
    title: `${fandom.name} — Fandom Marketplace | House of Spells`,
    description: fandom.description,
    alternates: { canonical: `/fandoms/${slug}` },
    openGraph: {
      title: `${fandom.name} | House of Spells`,
      description: fandom.description,
      url: `/fandoms/${slug}`,
    },
  };
}

export default async function FandomDetailPage({ params }: FandomDetailPageProps) {
  const { slug } = await params;
  const fandom = getFandomBySlug(slug);
  if (!fandom) notFound();

  return <FandomDetailClient fandom={fandom} />;
}
