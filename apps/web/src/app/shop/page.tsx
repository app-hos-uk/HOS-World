import {
  getCMSBanners,
  mapCarouselBanners,
  mapFeatureBanners,
  mapHeroSlides,
} from '@/lib/cms';
import { ShopHomeContent } from './ShopHomeContent';

export default async function ShopHomePage() {
  const [heroBanners, promotionalBanners, sidebarBanners] = await Promise.all([
    getCMSBanners('hero'),
    getCMSBanners('promotional'),
    getCMSBanners('sidebar'),
  ]);

  return (
    <ShopHomeContent
      heroSlides={mapHeroSlides(heroBanners)}
      promotionalBanners={mapCarouselBanners(promotionalBanners)}
      sidebarBanners={mapFeatureBanners(sidebarBanners)}
    />
  );
}
