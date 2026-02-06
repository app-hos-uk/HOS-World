'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';

/** Flatten category tree (same source as Admin → Fandoms) into a list for the dropdown */
function flattenCategoryTree(
  nodes: { id: string; name: string; slug: string; path?: string; children?: any[] }[],
  pathPrefix = ''
): { id: string; name: string; slug: string; displayPath: string }[] {
  let list: { id: string; name: string; slug: string; displayPath: string }[] = [];
  for (const node of nodes) {
    const displayPath = pathPrefix ? `${pathPrefix} / ${node.name}` : node.name;
    list.push({
      id: node.id,
      name: node.name,
      slug: node.slug,
      displayPath,
    });
    if (node.children?.length) {
      list = list.concat(flattenCategoryTree(node.children, displayPath));
    }
  }
  return list;
}

interface FandomSelectorProps {
  value?: string;
  onChange: (fandomSlug: string | null) => void;
  label?: string;
  required?: boolean;
  placeholder?: string;
  /** When true, refetch when tab becomes visible (e.g. after creating fandoms in Admin). */
  refetchOnVisible?: boolean;
}

export function FandomSelector({
  value,
  onChange,
  label = 'Fandom',
  required = false,
  placeholder = 'Select a fandom',
  refetchOnVisible = true,
}: FandomSelectorProps) {
  const [fandoms, setFandoms] = useState<{ id: string; name: string; slug: string; displayPath: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFandoms = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Use taxonomy categories (same as Admin → Fandoms) so created Fandoms appear here
      const response = await apiClient.getCategoryTree();
      const tree = response?.data;
      const list = Array.isArray(tree) ? flattenCategoryTree(tree) : [];
      setFandoms(list);
    } catch (err: any) {
      setError(err.message || 'Failed to load fandoms');
      setFandoms([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFandoms();
  }, [loadFandoms]);

  useEffect(() => {
    if (!refetchOnVisible || typeof document === 'undefined') return;
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') loadFandoms();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [refetchOnVisible, loadFandoms]);

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
    <div className="space-y-2 min-h-[52px]">
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
        required={required}
        aria-label={label || 'Fandom'}
      >
        <option value="">{placeholder}</option>
        {fandoms.map((fandom) => (
          <option key={fandom.id} value={fandom.slug}>
            {fandom.displayPath}
          </option>
        ))}
      </select>
      {fandoms.length === 0 && (
        <p className="text-xs text-gray-500">No fandoms available. Create fandoms in Admin → Fandoms.</p>
      )}
    </div>
  );
}
