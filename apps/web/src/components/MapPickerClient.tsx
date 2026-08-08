'use client';

import { useEffect, useState } from 'react';
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

  const ZOOM_LEVEL_ADDRESS = 16; // Zoom in to street level when showing/selecting an address

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
    <Marker position={position} />
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
 * A handful of tiles can fail transiently while panning. Only surface the error
 * state once enough failures accumulate without any tile loading successfully.
 */
function TileErrorWatcher({ onError }: { onError: (message: string) => void }) {
  const map = useMap();
  useEffect(() => {
    const FAILURE_THRESHOLD = 4;
    let failures = 0;

    const onTileError = () => {
      failures += 1;
      if (failures >= FAILURE_THRESHOLD) {
        onError('Map tiles could not be loaded. Check your network connection and try again.');
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
  }, [map, onError]);
  return null;
}

export default function MapPickerClient({ 
  latitude, 
  longitude, 
  onLocationChange, 
  height = '400px',
  className = '' 
}: MapPickerProps) {
  const [mounted, setMounted] = useState(false);
  const [currentPosition, setCurrentPosition] = useState<[number, number] | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [geoHint, setGeoHint] = useState<string | null>(null);

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

  const hasCoordinates = latitude !== undefined && longitude !== undefined;
  const initialZoom = hasCoordinates ? 16 : 6;

  return (
    <div className={`rounded-lg overflow-hidden border border-hos-border flex flex-col ${className}`} style={{ height }}>
      {/* Map fills remaining height; footer stays outside the tile viewport */}
      <div className="relative flex-1 min-h-[240px] w-full">
        {mapError ? (
          <div className="absolute inset-0 z-[500] flex items-center justify-center bg-hos-bg-tertiary p-4 text-center">
            <div>
              <p className="text-sm text-red-300 font-medium mb-1">Map unavailable</p>
              <p className="text-xs text-hos-text-muted mb-3">{mapError}</p>
              <button
                type="button"
                onClick={() => setMapError(null)}
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
          <TileErrorWatcher onError={setMapError} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <LocationMarker
            onLocationChange={handleLocationChange}
            initialLat={latitude}
            initialLng={longitude}
          />
        </MapContainer>
      </div>
      <div className="shrink-0 bg-hos-bg-secondary px-4 py-2 border-t border-hos-border text-sm text-hos-text-secondary">
        <p className="font-medium mb-1">Click on the map to set your location (map will zoom in to your selection)</p>
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
