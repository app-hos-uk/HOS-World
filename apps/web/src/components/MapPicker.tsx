'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import the map component to avoid SSR issues
const MapComponent = dynamic(() => import('./MapPickerClient'), {
  ssr: false,
  loading: () => (
    <div className="bg-hos-bg-tertiary rounded-lg flex items-center justify-center" style={{ height: '400px' }}>
      <div className="text-hos-text-muted">Loading map...</div>
    </div>
  ),
});

interface MapPickerProps {
  latitude?: number;
  longitude?: number;
  onLocationChange: (lat: number, lng: number) => void;
  height?: string;
  className?: string;
}

export function MapPicker(props: MapPickerProps) {
  return <MapComponent {...props} />;
}
