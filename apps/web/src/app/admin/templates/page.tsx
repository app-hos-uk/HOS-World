'use client';

import { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';

interface TemplateDefinition {
  slug: string;
  channel: 'EMAIL' | 'WHATSAPP' | 'SMS' | 'IN_APP';
  subject?: string;
  body: string;
  variables: string[];
  description?: string;
}

const CHANNEL_COLORS: Record<string, string> = {
  EMAIL: 'bg-blue-100 text-blue-800',
  WHATSAPP: 'bg-green-100 text-green-800',
  SMS: 'bg-yellow-100 text-yellow-800',
  IN_APP: 'bg-purple-100 text-purple-800',
};

const CHANNEL_ICONS: Record<string, string> = {
  EMAIL: '✉️',
  WHATSAPP: '💬',
  SMS: '📱',
  IN_APP: '🔔',
};

export default function AdminTemplatesPage() {
  const [templates, setTemplates] = useState<TemplateDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateDefinition | null>(null);
  const [previewHtml, setPreviewHtml] = useState<{ subject: string; body: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [testVars, setTestVars] = useState<Record<string, string>>({});
  const [testResult, setTestResult] = useState<{ subject: string; body: string } | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.getTemplates(selectedChannel || undefined);
      setTemplates(res.data || []);
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, [apiClient, selectedChannel]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handlePreview = async (slug: string) => {
    setPreviewLoading(true);
    setTestResult(null);
    try {
      const res = await apiClient.previewTemplate(slug);
      setPreviewHtml(res.data || null);
    } catch {
      setPreviewHtml(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSelectTemplate = (t: TemplateDefinition) => {
    setSelectedTemplate(t);
    setPreviewHtml(null);
    setTestResult(null);
    const vars: Record<string, string> = {};
    t.variables.forEach((v) => (vars[v] = ''));
    setTestVars(vars);
    handlePreview(t.slug);
  };

  const handleTestRender = async () => {
    if (!selectedTemplate) return;
    setTestLoading(true);
    try {
      const res = await apiClient.renderTemplate(selectedTemplate.slug, testVars);
      setTestResult(res.data || null);
    } catch {
      setTestResult(null);
    } finally {
      setTestLoading(false);
    }
  };

  const channelCounts = templates.reduce(
    (acc, t) => {
      acc[t.channel] = (acc[t.channel] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Notification Templates</h1>
            <p className="text-gray-600 mt-1">
              Manage email, WhatsApp, SMS, and in-app notification templates
            </p>
          </div>
        </div>

        {/* Channel stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {(['EMAIL', 'WHATSAPP', 'SMS', 'IN_APP'] as const).map((ch) => (
            <button
              key={ch}
              onClick={() => setSelectedChannel(selectedChannel === ch ? '' : ch)}
              className={`p-4 rounded-xl border-2 transition-all ${
                selectedChannel === ch
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="text-2xl mb-1">{CHANNEL_ICONS[ch]}</div>
              <div className="text-sm font-medium text-gray-900">{ch.replace('_', '-')}</div>
              <div className="text-2xl font-bold text-purple-700">{channelCounts[ch] || 0}</div>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Template list */}
          <div className="lg:col-span-1 space-y-2">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Templates</h2>
            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading...</div>
            ) : templates.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No templates found</div>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {templates.map((t) => (
                  <button
                    key={t.slug}
                    onClick={() => handleSelectTemplate(t)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      selectedTemplate?.slug === t.slug
                        ? 'border-purple-500 bg-purple-50 shadow-sm'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm text-gray-900">
                        {t.slug.replace(/_/g, ' ')}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          CHANNEL_COLORS[t.channel]
                        }`}
                      >
                        {t.channel}
                      </span>
                    </div>
                    {t.description && (
                      <p className="text-xs text-gray-500 line-clamp-2">{t.description}</p>
                    )}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {t.variables.map((v) => (
                        <span
                          key={v}
                          className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded"
                        >
                          {'{{' + v + '}}'}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Template detail + preview */}
          <div className="lg:col-span-2">
            {selectedTemplate ? (
              <div className="space-y-4">
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-bold text-gray-900">
                      {selectedTemplate.slug.replace(/_/g, ' ')}
                    </h2>
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                        CHANNEL_COLORS[selectedTemplate.channel]
                      }`}
                    >
                      {CHANNEL_ICONS[selectedTemplate.channel]} {selectedTemplate.channel}
                    </span>
                  </div>

                  {selectedTemplate.description && (
                    <p className="text-sm text-gray-600 mb-3">{selectedTemplate.description}</p>
                  )}

                  {selectedTemplate.subject && (
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Subject Line
                      </label>
                      <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm font-mono text-gray-800">
                        {selectedTemplate.subject}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Required Variables
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {selectedTemplate.variables.map((v) => (
                        <span
                          key={v}
                          className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-md font-mono"
                        >
                          {'{{' + v + '}}'}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Test render form */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">
                    Test Render with Custom Variables
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    {selectedTemplate.variables.map((v) => (
                      <div key={v}>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          {v}
                        </label>
                        <input
                          type="text"
                          value={testVars[v] || ''}
                          onChange={(e) =>
                            setTestVars({ ...testVars, [v]: e.target.value })
                          }
                          placeholder={`Enter ${v}...`}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        />
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={handleTestRender}
                    disabled={testLoading}
                    className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
                  >
                    {testLoading ? 'Rendering...' : 'Render Template'}
                  </button>
                </div>

                {/* Preview pane */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-200 bg-gray-50">
                    <h3 className="text-sm font-semibold text-gray-900">
                      {testResult ? 'Custom Render' : 'Sample Preview'}
                    </h3>
                    {(testResult || previewHtml)?.subject && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        Subject: {(testResult || previewHtml)?.subject}
                      </p>
                    )}
                  </div>
                  <div className="p-4">
                    {previewLoading ? (
                      <div className="text-center py-8 text-gray-500">Loading preview...</div>
                    ) : testResult ? (
                      selectedTemplate.channel === 'EMAIL' ? (
                        <iframe
                          srcDoc={testResult.body}
                          className="w-full h-[400px] border-0 rounded-lg"
                          title="Custom render"
                        />
                      ) : (
                        <div className="bg-gray-50 rounded-lg p-4">
                          <pre className="text-sm whitespace-pre-wrap text-gray-800">
                            {testResult.body}
                          </pre>
                        </div>
                      )
                    ) : previewHtml ? (
                      selectedTemplate.channel === 'EMAIL' ? (
                        <iframe
                          srcDoc={previewHtml.body}
                          className="w-full h-[400px] border-0 rounded-lg"
                          title="Email preview"
                        />
                      ) : (
                        <div className="bg-gray-50 rounded-lg p-4">
                          <pre className="text-sm whitespace-pre-wrap text-gray-800">
                            {previewHtml.body}
                          </pre>
                        </div>
                      )
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        Select a template to see its preview
                      </div>
                    )}
                  </div>
                </div>

                {/* Raw template body */}
                <details className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <summary className="px-5 py-3 cursor-pointer text-sm font-medium text-gray-700 hover:bg-gray-50">
                    View Raw Template Source
                  </summary>
                  <div className="p-4 border-t border-gray-200">
                    <pre className="text-xs bg-gray-50 rounded-lg p-4 overflow-x-auto max-h-[300px] whitespace-pre-wrap">
                      {selectedTemplate.body}
                    </pre>
                  </div>
                </details>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <div className="text-4xl mb-3">📋</div>
                <h3 className="text-lg font-semibold text-gray-900">Select a Template</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Choose a template from the list to view its details, preview, and test with custom
                  variables.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
