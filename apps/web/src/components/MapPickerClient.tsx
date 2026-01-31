'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
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

  const map = useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      setPosition([lat, lng]);
      onLocationChange(lat, lng);
    },
  });

  // Update position when initial values change
  // Use explicit undefined checks to handle 0 as a valid coordinate (equator/prime meridian)
  useEffect(() => {
    if (initialLat !== undefined && initialLng !== undefined) {
      const newPosition: [number, number] = [initialLat, initialLng];
      setPosition(newPosition);
      map.setView(newPosition, map.getZoom());
    }
  }, [initialLat, initialLng, map]);

  return position === null ? null : (
    <Marker position={position} />
  );
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

  useEffect(() => {
    setMounted(true);
    
    // Set initial position
    // Use explicit undefined checks to handle 0 as a valid coordinate (equator/prime meridian)
    if (latitude !== undefined && longitude !== undefined) {
      setCurrentPosition([latitude, longitude]);
    } else {
      // Default to London, UK if no coordinates provided
      setCurrentPosition([51.5074, -0.1278]);
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
        className={`bg-gray-100 rounded-lg flex items-center justify-center ${className}`}
        style={{ height }}
      >
        <div className="text-gray-500">Loading map...</div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg overflow-hidden border border-gray-300 ${className}`} style={{ height }}>
      <MapContainer
        center={currentPosition}
        zoom={latitude !== undefined && longitude !== undefined ? 15 : 6}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
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
      <div className="bg-white px-4 py-2 border-t border-gray-300 text-sm text-gray-600">
        <p className="font-medium mb-1">📍 Click on the map to set your location</p>
        {latitude !== undefined && longitude !== undefined && (
          <p className="text-xs">
            Coordinates: {latitude.toFixed(6)}, {longitude.toFixed(6)}
          </p>
        )}
      </div>
    </div>
  );
}
