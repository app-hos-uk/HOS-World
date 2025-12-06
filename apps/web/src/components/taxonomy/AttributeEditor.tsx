'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';

interface AttributeValue {
  id: string;
  value: string;
  slug: string;
  order: number;
}

interface Attribute {
  id: string;
  name: string;
  slug: string;
  type: 'TEXT' | 'NUMBER' | 'SELECT' | 'BOOLEAN' | 'DATE';
  isRequired: boolean;
  isFilterable: boolean;
  isSearchable: boolean;
  values?: AttributeValue[];
}

interface ProductAttribute {
  attributeId: string;
  attributeValueId?: string;
  textValue?: string;
  numberValue?: number;
  booleanValue?: boolean;
  dateValue?: string;
}

interface AttributeEditorProps {
  categoryId?: string;
  value?: ProductAttribute[];
  onChange: (attributes: ProductAttribute[]) => void;
  label?: string;
}

export function AttributeEditor({
  categoryId,
  value = [],
  onChange,
  label = 'Product Attributes',
}: AttributeEditorProps) {
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [loading, setLoading] = useState(true);
  const [productAttributes, setProductAttributes] = useState<ProductAttribute[]>(value);

  useEffect(() => {
    loadAttributes();
  }, [categoryId]);

  useEffect(() => {
    setProductAttributes(value);
  }, [value]);

  useEffect(() => {
    onChange(productAttributes);
  }, [productAttributes, onChange]);

  const loadAttributes = async () => {
    try {
      setLoading(true);
      let response;
      if (categoryId) {
        response = await apiClient.getAttributesForCategory(categoryId);
        if (response?.data?.globalAttributes && response?.data?.categoryAttributes) {
          setAttributes([
            ...(response.data.globalAttributes || []),
            ...(response.data.categoryAttributes || []),
          ]);
        } else {
          setAttributes([]);
        }
      } else {
        response = await apiClient.getGlobalAttributes();
        if (response?.data) {
          setAttributes(response.data);
        }
      }
    } catch (err: any) {
      console.error('Failed to load attributes:', err);
      setAttributes([]);
    } finally {
      setLoading(false);
    }
  };

  const getAttributeValue = (attributeId: string): ProductAttribute | undefined => {
    return productAttributes.find((pa) => pa.attributeId === attributeId);
  };

  const updateAttributeValue = (attribute: Attribute, newValue: any) => {
    const existing = productAttributes.find((pa) => pa.attributeId === attribute.id);
    const updated: ProductAttribute = {
      attributeId: attribute.id,
    };

    switch (attribute.type) {
      case 'TEXT':
        updated.textValue = newValue || '';
        break;
      case 'NUMBER':
        updated.numberValue = newValue ? parseFloat(newValue) : undefined;
        break;
      case 'SELECT':
        updated.attributeValueId = newValue || undefined;
        break;
      case 'BOOLEAN':
        updated.booleanValue = newValue === true || newValue === 'true';
        break;
      case 'DATE':
        updated.dateValue = newValue || undefined;
        break;
    }

    if (existing) {
      setProductAttributes(
        productAttributes.map((pa) => (pa.attributeId === attribute.id ? updated : pa))
      );
    } else {
      setProductAttributes([...productAttributes, updated]);
    }
  };

  const removeAttribute = (attributeId: string) => {
    setProductAttributes(productAttributes.filter((pa) => pa.attributeId !== attributeId));
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {label && <label className="block text-sm font-medium text-gray-700">{label}</label>}
        <div className="text-sm text-gray-500">Loading attributes...</div>
      </div>
    );
  }

  if (attributes.length === 0) {
    return (
      <div className="space-y-2">
        {label && <label className="block text-sm font-medium text-gray-700">{label}</label>}
        <div className="text-sm text-gray-500 p-4 border border-gray-200 rounded-lg bg-gray-50">
          {categoryId
            ? 'No attributes available for this category. Create attributes first.'
            : 'No global attributes available. Create attributes first.'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {label && <label className="block text-sm font-medium text-gray-700">{label}</label>}

      <div className="space-y-4">
        {attributes.map((attribute) => {
          const currentValue = getAttributeValue(attribute.id);
          const hasValue = currentValue !== undefined;

          return (
            <div
              key={attribute.id}
              className="border border-gray-200 rounded-lg p-4 bg-white"
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    {attribute.name}
                    {attribute.isRequired && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  <div className="text-xs text-gray-500 mt-1">
                    Type: {attribute.type}
                    {attribute.isFilterable && ' • Filterable'}
                    {attribute.isSearchable && ' • Searchable'}
                  </div>
                </div>
                {hasValue && (
                  <button
                    type="button"
                    onClick={() => removeAttribute(attribute.id)}
                    className="text-sm text-red-600 hover:text-red-800"
                  >
                    Remove
                  </button>
                )}
              </div>

              {attribute.type === 'TEXT' && (
                <input
                  type="text"
                  value={currentValue?.textValue || ''}
                  onChange={(e) => updateAttributeValue(attribute, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder={`Enter ${attribute.name.toLowerCase()}`}
                />
              )}

              {attribute.type === 'NUMBER' && (
                <input
                  type="number"
                  step="any"
                  value={currentValue?.numberValue || ''}
                  onChange={(e) => updateAttributeValue(attribute, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder={`Enter ${attribute.name.toLowerCase()}`}
                />
              )}

              {attribute.type === 'SELECT' && (
                <select
                  value={currentValue?.attributeValueId || ''}
                  onChange={(e) => updateAttributeValue(attribute, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Select {attribute.name.toLowerCase()}</option>
                  {attribute.values?.map((val) => (
                    <option key={val.id} value={val.id}>
                      {val.value}
                    </option>
                  ))}
                </select>
              )}

              {attribute.type === 'BOOLEAN' && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={currentValue?.booleanValue || false}
                    onChange={(e) => updateAttributeValue(attribute, e.target.checked)}
                    className="w-4 h-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                  />
                  <label className="text-sm text-gray-700">
                    {currentValue?.booleanValue ? 'Yes' : 'No'}
                  </label>
                </div>
              )}

              {attribute.type === 'DATE' && (
                <input
                  type="date"
                  value={currentValue?.dateValue || ''}
                  onChange={(e) => updateAttributeValue(attribute, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

