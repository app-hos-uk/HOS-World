import { REFERENCE_ASSETS } from '@/lib/referenceAssets';

export type FandomCatalogEntry = {
  name: string;
  description: string;
  slug: string;
  bannerImage?: string;
};

export const FANDOM_CATALOG: Record<string, FandomCatalogEntry> = {
  'harry-potter': {
    name: 'Harry Potter',
    description: 'Discover magical items from the wizarding world of Harry Potter',
    slug: 'harry-potter',
    bannerImage: REFERENCE_ASSETS.franchiseBanners['harry-potter'],
  },
  'game-of-thrones': {
    name: 'Game of Thrones',
    description: 'Premium collectibles and merchandise from the Seven Kingdoms',
    slug: 'game-of-thrones',
    bannerImage: REFERENCE_ASSETS.franchiseBanners['game-of-thrones'],
  },
  'stranger-things': {
    name: 'Stranger Things',
    description: 'Collectibles from the Upside Down and Hawkins, Indiana',
    slug: 'stranger-things',
  },
  'lord-of-the-rings': {
    name: 'Lord of the Rings',
    description: 'Authentic replicas and collectibles from Middle-earth',
    slug: 'lord-of-the-rings',
    bannerImage: REFERENCE_ASSETS.franchiseBanners['lord-of-the-rings'],
  },
  hobbit: {
    name: 'The Hobbit',
    description: 'Treasures from the Shire and beyond',
    slug: 'hobbit',
  },
  wednesday: {
    name: 'Wednesday',
    description: 'Dark and delightful merchandise from Nevermore Academy',
    slug: 'wednesday',
  },
  friends: {
    name: 'Friends',
    description: 'Could there BE any more collectibles?',
    slug: 'friends',
  },
  'peaky-blinders': {
    name: 'Peaky Blinders',
    description: 'By order of the Peaky Blinders — premium merchandise',
    slug: 'peaky-blinders',
  },
  'star-wars': {
    name: 'Star Wars',
    description: 'Items from a galaxy far, far away',
    slug: 'star-wars',
  },
  'squid-game': {
    name: 'Squid Game',
    description: 'Collectibles from the deadly games',
    slug: 'squid-game',
  },
  'anime-drama': {
    name: 'Anime & Drama Series',
    description: 'Merchandise from your favourite anime and drama titles',
    slug: 'anime-drama',
  },
  'gothic-collection': {
    name: 'Gothic Collection',
    description: 'Dark aesthetic, Victorian-inspired collectibles and gifts',
    slug: 'gothic-collection',
  },
  marvel: {
    name: 'Marvel',
    description: 'Superhero merchandise and collectibles from the Marvel Universe',
    slug: 'marvel',
  },
  'dc-comics': {
    name: 'DC Comics',
    description: 'Superhero collectibles from the DC Universe',
    slug: 'dc-comics',
  },
};

export function getFandomBySlug(slug: string): FandomCatalogEntry | undefined {
  return FANDOM_CATALOG[slug];
}

export function listFandomCatalog(): FandomCatalogEntry[] {
  return Object.values(FANDOM_CATALOG);
}
