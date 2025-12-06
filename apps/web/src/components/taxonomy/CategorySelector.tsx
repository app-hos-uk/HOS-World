'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';

interface Category {
  id: string;
  name: string;
  slug: string;
  parentId?: string;
  level: number;
  path: string;
  children?: Category[];
}

interface CategorySelectorProps {
  value?: string;
  onChange: (categoryId: string | null) => void;
  label?: string;
  required?: boolean;
  placeholder?: string;
}

export function CategorySelector({
  value,
  onChange,
  label = 'Category',
  required = false,
  placeholder = 'Select a category',
}: CategorySelectorProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [expandedLevels, setExpandedLevels] = useState<Set<number>>(new Set([0]));

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    if (value && categories.length > 0) {
      const findCategory = (cats: Category[], id: string): Category | null => {
        for (const cat of cats) {
          if (cat.id === id) return cat;
          if (cat.children) {
            const found = findCategory(cat.children, id);
            if (found) return found;
          }
        }
        return null;
      };
      const found = findCategory(categories, value);
      setSelectedCategory(found);
    } else {
      setSelectedCategory(null);
    }
  }, [value, categories]);

  const loadCategories = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getCategoryTree();
      if (response?.data) {
        setCategories(response.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const toggleLevel = (level: number) => {
    const newExpanded = new Set(expandedLevels);
    if (newExpanded.has(level)) {
      newExpanded.delete(level);
    } else {
      newExpanded.add(level);
    }
    setExpandedLevels(newExpanded);
  };

  const renderCategoryTree = (cats: Category[], level: number = 0): JSX.Element[] => {
    if (level > 2) return []; // Max 3 levels

    return cats.map((category) => {
      const hasChildren = category.children && category.children.length > 0;
      const isExpanded = expandedLevels.has(level + 1);
      const isSelected = selectedCategory?.id === category.id;

      return (
        <div key={category.id} className="ml-4">
          <div
            className={`flex items-center gap-2 p-2 rounded hover:bg-gray-100 cursor-pointer ${
              isSelected ? 'bg-purple-100 border border-purple-300' : ''
            }`}
            onClick={() => {
              setSelectedCategory(category);
              onChange(category.id);
            }}
          >
            {hasChildren && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleLevel(level + 1);
                }}
                className="w-4 h-4 flex items-center justify-center text-gray-500 hover:text-gray-700"
              >
                {isExpanded ? '▼' : '▶'}
              </button>
            )}
            {!hasChildren && <span className="w-4" />}
            <span className="text-sm">{category.name}</span>
            {isSelected && <span className="ml-auto text-purple-600">✓</span>}
          </div>
          {hasChildren && isExpanded && (
            <div className="mt-1">{renderCategoryTree(category.children!, level + 1)}</div>
          )}
        </div>
      );
    });
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
        <div className="text-sm text-gray-500">Loading categories...</div>
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
      <div className="border border-gray-300 rounded-lg p-3 max-h-64 overflow-y-auto bg-white">
        {categories.length === 0 ? (
          <div className="text-sm text-gray-500 text-center py-4">
            No categories available. Create categories first.
          </div>
        ) : (
          <div className="space-y-1">{renderCategoryTree(categories)}</div>
        )}
      </div>
      {selectedCategory && (
        <div className="text-xs text-gray-600 mt-1">
          Selected: <span className="font-medium">{selectedCategory.path}</span>
        </div>
      )}
    </div>
  );
}

