'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';

interface Tag {
  id: string;
  name: string;
  slug: string;
  category: 'THEME' | 'OCCASION' | 'STYLE' | 'CHARACTER' | 'FANDOM' | 'CUSTOM';
  description?: string;
}

interface TagSelectorProps {
  value?: string[];
  onChange: (tagIds: string[]) => void;
  label?: string;
  placeholder?: string;
  allowCreate?: boolean;
}

const TAG_CATEGORY_LABELS: Record<string, string> = {
  THEME: 'Theme',
  OCCASION: 'Occasion',
  STYLE: 'Style',
  CHARACTER: 'Character',
  FANDOM: 'Fandom',
  CUSTOM: 'Custom',
};

export function TagSelector({
  value = [],
  onChange,
  label = 'Tags',
  placeholder = 'Search and select tags...',
  allowCreate = false,
}: TagSelectorProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  useEffect(() => {
    loadTags();
  }, [filterCategory]);

  useEffect(() => {
    if (value.length > 0 && tags.length > 0) {
      const selected = tags.filter((tag) => value.includes(tag.id));
      setSelectedTags(selected);
    } else {
      setSelectedTags([]);
    }
  }, [value, tags]);

  const loadTags = async () => {
    try {
      setLoading(true);
      const filters: any = { isActive: true };
      if (filterCategory) {
        filters.category = filterCategory;
      }
      if (searchQuery) {
        filters.search = searchQuery;
      }
      const response = await apiClient.getTags(filters);
      if (response?.data) {
        setTags(response.data);
      }
    } catch (err: any) {
      console.error('Failed to load tags:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length >= 2) {
      try {
        const response = await apiClient.searchTags(query);
        if (response?.data) {
          setTags(response.data);
          setShowDropdown(true);
        }
      } catch (err: any) {
        console.error('Failed to search tags:', err);
      }
    } else {
      loadTags();
    }
  };

  const handleTagSelect = (tag: Tag) => {
    if (selectedTags.find((t) => t.id === tag.id)) {
      // Remove tag
      const newSelected = selectedTags.filter((t) => t.id !== tag.id);
      setSelectedTags(newSelected);
      onChange(newSelected.map((t) => t.id));
    } else {
      // Add tag
      const newSelected = [...selectedTags, tag];
      setSelectedTags(newSelected);
      onChange(newSelected.map((t) => t.id));
    }
    setShowDropdown(false);
    setSearchQuery('');
  };

  const handleRemoveTag = (tagId: string) => {
    const newSelected = selectedTags.filter((t) => t.id !== tagId);
    setSelectedTags(newSelected);
    onChange(newSelected.map((t) => t.id));
  };

  const filteredTags = tags.filter((tag) => {
    if (searchQuery) {
      return tag.name.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  return (
    <div className="space-y-2">
      {label && <label className="block text-sm font-medium text-gray-700">{label}</label>}

      {/* Selected Tags */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selectedTags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 rounded text-sm"
            >
              {tag.name}
              <button
                type="button"
                onClick={() => handleRemoveTag(tag.id)}
                className="text-purple-600 hover:text-purple-800"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => {
            handleSearch(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          placeholder={placeholder}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
        />

        {/* Category Filter */}
        <div className="mt-2 flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setFilterCategory(null);
              loadTags();
            }}
            className={`px-2 py-1 text-xs rounded ${
              filterCategory === null
                ? 'bg-purple-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            All
          </button>
          {Object.entries(TAG_CATEGORY_LABELS).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setFilterCategory(key);
                loadTags();
              }}
              className={`px-2 py-1 text-xs rounded ${
                filterCategory === key
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Dropdown */}
        {showDropdown && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-sm text-gray-500 text-center">Loading...</div>
            ) : filteredTags.length === 0 ? (
              <div className="p-4 text-sm text-gray-500 text-center">
                {searchQuery ? 'No tags found' : 'No tags available'}
              </div>
            ) : (
              <div className="py-1">
                {filteredTags.map((tag) => {
                  const isSelected = selectedTags.find((t) => t.id === tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => handleTagSelect(tag)}
                      className={`w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center justify-between ${
                        isSelected ? 'bg-purple-50' : ''
                      }`}
                    >
                      <div>
                        <div className="text-sm font-medium">{tag.name}</div>
                        {tag.description && (
                          <div className="text-xs text-gray-500">{tag.description}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">
                          {TAG_CATEGORY_LABELS[tag.category]}
                        </span>
                        {isSelected && <span className="text-purple-600">✓</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Click outside to close */}
      {showDropdown && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setShowDropdown(false)}
        />
      )}
    </div>
  );
}

