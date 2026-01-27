'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';

interface Fandom {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
}

interface FandomSelectorProps {
  value?: string;
  onChange: (fandomSlug: string | null) => void;
  label?: string;
  required?: boolean;
  placeholder?: string;
}

export function FandomSelector({
  value,
  onChange,
  label = 'Fandom',
  required = false,
  placeholder = 'Select a fandom',
}: FandomSelectorProps) {
  const [fandoms, setFandoms] = useState<Fandom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadFandoms();
  }, []);

  const loadFandoms = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getFandoms();
      if (response?.data) {
        setFandoms(response.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load fandoms');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {label && (
          <label className="block text-sm font-medium text-gray-700">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm text-gray-500">
          Loading fandoms...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-2">
        {label && (
          <label className="block text-sm font-medium text-gray-700">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <div className="text-sm text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        required={required}
      >
        <option value="">{placeholder}</option>
        {fandoms.map((fandom) => (
          <option key={fandom.id || fandom.slug} value={fandom.slug || fandom.name}>
            {fandom.name}
          </option>
        ))}
      </select>
    </div>
  );
}
