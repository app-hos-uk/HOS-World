'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

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
  isGlobal: boolean;
  categoryId?: string;
  category?: { id: string; name: string };
  values?: AttributeValue[];
}

interface Category {
  id: string;
  name: string;
  level: number;
}

export default function AdminAttributesPage() {
  const toast = useToast();
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingAttribute, setEditingAttribute] = useState<Attribute | null>(null);
  const [showValuesModal, setShowValuesModal] = useState<string | null>(null);
  const [newValue, setNewValue] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    type: 'TEXT' as 'TEXT' | 'NUMBER' | 'SELECT' | 'BOOLEAN' | 'DATE',
    isRequired: false,
    isFilterable: true,
    isSearchable: false,
    isGlobal: true,
    categoryId: '',
  });

  useEffect(() => {
    fetchAttributes();
    fetchCategories();
  }, []);

  const fetchAttributes = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getAttributes();
      if (response?.data) {
        setAttributes(response.data);
      }
    } catch (err: any) {
      console.error('Error fetching attributes:', err);
      setError(err.message || 'Failed to load attributes');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await apiClient.getCategories();
      if (response?.data) {
        setCategories(response.data);
      }
    } catch (err: any) {
      console.error('Error fetching categories:', err);
    }
  };

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

  const handleCreateAttribute = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.createAttribute({
        name: formData.name,
        type: formData.type,
        isRequired: formData.isRequired,
        isFilterable: formData.isFilterable,
        isSearchable: formData.isSearchable,
        isGlobal: formData.isGlobal,
        categoryId: formData.isGlobal ? undefined : formData.categoryId || undefined,
      });
      toast.success('Attribute created successfully');
      setShowCreateForm(false);
      setFormData({
        name: '',
        type: 'TEXT',
        isRequired: false,
        isFilterable: true,
        isSearchable: false,
        isGlobal: true,
        categoryId: '',
      });
      fetchAttributes();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create attribute');
    }
  };

  const handleUpdateAttribute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAttribute) return;
    try {
      await apiClient.updateAttribute(editingAttribute.id, {
        name: formData.name,
        type: formData.type,
        isRequired: formData.isRequired,
        isFilterable: formData.isFilterable,
        isSearchable: formData.isSearchable,
        isGlobal: formData.isGlobal,
        categoryId: formData.isGlobal ? undefined : formData.categoryId || undefined,
      });
      toast.success('Attribute updated successfully');
      setEditingAttribute(null);
      setShowCreateForm(false);
      setFormData({
        name: '',
        type: 'TEXT',
        isRequired: false,
        isFilterable: true,
        isSearchable: false,
        isGlobal: true,
        categoryId: '',
      });
      fetchAttributes();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update attribute');
    }
  };

  const handleDeleteAttribute = async (id: string) => {
    if (!confirm('Are you sure you want to delete this attribute? This action cannot be undone.')) {
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
    try {
      await apiClient.createAttributeValue(attributeId, {
        value: newValue.trim(),
        order: 0,
      });
      toast.success('Attribute value added successfully');
      setNewValue('');
      fetchAttributeValues(attributeId);
    } catch (err: any) {
      toast.error(err.message || 'Failed to add attribute value');
    }
  };

  const handleDeleteValue = async (valueId: string, attributeId: string) => {
    if (!confirm('Are you sure you want to delete this value?')) {
      return;
    }
    try {
      await apiClient.deleteAttributeValue(valueId);
      toast.success('Attribute value deleted successfully');
      fetchAttributeValues(attributeId);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete attribute value');
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
      isGlobal: attribute.isGlobal,
      categoryId: attribute.categoryId || '',
    });
    setShowCreateForm(true);
  };

  const cancelForm = () => {
    setShowCreateForm(false);
    setEditingAttribute(null);
    setFormData({
      name: '',
      type: 'TEXT',
      isRequired: false,
      isFilterable: true,
      isSearchable: false,
      isGlobal: true,
      categoryId: '',
    });
  };

  const getAllCategoriesFlat = (cats: Category[]): Category[] => {
    const result: Category[] = [];
    const traverse = (items: Category[]) => {
      for (const item of items) {
        result.push(item);
      }
    };
    traverse(cats);
    return result;
  };

  if (loading) {
    return (
      <RouteGuard allowedRoles={['ADMIN']}>
        <AdminLayout>
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Loading attributes...</div>
          </div>
        </AdminLayout>
      </RouteGuard>
    );
  }

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Product Attributes</h1>
            <button
              onClick={() => {
                setShowCreateForm(true);
                setEditingAttribute(null);
                setFormData({
                  name: '',
                  type: 'TEXT',
                  isRequired: false,
                  isFilterable: true,
                  isSearchable: false,
                  isGlobal: true,
                  categoryId: '',
                });
              }}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              + Add Attribute
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">Error: {error}</p>
            </div>
          )}

          {showCreateForm && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">
                {editingAttribute ? 'Edit Attribute' : 'Create New Attribute'}
              </h2>
              <form
                onSubmit={editingAttribute ? handleUpdateAttribute : handleCreateAttribute}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Attribute Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="e.g., Size, Color, Material"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select
                      value={formData.type}
                      onChange={(e) =>
                        setFormData({ ...formData, type: e.target.value as any })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="TEXT">Text</option>
                      <option value="NUMBER">Number</option>
                      <option value="SELECT">Select (Dropdown)</option>
                      <option value="BOOLEAN">Boolean (Yes/No)</option>
                      <option value="DATE">Date</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Scope</label>
                    <select
                      value={formData.isGlobal ? 'global' : 'category'}
                      onChange={(e) =>
                        setFormData({ ...formData, isGlobal: e.target.value === 'global' })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="global">Global (All Categories)</option>
                      <option value="category">Category-Specific</option>
                    </select>
                  </div>
                </div>
                {!formData.isGlobal && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select
                      value={formData.categoryId}
                      onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      required={!formData.isGlobal}
                    >
                      <option value="">Select a category</option>
                      {getAllCategoriesFlat(categories).map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="space-y-2">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.isRequired}
                      onChange={(e) => setFormData({ ...formData, isRequired: e.target.checked })}
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-700">Required</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.isFilterable}
                      onChange={(e) => setFormData({ ...formData, isFilterable: e.target.checked })}
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-700">Filterable (Show in filters)</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.isSearchable}
                      onChange={(e) => setFormData({ ...formData, isSearchable: e.target.checked })}
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-700">Searchable (Include in search)</span>
                  </label>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                  >
                    {editingAttribute ? 'Update Attribute' : 'Create Attribute'}
                  </button>
                  <button
                    type="button"
                    onClick={cancelForm}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">All Attributes</h2>
            </div>
            <div className="p-4">
              {attributes.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No attributes found. Create your first attribute to get started.
                </div>
              ) : (
                <div className="space-y-4">
                  {attributes.map((attribute) => (
                    <div
                      key={attribute.id}
                      className="border border-gray-200 rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-medium text-gray-900">{attribute.name}</h3>
                            <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                              {attribute.type}
                            </span>
                            {attribute.isGlobal ? (
                              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                                Global
                              </span>
                            ) : (
                              <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                                {attribute.category?.name || 'Category-specific'}
                              </span>
                            )}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {attribute.isRequired && (
                              <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded">
                                Required
                              </span>
                            )}
                            {attribute.isFilterable && (
                              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                                Filterable
                              </span>
                            )}
                            {attribute.isSearchable && (
                              <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded">
                                Searchable
                              </span>
                            )}
                          </div>
                          {attribute.type === 'SELECT' && (
                            <div className="mt-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-gray-700">Values:</span>
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
                                  {attribute.values.map((val) => (
                                    <span
                                      key={val.id}
                                      className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded"
                                    >
                                      {val.value}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
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
              <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Manage Attribute Values</h3>
                  <button
                    onClick={() => {
                      setShowValuesModal(null);
                      setNewValue('');
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ×
                  </button>
                </div>
                <div className="space-y-4">
                  <div className="flex gap-2">
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
                      placeholder="Enter value (e.g., Small, Red, Cotton)"
                    />
                    <button
                      onClick={() => handleAddValue(showValuesModal)}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                    >
                      Add
                    </button>
                  </div>
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {attributes
                      .find((a) => a.id === showValuesModal)
                      ?.values?.map((val) => (
                        <div
                          key={val.id}
                          className="flex items-center justify-between p-2 bg-gray-50 rounded"
                        >
                          <span>{val.value}</span>
                          <button
                            onClick={() => handleDeleteValue(val.id, showValuesModal)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}

