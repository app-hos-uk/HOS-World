'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icon in Next.js
if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  });
}

interface MapPickerProps {
  latitude?: number;
  longitude?: number;
  onLocationChange: (lat: number, lng: number) => void;
  height?: string;
  className?: string;
  /** Address typed into the surrounding form; the map centres on it while no pin is set. */
  addressQuery?: string;
}

interface GeocodeResult {
  label: string;
  lat: number;
  lng: number;
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

/** Street-level zoom used whenever a specific address is shown or selected. */
const ZOOM_LEVEL_ADDRESS = 16;

async function geocodeAddress(query: string, signal: AbortSignal): Promise<GeocodeResult[]> {
  const url = `${NOMINATIM_URL}?format=jsonv2&limit=5&addressdetails=0&q=${encodeURIComponent(query)}`;
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`Address lookup failed (${response.status})`);
  }
  const payload = (await response.json()) as Array<{
    display_name?: string;
    lat?: string;
    lon?: string;
  }>;
  return (Array.isArray(payload) ? payload : [])
    .map((entry) => ({
      label: entry.display_name ?? '',
      lat: Number(entry.lat),
      lng: Number(entry.lon),
    }))
    .filter((entry) => entry.label && Number.isFinite(entry.lat) && Number.isFinite(entry.lng));
}

/** Recentres the map whenever the requested view changes. */
function MapView({ position, zoom }: { position: [number, number] | null; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    if (!position) return;
    map.setView(position, zoom);
  }, [map, position, zoom]);
  return null;
}

function LocationMarker({ onLocationChange, initialLat, initialLng }: { 
  onLocationChange: (lat: number, lng: number) => void;
  initialLat?: number;
  initialLng?: number;
}) {
  // Use explicit undefined checks to handle 0 as a valid coordinate (equator/prime meridian)
  const [position, setPosition] = useState<[number, number] | null>(
    initialLat !== undefined && initialLng !== undefined ? [initialLat, initialLng] : null
  );

  const map = useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      setPosition([lat, lng]);
      onLocationChange(lat, lng);
      // Zoom in to the selected location so the user sees the pin clearly
      map.setView([lat, lng], ZOOM_LEVEL_ADDRESS);
    },
  });

  // Update position and zoom when initial values change (e.g. editing an address with coordinates)
  // Use explicit undefined checks to handle 0 as a valid coordinate (equator/prime meridian)
  useEffect(() => {
    if (initialLat !== undefined && initialLng !== undefined) {
      const newPosition: [number, number] = [initialLat, initialLng];
      setPosition(newPosition);
      map.setView(newPosition, ZOOM_LEVEL_ADDRESS);
    }
  }, [initialLat, initialLng, map]);

  return position === null ? null : (
    <Marker
      position={position}
      draggable
      autoPan
      eventHandlers={{
        dragend: (event) => {
          const { lat, lng } = (event.target as L.Marker).getLatLng();
          setPosition([lat, lng]);
          onLocationChange(lat, lng);
        },
      }}
    />
  );
}

/** Invalidate map size after layout settles / container resizes (Leaflet often measures 0 initially). */
function MapResizeFix() {
  const map = useMap();
  useEffect(() => {
    const invalidate = () => map.invalidateSize({ animate: false });
    const t1 = window.setTimeout(invalidate, 50);
    const t2 = window.setTimeout(invalidate, 250);
    const container = map.getContainer()?.parentElement;
    let observer: ResizeObserver | undefined;
    if (container && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => invalidate());
      observer.observe(container);
    }
    window.addEventListener('resize', invalidate);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      observer?.disconnect();
      window.removeEventListener('resize', invalidate);
    };
  }, [map]);
  return null;
}

/**
 * Tile sources tried in order. OpenStreetMap's `{s}` subdomains are deprecated and
 * rate limited, so the canonical host is used first with mirrors as backups —
 * a single blocked provider must not leave the customer with a blank map.
 */
const TILE_SOURCES = [
  {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  {
    url: 'https://tile.openstreetmap.de/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
];

/**
 * A handful of tiles can fail transiently while panning. Only fall back to the next
 * provider once enough failures accumulate without any tile loading successfully.
 */
function TileErrorWatcher({
  onExhausted,
  onFallback,
  hasFallback,
}: {
  onExhausted: (message: string) => void;
  onFallback: () => void;
  hasFallback: boolean;
}) {
  const map = useMap();
  useEffect(() => {
    const FAILURE_THRESHOLD = 4;
    let failures = 0;

    const onTileError = () => {
      failures += 1;
      if (failures < FAILURE_THRESHOLD) return;
      failures = 0;
      if (hasFallback) {
        onFallback();
      } else {
        onExhausted('Map tiles could not be loaded. Check your network connection and try again.');
      }
    };
    const onTileLoad = () => {
      failures = 0;
    };

    map.on('tileerror', onTileError);
    map.on('tileload', onTileLoad);
    return () => {
      map.off('tileerror', onTileError);
      map.off('tileload', onTileLoad);
    };
  }, [map, onExhausted, onFallback, hasFallback]);
  return null;
}

export default function MapPickerClient({ 
  latitude, 
  longitude, 
  onLocationChange, 
  height = '400px',
  className = '',
  addressQuery,
}: MapPickerProps) {
  const [mounted, setMounted] = useState(false);
  const [currentPosition, setCurrentPosition] = useState<[number, number] | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [geoHint, setGeoHint] = useState<string | null>(null);
  const [tileSourceIndex, setTileSourceIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  // View the map should fly to; kept separate from the pin so auto-centring on a
  // half-typed address never writes coordinates into the address form.
  const [view, setView] = useState<[number, number] | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const autoCenteredQueryRef = useRef<string | null>(null);

  useEffect(() => {
    setMounted(true);
    
    // Set initial position
    // Use explicit undefined checks to handle 0 as a valid coordinate (equator/prime meridian)
    if (latitude !== undefined && longitude !== undefined) {
      setCurrentPosition([latitude, longitude]);
    } else if (typeof navigator !== 'undefined' && navigator.geolocation) {
      // Default fallback while geolocation resolves
      setCurrentPosition([40.7128, -74.0060]);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCurrentPosition([pos.coords.latitude, pos.coords.longitude]);
          setGeoHint(null);
        },
        (err) => {
          setGeoHint(
            err.code === err.PERMISSION_DENIED
              ? 'Location access was denied. Click the map to set your address manually.'
              : 'Could not detect your location. Click the map to set your address manually.',
          );
        },
        { timeout: 8000, maximumAge: 60_000 },
      );
    } else {
      // Default to New York, US if no coordinates / geolocation
      setCurrentPosition([40.7128, -74.0060]);
      setGeoHint('Geolocation is unavailable. Click the map to set your address manually.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update position when props change
  // Use explicit undefined checks to handle 0 as a valid coordinate (equator/prime meridian)
  useEffect(() => {
    if (latitude !== undefined && longitude !== undefined) {
      setCurrentPosition([latitude, longitude]);
    }
  }, [latitude, longitude]);

  const handleLocationChange = (lat: number, lng: number) => {
    setCurrentPosition([lat, lng]);
    onLocationChange(lat, lng);
  };

  const hasCoordinates = latitude !== undefined && longitude !== undefined;

  const runSearch = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    setSearching(true);
    setSearchError(null);
    try {
      const results = await geocodeAddress(trimmed, controller.signal);
      setSearchResults(results);
      if (results.length === 0) {
        setSearchError('No matching address found. Try adding a city or postcode.');
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      setSearchError('Address search is unavailable right now. Click the map to set the pin manually.');
    } finally {
      if (!controller.signal.aborted) setSearching(false);
    }
  }, []);

  // Centre on the address being typed into the form, but leave the pin alone so the
  // customer still confirms the exact spot themselves.
  useEffect(() => {
    const trimmed = (addressQuery ?? '').trim();
    if (hasCoordinates || trimmed.length < 8) return;
    if (autoCenteredQueryRef.current === trimmed) return;

    const controller = new AbortController();
    const handle = window.setTimeout(async () => {
      try {
        const results = await geocodeAddress(trimmed, controller.signal);
        if (controller.signal.aborted || results.length === 0) return;
        autoCenteredQueryRef.current = trimmed;
        setView([results[0].lat, results[0].lng]);
      } catch {
        // Auto-centring is a convenience; failures stay silent.
      }
    }, 900);

    return () => {
      window.clearTimeout(handle);
      controller.abort();
    };
  }, [addressQuery, hasCoordinates]);

  useEffect(() => () => searchAbortRef.current?.abort(), []);

  const handleSelectResult = (result: GeocodeResult) => {
    setSearchResults([]);
    setSearchTerm(result.label);
    setView([result.lat, result.lng]);
    handleLocationChange(result.lat, result.lng);
  };

  const handleUseCurrentLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoHint('Geolocation is unavailable in this browser. Click the map to set your address manually.');
      return;
    }
    setLocating(true);
    setGeoHint(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setView([pos.coords.latitude, pos.coords.longitude]);
        handleLocationChange(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        setLocating(false);
        setGeoHint(
          err.code === err.PERMISSION_DENIED
            ? 'Location access was denied. Click the map to set your address manually.'
            : 'Could not detect your location. Click the map to set your address manually.',
        );
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
  };

  if (!mounted || !currentPosition) {
    return (
      <div 
        className={`bg-hos-bg-tertiary rounded-lg flex items-center justify-center ${className}`}
        style={{ height }}
      >
        <div className="text-hos-text-muted">Loading map...</div>
      </div>
    );
  }

  const initialZoom = hasCoordinates ? ZOOM_LEVEL_ADDRESS : 6;

  return (
    <div className={`rounded-lg overflow-hidden border border-hos-border flex flex-col ${className}`} style={{ height }}>
      <div className="shrink-0 border-b border-hos-border bg-hos-bg-secondary p-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setSearchError(null);
              }}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                // The picker is rendered inside the address <form>; Enter must search,
                // not submit a half-filled address.
                e.preventDefault();
                void runSearch(searchTerm);
              }}
              placeholder="Search for an address, city or postcode"
              aria-label="Search for an address"
              className="w-full rounded-lg border border-hos-border bg-hos-bg px-3 py-2 text-sm text-hos-text-secondary placeholder-hos-text-muted focus:border-hos-gold focus:outline-none"
            />
            {searchResults.length > 0 && (
              <ul className="absolute inset-x-0 top-full z-[600] mt-1 max-h-48 overflow-y-auto rounded-lg border border-hos-border bg-hos-bg-secondary shadow-lg">
                {searchResults.map((result) => (
                  <li key={`${result.lat},${result.lng}`}>
                    <button
                      type="button"
                      onClick={() => handleSelectResult(result)}
                      className="block w-full px-3 py-2 text-left text-xs text-hos-text-secondary hover:bg-hos-gold/10"
                    >
                      {result.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            type="button"
            onClick={() => void runSearch(searchTerm)}
            disabled={searching || !searchTerm.trim()}
            className="shrink-0 rounded-lg bg-hos-gold px-3 py-2 text-sm font-medium text-[#1a1406] hover:bg-hos-gold-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {searching ? 'Searching…' : 'Search'}
          </button>
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={locating}
            title="Use my current location"
            className="shrink-0 rounded-lg border border-hos-border px-3 py-2 text-sm text-hos-text-secondary hover:border-hos-gold hover:text-hos-gold disabled:cursor-not-allowed disabled:opacity-50"
          >
            {locating ? 'Locating…' : '📍 My location'}
          </button>
        </div>
        {searchError && <p className="mt-1 text-xs text-amber-300/90">{searchError}</p>}
      </div>
      {/* Map fills remaining height; footer stays outside the tile viewport */}
      <div className="relative flex-1 min-h-[240px] w-full">
        {mapError ? (
          <div className="absolute inset-0 z-[500] flex items-center justify-center bg-hos-bg-tertiary p-4 text-center">
            <div>
              <p className="text-sm text-red-300 font-medium mb-1">Map unavailable</p>
              <p className="text-xs text-hos-text-muted mb-3">{mapError}</p>
              <button
                type="button"
                onClick={() => {
                  setTileSourceIndex(0);
                  setMapError(null);
                }}
                className="text-xs px-3 py-1.5 rounded-lg bg-hos-gold text-[#1a1406] hover:bg-hos-gold-hover"
              >
                Retry map
              </button>
            </div>
          </div>
        ) : null}
        <MapContainer
          center={currentPosition}
          zoom={initialZoom}
          style={{ position: 'absolute', inset: 0, height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
          <MapResizeFix />
          <MapView position={view} zoom={ZOOM_LEVEL_ADDRESS} />
          <TileErrorWatcher
            onExhausted={setMapError}
            onFallback={() => setTileSourceIndex((index) => index + 1)}
            hasFallback={tileSourceIndex < TILE_SOURCES.length - 1}
          />
          <TileLayer
            key={tileSourceIndex}
            attribution={TILE_SOURCES[tileSourceIndex].attribution}
            url={TILE_SOURCES[tileSourceIndex].url}
          />
          <LocationMarker
            onLocationChange={handleLocationChange}
            initialLat={latitude}
            initialLng={longitude}
          />
        </MapContainer>
      </div>
      <div className="shrink-0 bg-hos-bg-secondary px-4 py-2 border-t border-hos-border text-sm text-hos-text-secondary">
        <p className="font-medium mb-1">
          Search for your address, click the map, or drag the pin to set your exact delivery point.
        </p>
        {geoHint && <p className="text-xs text-amber-300/90 mb-1">{geoHint}</p>}
        {latitude !== undefined && longitude !== undefined && (
          <p className="text-xs">
            Coordinates: {latitude.toFixed(6)}, {longitude.toFixed(6)}
          </p>
        )}
      </div>
    </div>
  );
}
