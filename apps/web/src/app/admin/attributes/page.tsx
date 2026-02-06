'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { CategorySelector } from '@/components/taxonomy/CategorySelector';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

interface AttributeValue {
  id: string;
  value: string;
  slug: string;
  order: number;
  colorHex?: string;
  productCount?: number;
}

interface Attribute {
  id: string;
  name: string;
  slug: string;
  type: 'TEXT' | 'NUMBER' | 'SELECT' | 'BOOLEAN' | 'DATE' | 'COLOR' | 'MULTISELECT';
  isRequired: boolean;
  isFilterable: boolean;
  isSearchable: boolean;
  isVisible: boolean;
  isGlobal: boolean;
  categoryId?: string;
  category?: { id: string; name: string };
  values?: AttributeValue[];
  productCount?: number;
  unit?: string;
  minValue?: number;
  maxValue?: number;
  validationPattern?: string;
  validationMessage?: string;
  description?: string;
  placeholder?: string;
}

interface Category {
  id: string;
  name: string;
  level: number;
}

interface Stats {
  totalAttributes: number;
  globalAttributes: number;
  categoryAttributes: number;
  totalValues: number;
  attributesWithProducts: number;
  mostUsedAttribute?: { name: string; count: number };
}

const ATTRIBUTE_TYPES = [
  { value: 'TEXT', label: 'Text', icon: '📝', description: 'Free-form text input' },
  { value: 'NUMBER', label: 'Number', icon: '🔢', description: 'Numeric value with optional unit' },
  { value: 'SELECT', label: 'Select', icon: '📋', description: 'Single choice from options' },
  { value: 'MULTISELECT', label: 'Multi-Select', icon: '☑️', description: 'Multiple choices from options' },
  { value: 'BOOLEAN', label: 'Boolean', icon: '✓✗', description: 'Yes/No toggle' },
  { value: 'DATE', label: 'Date', icon: '📅', description: 'Date picker' },
  { value: 'COLOR', label: 'Color', icon: '🎨', description: 'Color picker with hex value' },
];

const COMMON_UNITS = [
  { category: 'Length', units: ['mm', 'cm', 'm', 'in', 'ft'] },
  { category: 'Weight', units: ['g', 'kg', 'oz', 'lb'] },
  { category: 'Volume', units: ['ml', 'L', 'fl oz', 'gal'] },
  { category: 'Other', units: ['pcs', '%', '°', 'watts', 'hours'] },
];

export default function AdminAttributesPage() {
  const toast = useToast();
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingAttribute, setEditingAttribute] = useState<Attribute | null>(null);
  const [showValuesModal, setShowValuesModal] = useState<string | null>(null);
  const [showUsageModal, setShowUsageModal] = useState<string | null>(null);
  const [usageProducts, setUsageProducts] = useState<any[]>([]);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [newValue, setNewValue] = useState('');
  const [bulkValues, setBulkValues] = useState('');
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [colorHex, setColorHex] = useState('#000000');
  const [stats, setStats] = useState<Stats | null>(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [scopeFilter, setScopeFilter] = useState<'ALL' | 'GLOBAL' | 'CATEGORY'>('ALL');
  const [sortBy, setSortBy] = useState<'name' | 'type' | 'usage'>('name');
  const [savingAttribute, setSavingAttribute] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    type: 'TEXT' as Attribute['type'],
    isRequired: false,
    isFilterable: true,
    isSearchable: false,
    isVisible: true,
    isGlobal: true,
    categoryId: '',
    unit: '',
    minValue: '',
    maxValue: '',
    validationPattern: '',
    validationMessage: '',
    description: '',
    placeholder: '',
  });

  const fetchAttributes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getAttributes();
      if (response?.data && Array.isArray(response.data)) {
        setAttributes(response.data);
        calculateStats(response.data);
      } else {
        setAttributes([]);
      }
    } catch (err: any) {
      console.error('Error fetching attributes:', err);
      setError(err.message || 'Failed to load attributes');
      setAttributes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const calculateStats = (attrs: Attribute[]) => {
    const globalAttrs = attrs.filter(a => a.isGlobal);
    const categoryAttrs = attrs.filter(a => !a.isGlobal);
    const totalValues = attrs.reduce((sum, a) => sum + (a.values?.length || 0), 0);
    const attrsWithProducts = attrs.filter(a => (a.productCount || 0) > 0);
    const mostUsed = attrs.reduce((max, a) => 
      (a.productCount || 0) > (max?.count || 0) ? { name: a.name, count: a.productCount || 0 } : max,
      null as { name: string; count: number } | null
    );
    
    setStats({
      totalAttributes: attrs.length,
      globalAttributes: globalAttrs.length,
      categoryAttributes: categoryAttrs.length,
      totalValues,
      attributesWithProducts: attrsWithProducts.length,
      mostUsedAttribute: mostUsed || undefined,
    });
  };

  const fetchCategories = useCallback(async () => {
    try {
      const response = await apiClient.getCategories();
      if (response?.data && Array.isArray(response.data)) {
        setCategories(response.data);
      } else {
        setCategories([]);
      }
    } catch (err: any) {
      console.error('Error fetching categories:', err);
      setCategories([]);
    }
  }, []);

  useEffect(() => {
    fetchAttributes();
    fetchCategories();
  }, [fetchAttributes, fetchCategories]);

  const fetchAttributeValues = async (attributeId: string) => {
    try {
      const response = await apiClient.getAttributeValues(attributeId);
      if (response?.data) {
        const updated = attributes.map((attr) =>
          attr.id === attributeId ? { ...attr, values: response.data } : attr
        );
        setAttributes(updated);
      }
    } catch (err: any) {
      console.error('Error fetching attribute values:', err);
    }
  };

  const fetchAttributeUsage = async (attributeId: string) => {
    try {
      setLoadingUsage(true);
      // Try to get products using this attribute
      const response = await apiClient.getProducts({ limit: 50 });
      if (response?.data) {
        const products = Array.isArray(response.data) ? response.data : response.data.data || [];
        // Filter products that have this attribute (simplified - backend should provide this)
        const withAttribute = products.filter((p: any) => 
          p.attributes?.some((a: any) => a.attributeId === attributeId)
        );
        setUsageProducts(withAttribute);
      }
    } catch (err: any) {
      console.error('Error fetching attribute usage:', err);
      toast.error('Failed to load usage data');
    } finally {
      setLoadingUsage(false);
    }
  };

  // Filtered and sorted attributes
  const filteredAttributes = useMemo(() => {
    let filtered = [...attributes];
    
    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(a => 
        a.name.toLowerCase().includes(term) ||
        a.slug.toLowerCase().includes(term) ||
        a.description?.toLowerCase().includes(term)
      );
    }
    
    // Type filter
    if (typeFilter !== 'ALL') {
      filtered = filtered.filter(a => a.type === typeFilter);
    }
    
    // Scope filter
    if (scopeFilter === 'GLOBAL') {
      filtered = filtered.filter(a => a.isGlobal);
    } else if (scopeFilter === 'CATEGORY') {
      filtered = filtered.filter(a => !a.isGlobal);
    }
    
    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'type':
          return a.type.localeCompare(b.type);
        case 'usage':
          return (b.productCount || 0) - (a.productCount || 0);
        default:
          return 0;
      }
    });
    
    return filtered;
  }, [attributes, searchTerm, typeFilter, scopeFilter, sortBy]);

  const handleCreateAttribute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingAttribute) return;
    // Validate category is selected for category-specific attributes
    if (!formData.isGlobal && !formData.categoryId) {
      toast.error('Please select a category for category-specific attributes');
      return;
    }
    
    try {
      setSavingAttribute(true);
      const data: any = {
        name: formData.name,
        type: formData.type,
        isRequired: formData.isRequired,
        isFilterable: formData.isFilterable,
        isSearchable: formData.isSearchable,
        isVisible: formData.isVisible,
        isGlobal: formData.isGlobal,
        categoryId: formData.isGlobal ? undefined : formData.categoryId || undefined,
        description: formData.description || undefined,
        placeholder: formData.placeholder || undefined,
      };
      
      // Add type-specific fields
      if (formData.type === 'NUMBER') {
        data.unit = formData.unit || undefined;
        data.minValue = formData.minValue ? parseFloat(formData.minValue) : undefined;
        data.maxValue = formData.maxValue ? parseFloat(formData.maxValue) : undefined;
      }
      
      if (formData.type === 'TEXT' && formData.validationPattern) {
        data.validationPattern = formData.validationPattern;
        data.validationMessage = formData.validationMessage || undefined;
      }
      
      await apiClient.createAttribute(data);
      toast.success('Attribute created successfully');
      setShowCreateForm(false);
      resetForm();
      fetchAttributes();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create attribute');
    } finally {
      setSavingAttribute(false);
    }
  };

  const handleUpdateAttribute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAttribute || savingAttribute) return;
    
    // Validate category is selected for category-specific attributes
    if (!formData.isGlobal && !formData.categoryId) {
      toast.error('Please select a category for category-specific attributes');
      return;
    }
    
    try {
      setSavingAttribute(true);
      const data: any = {
        name: formData.name,
        type: formData.type,
        isRequired: formData.isRequired,
        isFilterable: formData.isFilterable,
        isSearchable: formData.isSearchable,
        isVisible: formData.isVisible,
        isGlobal: formData.isGlobal,
        categoryId: formData.isGlobal ? undefined : formData.categoryId || undefined,
        description: formData.description || undefined,
        placeholder: formData.placeholder || undefined,
      };
      
      if (formData.type === 'NUMBER') {
        data.unit = formData.unit || undefined;
        data.minValue = formData.minValue ? parseFloat(formData.minValue) : undefined;
        data.maxValue = formData.maxValue ? parseFloat(formData.maxValue) : undefined;
      }
      
      if (formData.type === 'TEXT' && formData.validationPattern) {
        data.validationPattern = formData.validationPattern;
        data.validationMessage = formData.validationMessage || undefined;
      }
      
      await apiClient.updateAttribute(editingAttribute.id, data);
      toast.success('Attribute updated successfully');
      setEditingAttribute(null);
      setShowCreateForm(false);
      resetForm();
      fetchAttributes();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update attribute');
    } finally {
      setSavingAttribute(false);
    }
  };

  const handleDeleteAttribute = async (id: string) => {
    if (!confirm('Are you sure you want to delete this attribute? This will remove it from all products.')) {
      return;
    }
    try {
      await apiClient.deleteAttribute(id);
      toast.success('Attribute deleted successfully');
      fetchAttributes();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete attribute');
    }
  };

  const handleAddValue = async (attributeId: string) => {
    if (!newValue.trim()) {
      toast.error('Value cannot be empty');
      return;
    }
    
    const attribute = attributes.find(a => a.id === attributeId);
    
    try {
      await apiClient.createAttributeValue(attributeId, {
        value: newValue.trim(),
        order: attribute?.values?.length || 0,
      });
      toast.success('Value added successfully');
      setNewValue('');
      setColorHex('#000000');
      fetchAttributeValues(attributeId);
    } catch (err: any) {
      toast.error(err.message || 'Failed to add value');
    }
  };

  const handleBulkAddValues = async (attributeId: string) => {
    if (!bulkValues.trim()) {
      toast.error('Please enter values');
      return;
    }
    
    const values = bulkValues.split('\n').map(v => v.trim()).filter(v => v);
    if (values.length === 0) {
      toast.error('No valid values found');
      return;
    }
    
    const attribute = attributes.find(a => a.id === attributeId);
    let successCount = 0;
    let startOrder = attribute?.values?.length || 0;
    
    for (const value of values) {
      try {
        await apiClient.createAttributeValue(attributeId, {
          value,
          order: startOrder++,
        });
        successCount++;
      } catch (err) {
        console.error(`Failed to add value: ${value}`, err);
      }
    }
    
    toast.success(`Added ${successCount} of ${values.length} values`);
    setBulkValues('');
    setShowBulkAdd(false);
    fetchAttributeValues(attributeId);
  };

  const handleDeleteValue = async (valueId: string, attributeId: string) => {
    if (!confirm('Delete this value?')) return;
    try {
      await apiClient.deleteAttributeValue(valueId);
      toast.success('Value deleted');
      fetchAttributeValues(attributeId);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete value');
    }
  };

  const handleReorderValue = async (attributeId: string, valueId: string, direction: 'up' | 'down') => {
    const attribute = attributes.find(a => a.id === attributeId);
    if (!attribute?.values) return;
    
    const values = [...attribute.values];
    const index = values.findIndex(v => v.id === valueId);
    if (index === -1) return;
    
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= values.length) return;
    
    // Swap
    [values[index], values[newIndex]] = [values[newIndex], values[index]];
    
    // Update orders
    try {
      for (let i = 0; i < values.length; i++) {
        if (values[i].order !== i) {
          await apiClient.updateAttributeValue(values[i].id, { order: i });
        }
      }
      fetchAttributeValues(attributeId);
    } catch (err: any) {
      toast.error('Failed to reorder values');
    }
  };

  const handleDuplicateAttribute = async (attribute: Attribute) => {
    try {
      const data: any = {
        name: `${attribute.name} (Copy)`,
        type: attribute.type,
        isRequired: attribute.isRequired,
        isFilterable: attribute.isFilterable,
        isSearchable: attribute.isSearchable,
        isGlobal: attribute.isGlobal,
        categoryId: attribute.categoryId,
        unit: attribute.unit,
        description: attribute.description,
      };
      
      const response = await apiClient.createAttribute(data);
      
      // Copy values if SELECT/MULTISELECT/COLOR
      if (['SELECT', 'MULTISELECT', 'COLOR'].includes(attribute.type) && attribute.values) {
        for (const val of attribute.values) {
          await apiClient.createAttributeValue(response.data.id, {
            value: val.value,
            order: val.order,
          });
        }
      }
      
      toast.success('Attribute duplicated successfully');
      fetchAttributes();
    } catch (err: any) {
      toast.error(err.message || 'Failed to duplicate attribute');
    }
  };

  const startEdit = (attribute: Attribute) => {
    setEditingAttribute(attribute);
    setFormData({
      name: attribute.name,
      type: attribute.type,
      isRequired: attribute.isRequired,
      isFilterable: attribute.isFilterable,
      isSearchable: attribute.isSearchable,
      isVisible: attribute.isVisible ?? true,
      isGlobal: attribute.isGlobal,
      categoryId: attribute.categoryId || '',
      unit: attribute.unit || '',
      minValue: attribute.minValue?.toString() || '',
      maxValue: attribute.maxValue?.toString() || '',
      validationPattern: attribute.validationPattern || '',
      validationMessage: attribute.validationMessage || '',
      description: attribute.description || '',
      placeholder: attribute.placeholder || '',
    });
    setShowCreateForm(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'TEXT',
      isRequired: false,
      isFilterable: true,
      isSearchable: false,
      isVisible: true,
      isGlobal: true,
      categoryId: '',
      unit: '',
      minValue: '',
      maxValue: '',
      validationPattern: '',
      validationMessage: '',
      description: '',
      placeholder: '',
    });
  };

  const cancelForm = () => {
    setShowCreateForm(false);
    setEditingAttribute(null);
    resetForm();
  };

  const getTypeIcon = (type: string) => {
    return ATTRIBUTE_TYPES.find(t => t.value === type)?.icon || '📋';
  };

  if (loading) {
    return (
      <RouteGuard allowedRoles={['ADMIN']}>
        <AdminLayout>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        </AdminLayout>
      </RouteGuard>
    );
  }

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Product Attributes</h1>
              <p className="text-gray-600 mt-1">Define custom attributes for your products</p>
            </div>
            <button
              onClick={() => {
                setShowCreateForm(true);
                setEditingAttribute(null);
                resetForm();
              }}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
            >
              <span>+</span> Add Attribute
            </button>
          </div>

          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-600">Total Attributes</p>
                <p className="text-2xl font-bold text-purple-600">{stats.totalAttributes}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-600">Global</p>
                <p className="text-2xl font-bold text-blue-600">{stats.globalAttributes}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-600">Category-Specific</p>
                <p className="text-2xl font-bold text-green-600">{stats.categoryAttributes}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-600">Total Values</p>
                <p className="text-2xl font-bold text-orange-600">{stats.totalValues}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-600">In Use</p>
                <p className="text-2xl font-bold text-indigo-600">{stats.attributesWithProducts}</p>
              </div>
              {stats.mostUsedAttribute && (
                <div className="bg-white rounded-lg shadow p-4">
                  <p className="text-sm text-gray-600">Most Used</p>
                  <p className="text-lg font-bold text-pink-600 truncate">{stats.mostUsedAttribute.name}</p>
                  <p className="text-xs text-gray-500">{stats.mostUsedAttribute.count} products</p>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">Error: {error}</p>
              <button onClick={fetchAttributes} className="mt-2 text-red-600 hover:text-red-800 text-sm">
                Retry
              </button>
            </div>
          )}

          {/* Filters */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-[200px]">
                <input
                  type="text"
                  placeholder="Search attributes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="ALL">All Types</option>
                {ATTRIBUTE_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.icon} {type.label}</option>
                ))}
              </select>
              <select
                value={scopeFilter}
                onChange={(e) => setScopeFilter(e.target.value as any)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="ALL">All Scopes</option>
                <option value="GLOBAL">Global Only</option>
                <option value="CATEGORY">Category-Specific</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="name">Sort by Name</option>
                <option value="type">Sort by Type</option>
                <option value="usage">Sort by Usage</option>
              </select>
            </div>
          </div>

          {/* Create/Edit Form */}
          {showCreateForm && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">
                {editingAttribute ? 'Edit Attribute' : 'Create New Attribute'}
              </h2>
              <form
                onSubmit={editingAttribute ? handleUpdateAttribute : handleCreateAttribute}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Attribute Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder="e.g., Size, Color, Material"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <input
                      type="text"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder="Help text for this attribute"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                      {ATTRIBUTE_TYPES.map(type => (
                        <option key={type.value} value={type.value}>
                          {type.icon} {type.label} - {type.description}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Scope</label>
                    <select
                      value={formData.isGlobal ? 'global' : 'category'}
                      onChange={(e) => setFormData({ ...formData, isGlobal: e.target.value === 'global' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="global">Global (All Categories)</option>
                      <option value="category">Category-Specific</option>
                    </select>
                  </div>
                  {!formData.isGlobal && (
                    <div>
                      <CategorySelector
                        value={formData.categoryId}
                        onChange={(categoryId) => setFormData({ ...formData, categoryId: categoryId || '' })}
                        label="Fandom"
                        required={true}
                        placeholder="Select a category"
                      />
                    </div>
                  )}
                </div>

                {/* Number-specific options */}
                {formData.type === 'NUMBER' && (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                      <select
                        value={formData.unit}
                        onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="">No unit</option>
                        {COMMON_UNITS.map(group => (
                          <optgroup key={group.category} label={group.category}>
                            {group.units.map(unit => (
                              <option key={unit} value={unit}>{unit}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Value</label>
                      <input
                        type="number"
                        step="any"
                        value={formData.minValue}
                        onChange={(e) => setFormData({ ...formData, minValue: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Maximum Value</label>
                      <input
                        type="number"
                        step="any"
                        value={formData.maxValue}
                        onChange={(e) => setFormData({ ...formData, maxValue: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        placeholder="1000"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Placeholder</label>
                      <input
                        type="text"
                        value={formData.placeholder}
                        onChange={(e) => setFormData({ ...formData, placeholder: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        placeholder="Enter value..."
                      />
                    </div>
                  </div>
                )}

                {/* Text-specific options */}
                {formData.type === 'TEXT' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Placeholder</label>
                      <input
                        type="text"
                        value={formData.placeholder}
                        onChange={(e) => setFormData({ ...formData, placeholder: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        placeholder="Enter text..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Validation Pattern (Regex)</label>
                      <input
                        type="text"
                        value={formData.validationPattern}
                        onChange={(e) => setFormData({ ...formData, validationPattern: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        placeholder="^[A-Za-z]+$"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Validation Error Message</label>
                      <input
                        type="text"
                        value={formData.validationMessage}
                        onChange={(e) => setFormData({ ...formData, validationMessage: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        placeholder="Please enter only letters"
                      />
                    </div>
                  </div>
                )}

                {/* Flags */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <label className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
                    <input
                      type="checkbox"
                      checked={formData.isRequired}
                      onChange={(e) => setFormData({ ...formData, isRequired: e.target.checked })}
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-700">Required</span>
                  </label>
                  <label className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
                    <input
                      type="checkbox"
                      checked={formData.isFilterable}
                      onChange={(e) => setFormData({ ...formData, isFilterable: e.target.checked })}
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-700">Filterable</span>
                  </label>
                  <label className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
                    <input
                      type="checkbox"
                      checked={formData.isSearchable}
                      onChange={(e) => setFormData({ ...formData, isSearchable: e.target.checked })}
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-700">Searchable</span>
                  </label>
                  <label className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
                    <input
                      type="checkbox"
                      checked={formData.isVisible}
                      onChange={(e) => setFormData({ ...formData, isVisible: e.target.checked })}
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-700">Visible on Product</span>
                  </label>
                </div>

                <div className="flex gap-2 pt-4">
                  <button
                    type="submit"
                    disabled={savingAttribute}
                    className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingAttribute ? 'Saving...' : (editingAttribute ? 'Update Attribute' : 'Create Attribute')}
                  </button>
                  <button
                    type="button"
                    onClick={cancelForm}
                    className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Attributes List */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold">
                Attributes ({filteredAttributes.length})
              </h2>
            </div>
            <div className="p-4">
              {filteredAttributes.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {attributes.length === 0 
                    ? 'No attributes found. Create your first attribute to get started.'
                    : 'No attributes match your filters.'}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredAttributes.map((attribute) => (
                    <div
                      key={attribute.id}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xl">{getTypeIcon(attribute.type)}</span>
                            <h3 className="text-lg font-medium text-gray-900">{attribute.name}</h3>
                            <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                              {attribute.type}
                            </span>
                            {attribute.unit && (
                              <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                                Unit: {attribute.unit}
                              </span>
                            )}
                            {attribute.isGlobal ? (
                              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                                Global
                              </span>
                            ) : (
                              <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                                {attribute.category?.name || 'Category-specific'}
                              </span>
                            )}
                            {(attribute.productCount || 0) > 0 && (
                              <span className="text-xs bg-orange-100 text-orange-800 px-2 py-0.5 rounded">
                                {attribute.productCount} products
                              </span>
                            )}
                          </div>
                          
                          {attribute.description && (
                            <p className="text-sm text-gray-600 mt-1">{attribute.description}</p>
                          )}
                          
                          <div className="mt-2 flex flex-wrap gap-2">
                            {attribute.isRequired && (
                              <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded">Required</span>
                            )}
                            {attribute.isFilterable && (
                              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">Filterable</span>
                            )}
                            {attribute.isSearchable && (
                              <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded">Searchable</span>
                            )}
                            {attribute.minValue !== undefined && (
                              <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                                Min: {attribute.minValue}
                              </span>
                            )}
                            {attribute.maxValue !== undefined && (
                              <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                                Max: {attribute.maxValue}
                              </span>
                            )}
                          </div>

                          {/* Values for SELECT/MULTISELECT/COLOR */}
                          {['SELECT', 'MULTISELECT', 'COLOR'].includes(attribute.type) && (
                            <div className="mt-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-gray-700">
                                  Values ({attribute.values?.length || 0}):
                                </span>
                                <button
                                  onClick={() => {
                                    setShowValuesModal(attribute.id);
                                    if (!attribute.values) {
                                      fetchAttributeValues(attribute.id);
                                    }
                                  }}
                                  className="text-sm text-purple-600 hover:text-purple-800"
                                >
                                  Manage Values
                                </button>
                              </div>
                              {attribute.values && attribute.values.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                  {attribute.values.slice(0, 10).map((val) => (
                                    <span
                                      key={val.id}
                                      className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded flex items-center gap-1"
                                    >
                                      {attribute.type === 'COLOR' && val.colorHex && (
                                        <span 
                                          className="w-3 h-3 rounded-full border border-gray-300"
                                          style={{ backgroundColor: val.colorHex }}
                                        />
                                      )}
                                      {val.value}
                                    </span>
                                  ))}
                                  {(attribute.values?.length || 0) > 10 && (
                                    <span className="text-xs text-gray-500">
                                      +{attribute.values.length - 10} more
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2 ml-4">
                          <button
                            onClick={() => {
                              setShowUsageModal(attribute.id);
                              fetchAttributeUsage(attribute.id);
                            }}
                            className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                            title="View usage"
                          >
                            📊
                          </button>
                          <button
                            onClick={() => handleDuplicateAttribute(attribute)}
                            className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                            title="Duplicate"
                          >
                            📋
                          </button>
                          <button
                            onClick={() => startEdit(attribute)}
                            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteAttribute(attribute.id)}
                            className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Values Modal */}
          {showValuesModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-xl p-6 max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">
                    Manage Values: {attributes.find(a => a.id === showValuesModal)?.name}
                  </h3>
                  <button
                    onClick={() => {
                      setShowValuesModal(null);
                      setNewValue('');
                      setShowBulkAdd(false);
                      setBulkValues('');
                    }}
                    className="text-gray-500 hover:text-gray-700 text-2xl"
                  >
                    ×
                  </button>
                </div>
                
                <div className="space-y-4 flex-1 overflow-auto">
                  {/* Add single value */}
                  {!showBulkAdd && (
                    <div className="flex gap-2">
                      {attributes.find(a => a.id === showValuesModal)?.type === 'COLOR' && (
                        <input
                          type="color"
                          value={colorHex}
                          onChange={(e) => setColorHex(e.target.value)}
                          className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
                        />
                      )}
                      <input
                        type="text"
                        value={newValue}
                        onChange={(e) => setNewValue(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddValue(showValuesModal);
                          }
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        placeholder="Enter value..."
                      />
                      <button
                        onClick={() => handleAddValue(showValuesModal)}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                      >
                        Add
                      </button>
                    </div>
                  )}

                  {/* Bulk add toggle */}
                  <div className="flex justify-end">
                    <button
                      onClick={() => setShowBulkAdd(!showBulkAdd)}
                      className="text-sm text-purple-600 hover:text-purple-800"
                    >
                      {showBulkAdd ? 'Single Add' : 'Bulk Add'}
                    </button>
                  </div>

                  {/* Bulk add area */}
                  {showBulkAdd && (
                    <div className="space-y-2">
                      <textarea
                        value={bulkValues}
                        onChange={(e) => setBulkValues(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 h-32"
                        placeholder="Enter one value per line:&#10;Small&#10;Medium&#10;Large"
                      />
                      <button
                        onClick={() => handleBulkAddValues(showValuesModal)}
                        className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                      >
                        Add All Values
                      </button>
                    </div>
                  )}

                  {/* Values list */}
                  <div className="space-y-2">
                    {attributes
                      .find((a) => a.id === showValuesModal)
                      ?.values?.sort((a, b) => a.order - b.order)
                      .map((val, index, arr) => (
                        <div
                          key={val.id}
                          className="flex items-center justify-between p-2 bg-gray-50 rounded"
                        >
                          <div className="flex items-center gap-2">
                            {val.colorHex && (
                              <span 
                                className="w-6 h-6 rounded border border-gray-300"
                                style={{ backgroundColor: val.colorHex }}
                              />
                            )}
                            <span>{val.value}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleReorderValue(showValuesModal, val.id, 'up')}
                              disabled={index === 0}
                              className="px-2 py-1 text-gray-500 hover:text-gray-700 disabled:opacity-30"
                            >
                              ↑
                            </button>
                            <button
                              onClick={() => handleReorderValue(showValuesModal, val.id, 'down')}
                              disabled={index === arr.length - 1}
                              className="px-2 py-1 text-gray-500 hover:text-gray-700 disabled:opacity-30"
                            >
                              ↓
                            </button>
                            <button
                              onClick={() => handleDeleteValue(val.id, showValuesModal)}
                              className="px-2 py-1 text-red-600 hover:text-red-800"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Usage Modal */}
          {showUsageModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-xl p-6 max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">
                    Usage: {attributes.find(a => a.id === showUsageModal)?.name}
                  </h3>
                  <button
                    onClick={() => {
                      setShowUsageModal(null);
                      setUsageProducts([]);
                    }}
                    className="text-gray-500 hover:text-gray-700 text-2xl"
                  >
                    ×
                  </button>
                </div>
                
                <div className="flex-1 overflow-auto">
                  {loadingUsage ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                    </div>
                  ) : usageProducts.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No products are using this attribute yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {usageProducts.map((product) => (
                        <div key={product.id} className="p-3 bg-gray-50 rounded flex items-center gap-3">
                          {product.images?.[0] && (
                            <Image
                              src={typeof product.images[0] === 'string' ? product.images[0] : product.images[0].url}
                              alt={product.name}
                              width={40}
                              height={40}
                              className="object-cover rounded"
                            />
                          )}
                          <div>
                            <p className="font-medium">{product.name}</p>
                            <p className="text-sm text-gray-500">{product.sku}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
