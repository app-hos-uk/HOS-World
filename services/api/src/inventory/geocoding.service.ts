import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

interface GeocodingResult {
  latitude: number;
  longitude: number;
  formattedAddress?: string;
  confidence?: number;
}

interface AddressInput {
  street?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
}

// UK city coordinates for fallback geocoding
const UK_CITY_COORDINATES: Record<string, { lat: number; lon: number }> = {
  'london': { lat: 51.5074, lon: -0.1278 },
  'birmingham': { lat: 52.4862, lon: -1.8904 },
  'manchester': { lat: 53.4808, lon: -2.2426 },
  'leeds': { lat: 53.8008, lon: -1.5491 },
  'glasgow': { lat: 55.8642, lon: -4.2518 },
  'liverpool': { lat: 53.4084, lon: -2.9916 },
  'bristol': { lat: 51.4545, lon: -2.5879 },
  'sheffield': { lat: 53.3811, lon: -1.4701 },
  'edinburgh': { lat: 55.9533, lon: -3.1883 },
  'cardiff': { lat: 51.4816, lon: -3.1791 },
  'belfast': { lat: 54.5973, lon: -5.9301 },
  'nottingham': { lat: 52.9548, lon: -1.1581 },
  'newcastle': { lat: 54.9783, lon: -1.6178 },
  'southampton': { lat: 50.9097, lon: -1.4044 },
  'portsmouth': { lat: 50.8198, lon: -1.0880 },
  'brighton': { lat: 50.8225, lon: -0.1372 },
  'oxford': { lat: 51.7520, lon: -1.2577 },
  'cambridge': { lat: 52.2053, lon: 0.1218 },
  'york': { lat: 53.9591, lon: -1.0815 },
  'reading': { lat: 51.4543, lon: -0.9781 },
  'coventry': { lat: 52.4068, lon: -1.5197 },
  'leicester': { lat: 52.6369, lon: -1.1398 },
  'aberdeen': { lat: 57.1497, lon: -2.0943 },
  'derby': { lat: 52.9225, lon: -1.4746 },
  'plymouth': { lat: 50.3755, lon: -4.1427 },
  'stoke-on-trent': { lat: 53.0027, lon: -2.1794 },
  'wolverhampton': { lat: 52.5862, lon: -2.1288 },
  'sunderland': { lat: 54.9069, lon: -1.3838 },
  'norwich': { lat: 52.6309, lon: 1.2974 },
  'swansea': { lat: 51.6214, lon: -3.9436 },
};

// US state center coordinates for fallback
const US_STATE_COORDINATES: Record<string, { lat: number; lon: number }> = {
  'california': { lat: 36.7783, lon: -119.4179 },
  'ca': { lat: 36.7783, lon: -119.4179 },
  'new york': { lat: 40.7128, lon: -74.0060 },
  'ny': { lat: 40.7128, lon: -74.0060 },
  'texas': { lat: 31.9686, lon: -99.9018 },
  'tx': { lat: 31.9686, lon: -99.9018 },
  'florida': { lat: 27.6648, lon: -81.5158 },
  'fl': { lat: 27.6648, lon: -81.5158 },
  // Add more as needed
};

// Country center coordinates for fallback
const COUNTRY_COORDINATES: Record<string, { lat: number; lon: number }> = {
  'uk': { lat: 55.3781, lon: -3.4360 },
  'gb': { lat: 55.3781, lon: -3.4360 },
  'united kingdom': { lat: 55.3781, lon: -3.4360 },
  'us': { lat: 37.0902, lon: -95.7129 },
  'usa': { lat: 37.0902, lon: -95.7129 },
  'united states': { lat: 37.0902, lon: -95.7129 },
  'canada': { lat: 56.1304, lon: -106.3468 },
  'ca': { lat: 56.1304, lon: -106.3468 },
  'germany': { lat: 51.1657, lon: 10.4515 },
  'de': { lat: 51.1657, lon: 10.4515 },
  'france': { lat: 46.2276, lon: 2.2137 },
  'fr': { lat: 46.2276, lon: 2.2137 },
  'uae': { lat: 23.4241, lon: 53.8478 },
  'ae': { lat: 23.4241, lon: 53.8478 },
  'united arab emirates': { lat: 23.4241, lon: 53.8478 },
  'dubai': { lat: 25.2048, lon: 55.2708 },
  'australia': { lat: -25.2744, lon: 133.7751 },
  'au': { lat: -25.2744, lon: 133.7751 },
  'india': { lat: 20.5937, lon: 78.9629 },
  'in': { lat: 20.5937, lon: 78.9629 },
};

@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Geocode an address to coordinates
   * Uses internal lookup tables first, can be extended to use external APIs
   */
  async geocode(address: AddressInput): Promise<GeocodingResult | null> {
    const { city, state, postalCode, country } = address;

    // Try city-level lookup first (most accurate for our fallback)
    const cityKey = city.toLowerCase().trim();
    
    // Check UK cities
    if (
      country.toLowerCase() === 'uk' ||
      country.toLowerCase() === 'gb' ||
      country.toLowerCase() === 'united kingdom'
    ) {
      const ukCoords = UK_CITY_COORDINATES[cityKey];
      if (ukCoords) {
        this.logger.log(`Geocoded ${city}, UK to ${ukCoords.lat}, ${ukCoords.lon}`);
        return {
          latitude: ukCoords.lat,
          longitude: ukCoords.lon,
          formattedAddress: `${city}, UK`,
          confidence: 0.8,
        };
      }
    }

    // Try US state lookup
    if (
      state &&
      (country.toLowerCase() === 'us' ||
        country.toLowerCase() === 'usa' ||
        country.toLowerCase() === 'united states')
    ) {
      const stateKey = state.toLowerCase().trim();
      const usCoords = US_STATE_COORDINATES[stateKey];
      if (usCoords) {
        this.logger.log(`Geocoded ${city}, ${state}, US to ${usCoords.lat}, ${usCoords.lon}`);
        return {
          latitude: usCoords.lat,
          longitude: usCoords.lon,
          formattedAddress: `${city}, ${state}, US`,
          confidence: 0.6,
        };
      }
    }

    // Fall back to country-level
    const countryKey = country.toLowerCase().trim();
    const countryCoords = COUNTRY_COORDINATES[countryKey];
    if (countryCoords) {
      this.logger.log(`Geocoded to country center: ${country} at ${countryCoords.lat}, ${countryCoords.lon}`);
      return {
        latitude: countryCoords.lat,
        longitude: countryCoords.lon,
        formattedAddress: country,
        confidence: 0.3,
      };
    }

    // Could not geocode
    this.logger.warn(`Could not geocode address: ${city}, ${state || ''}, ${country}`);
    return null;
  }

  /**
   * Geocode and save coordinates to an address record
   */
  async geocodeAndSaveAddress(addressId: string): Promise<GeocodingResult | null> {
    const address = await this.prisma.address.findUnique({
      where: { id: addressId },
    });

    if (!address) {
      this.logger.warn(`Address not found: ${addressId}`);
      return null;
    }

    // If already has coordinates, return them
    if (address.latitude && address.longitude) {
      return {
        latitude: address.latitude,
        longitude: address.longitude,
        confidence: 1.0,
      };
    }

    // Geocode the address
    const result = await this.geocode({
      street: address.street,
      city: address.city,
      state: address.state || undefined,
      postalCode: address.postalCode,
      country: address.country,
    });

    if (result) {
      // Save coordinates to address
      await this.prisma.address.update({
        where: { id: addressId },
        data: {
          latitude: result.latitude,
          longitude: result.longitude,
        },
      });
      this.logger.log(`Saved coordinates to address ${addressId}`);
    }

    return result;
  }

  /**
   * Batch geocode multiple addresses
   */
  async batchGeocodeAddresses(addressIds: string[]): Promise<Map<string, GeocodingResult | null>> {
    const results = new Map<string, GeocodingResult | null>();

    for (const addressId of addressIds) {
      const result = await this.geocodeAndSaveAddress(addressId);
      results.set(addressId, result);
    }

    return results;
  }

  /**
   * Get coordinates for a location (with caching via database)
   */
  async getCoordinatesForAddress(
    addressId: string,
  ): Promise<{ latitude: number; longitude: number } | null> {
    const address = await this.prisma.address.findUnique({
      where: { id: addressId },
      select: { latitude: true, longitude: true, city: true, state: true, country: true },
    });

    if (!address) return null;

    // If already geocoded, return cached coordinates
    if (address.latitude && address.longitude) {
      return { latitude: address.latitude, longitude: address.longitude };
    }

    // Otherwise, geocode and save
    const result = await this.geocodeAndSaveAddress(addressId);
    if (result) {
      return { latitude: result.latitude, longitude: result.longitude };
    }

    return null;
  }
}
