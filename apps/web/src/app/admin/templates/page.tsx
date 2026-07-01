'use client';

import { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import { sanitizeEmailPreviewHtml, wrapEmailPreviewDocument } from '@/lib/sanitizeHtml';
import { TipTapEditor } from '@/components/cms/TipTapEditor';

interface TemplateDefinition {
  slug: string;
  channel: 'EMAIL' | 'WHATSAPP' | 'SMS' | 'IN_APP';
  subject?: string;
  body: string;
  variables: string[];
  description?: string;
  isCustomized?: boolean;
}

const CHANNEL_COLORS: Record<string, string> = {
  EMAIL: 'bg-hos-gold/20 text-hos-gold',
  WHATSAPP: 'bg-green-500/15 text-green-300',
  SMS: 'bg-yellow-500/15 text-yellow-300',
  IN_APP: 'bg-hos-gold/20 text-hos-gold',
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
  const [isEditing, setIsEditing] = useState(false);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

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

  const handleSelectTemplate = async (t: TemplateDefinition) => {
    setSelectedTemplate(t);
    setPreviewHtml(null);
    setTestResult(null);
    setIsEditing(false);
    setSaveMessage(null);
    setSaveError(null);
    const vars: Record<string, string> = {};
    t.variables.forEach((v) => (vars[v] = ''));
    setTestVars(vars);
    setEditSubject(t.subject || '');
    setEditBody(t.body);

    try {
      const res = await apiClient.getTemplate(t.slug);
      const full = res.data as TemplateDefinition;
      setSelectedTemplate(full);
      setEditSubject(full.subject || '');
      setEditBody(full.body);
    } catch {
      // keep list item data
    }

    handlePreview(t.slug);
  };

  const handleSaveTemplate = async () => {
    if (!selectedTemplate || selectedTemplate.channel !== 'EMAIL') return;
    setSaveLoading(true);
    setSaveMessage(null);
    setSaveError(null);
    try {
      await apiClient.updateTemplate(selectedTemplate.slug, {
        channel: 'EMAIL',
        subject: editSubject,
        content: editBody,
        variables: selectedTemplate.variables,
        description: selectedTemplate.description,
      });
      setSaveMessage('Template saved. Changes apply to future emails.');
      setIsEditing(false);
      const updated: TemplateDefinition = {
        ...selectedTemplate,
        subject: editSubject,
        body: editBody,
        isCustomized: true,
      };
      setSelectedTemplate(updated);
      setTemplates((prev) =>
        prev.map((t) => (t.slug === updated.slug ? { ...t, ...updated } : t)),
      );
      await handlePreview(selectedTemplate.slug);
    } catch {
      setSaveError('Failed to save template. Please try again.');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleResetTemplate = async () => {
    if (!selectedTemplate || selectedTemplate.channel !== 'EMAIL') return;
    if (!window.confirm('Reset this template to the built-in default? Your custom changes will be removed.')) {
      return;
    }
    setSaveLoading(true);
    setSaveMessage(null);
    setSaveError(null);
    try {
      const res = await apiClient.resetTemplateOverride(selectedTemplate.slug);
      const reset = res.data as TemplateDefinition;
      setSelectedTemplate({ ...reset, isCustomized: false });
      setEditSubject(reset.subject || '');
      setEditBody(reset.body);
      setIsEditing(false);
      setSaveMessage('Template reset to built-in default.');
      await fetchTemplates();
      await handlePreview(selectedTemplate.slug);
    } catch {
      setSaveError('Failed to reset template.');
    } finally {
      setSaveLoading(false);
    }
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
    <RouteGuard allowedRoles={['ADMIN']}>
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-hos-text-secondary">Notification Templates</h1>
            <p className="text-hos-text-secondary mt-1">
              Preview and customize email, WhatsApp, SMS, and in-app notification templates
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
                  ? 'border-hos-gold bg-hos-gold/10'
                  : 'border-hos-border bg-hos-bg-secondary hover:border-hos-border'
              }`}
            >
              <div className="text-2xl mb-1">{CHANNEL_ICONS[ch]}</div>
              <div className="text-sm font-medium text-hos-text-secondary">{ch.replace('_', '-')}</div>
              <div className="text-2xl font-bold text-hos-gold-hover">{channelCounts[ch] || 0}</div>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Template list */}
          <div className="lg:col-span-1 space-y-2">
            <h2 className="text-lg font-semibold text-hos-text-secondary mb-3">Templates</h2>
            {loading ? (
              <div className="text-center py-8 text-hos-text-muted">Loading...</div>
            ) : templates.length === 0 ? (
              <div className="text-center py-8 text-hos-text-muted">No templates found</div>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {templates.map((t) => (
                  <button
                    key={t.slug}
                    onClick={() => handleSelectTemplate(t)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      selectedTemplate?.slug === t.slug
                        ? 'border-hos-gold bg-hos-gold/10 shadow-sm'
                        : 'border-hos-border bg-hos-bg-secondary hover:border-hos-border'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm text-hos-text-secondary">
                        {t.slug.replace(/_/g, ' ')}
                      </span>
                      <div className="flex items-center gap-1">
                        {t.isCustomized && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300">
                            Custom
                          </span>
                        )}
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            CHANNEL_COLORS[t.channel]
                          }`}
                        >
                          {t.channel}
                        </span>
                      </div>
                    </div>
                    {t.description && (
                      <p className="text-xs text-hos-text-muted line-clamp-2">{t.description}</p>
                    )}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {t.variables.map((v) => (
                        <span
                          key={v}
                          className="text-[10px] bg-hos-bg-tertiary text-hos-text-secondary px-1.5 py-0.5 rounded"
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
                <div className="bg-hos-bg-secondary rounded-xl border border-hos-border p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-bold text-hos-text-secondary">
                      {selectedTemplate.slug.replace(/_/g, ' ')}
                    </h2>
                    <div className="flex items-center gap-2">
                      {selectedTemplate.isCustomized && (
                        <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-amber-500/15 text-amber-300">
                          Customized
                        </span>
                      )}
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                          CHANNEL_COLORS[selectedTemplate.channel]
                        }`}
                      >
                        {CHANNEL_ICONS[selectedTemplate.channel]} {selectedTemplate.channel}
                      </span>
                    </div>
                  </div>

                  {selectedTemplate.channel === 'EMAIL' && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {!isEditing ? (
                        <button
                          onClick={() => setIsEditing(true)}
                          className="px-3 py-1.5 text-sm rounded-lg border border-hos-border hover:border-hos-gold text-hos-text-secondary"
                        >
                          Edit Template
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={handleSaveTemplate}
                            disabled={saveLoading}
                            className="px-3 py-1.5 text-sm rounded-lg bg-hos-gold text-[#1a1406] hover:bg-hos-gold-hover disabled:opacity-50"
                          >
                            {saveLoading ? 'Saving...' : 'Save Changes'}
                          </button>
                          <button
                            onClick={() => {
                              setIsEditing(false);
                              setEditSubject(selectedTemplate.subject || '');
                              setEditBody(selectedTemplate.body);
                            }}
                            className="px-3 py-1.5 text-sm rounded-lg border border-hos-border text-hos-text-secondary"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                      {selectedTemplate.isCustomized && !isEditing && (
                        <button
                          onClick={handleResetTemplate}
                          disabled={saveLoading}
                          className="px-3 py-1.5 text-sm rounded-lg border border-red-500/40 text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                        >
                          Reset to Default
                        </button>
                      )}
                    </div>
                  )}

                  {saveMessage && (
                    <p className="text-sm text-green-400 mb-3">{saveMessage}</p>
                  )}
                  {saveError && (
                    <p className="text-sm text-red-400 mb-3">{saveError}</p>
                  )}

                  {selectedTemplate.description && (
                    <p className="text-sm text-hos-text-secondary mb-3">{selectedTemplate.description}</p>
                  )}

                  {selectedTemplate.subject && (
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-hos-text-muted mb-1">
                        Subject Line
                      </label>
                      {isEditing && selectedTemplate.channel === 'EMAIL' ? (
                        <input
                          type="text"
                          value={editSubject}
                          onChange={(e) => setEditSubject(e.target.value)}
                          className="w-full bg-hos-bg-secondary rounded-lg px-3 py-2 text-sm font-mono text-hos-text-secondary border border-hos-border focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold"
                        />
                      ) : (
                        <div className="bg-hos-bg-secondary rounded-lg px-3 py-2 text-sm font-mono text-hos-text-secondary">
                          {selectedTemplate.subject}
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-hos-text-muted mb-1">
                      Required Variables
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {selectedTemplate.variables.map((v) => (
                        <span
                          key={v}
                          className="text-xs bg-hos-gold/10 text-hos-gold px-2 py-1 rounded-md font-mono"
                        >
                          {'{{' + v + '}}'}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Test render form */}
                <div className="bg-hos-bg-secondary rounded-xl border border-hos-border p-5">
                  <h3 className="text-sm font-semibold text-hos-text-secondary mb-3">
                    Test Render with Custom Variables
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    {selectedTemplate.variables.map((v) => (
                      <div key={v}>
                        <label className="block text-xs font-medium text-hos-text-secondary mb-1">
                          {v}
                        </label>
                        <input
                          type="text"
                          value={testVars[v] || ''}
                          onChange={(e) =>
                            setTestVars({ ...testVars, [v]: e.target.value })
                          }
                          placeholder={`Enter ${v}...`}
                          className="w-full px-3 py-1.5 border border-hos-border rounded-lg text-sm focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold"
                        />
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={handleTestRender}
                    disabled={testLoading}
                    className="px-4 py-2 bg-hos-gold text-[#1a1406] text-sm rounded-lg hover:bg-hos-gold-hover disabled:opacity-50 transition-colors"
                  >
                    {testLoading ? 'Rendering...' : 'Render Template'}
                  </button>
                </div>

                {/* Preview pane */}
                <div className="bg-hos-bg-secondary rounded-xl border border-hos-border overflow-hidden">
                  <div className="px-5 py-3 border-b border-hos-border bg-hos-bg-secondary">
                    <h3 className="text-sm font-semibold text-hos-text-secondary">
                      {testResult ? 'Custom Render' : 'Sample Preview'}
                    </h3>
                    {(testResult || previewHtml)?.subject && (
                      <p className="text-xs text-hos-text-muted mt-0.5">
                        Subject: {(testResult || previewHtml)?.subject}
                      </p>
                    )}
                  </div>
                  <div className="p-4">
                    {previewLoading ? (
                      <div className="text-center py-8 text-hos-text-muted">Loading preview...</div>
                    ) : testResult ? (
                      selectedTemplate.channel === 'EMAIL' ? (
                        <iframe
                          srcDoc={wrapEmailPreviewDocument(testResult.body)}
                          sandbox=""
                          className="w-full h-[400px] border border-hos-border rounded-lg bg-white"
                          title="Custom render"
                        />
                      ) : (
                        <div className="bg-hos-bg-secondary rounded-lg p-4">
                          <pre className="text-sm whitespace-pre-wrap text-hos-text-secondary">
                            {testResult.body}
                          </pre>
                        </div>
                      )
                    ) : previewHtml ? (
                      selectedTemplate.channel === 'EMAIL' ? (
                        <iframe
                          srcDoc={wrapEmailPreviewDocument(previewHtml.body)}
                          sandbox=""
                          className="w-full h-[400px] border border-hos-border rounded-lg bg-white"
                          title="Email preview"
                        />
                      ) : (
                        <div className="bg-hos-bg-secondary rounded-lg p-4">
                          <pre className="text-sm whitespace-pre-wrap text-hos-text-secondary">
                            {previewHtml.body}
                          </pre>
                        </div>
                      )
                    ) : (
                      <div className="text-center py-8 text-hos-text-muted">
                        Select a template to see its preview
                      </div>
                    )}
                  </div>
                </div>

                {/* Raw template body */}
                <details className="bg-hos-bg-secondary rounded-xl border border-hos-border overflow-hidden" open={isEditing}>
                  <summary className="px-5 py-3 cursor-pointer text-sm font-medium text-hos-text-secondary hover:bg-hos-bg-tertiary">
                    {isEditing ? 'Edit Template Body' : 'View Raw Template Source'}
                  </summary>
                  <div className="p-4 border-t border-hos-border">
                    {isEditing && selectedTemplate.channel === 'EMAIL' ? (
                      <TipTapEditor
                        content={editBody}
                        onChange={setEditBody}
                        placeholder="Edit email body — use the toolbar for formatting. Template variables like {{orderNumber}} can be typed directly."
                      />
                    ) : (
                      <pre className="text-xs bg-hos-bg-secondary rounded-lg p-4 overflow-x-auto max-h-[300px] whitespace-pre-wrap">
                        {selectedTemplate.body}
                      </pre>
                    )}
                  </div>
                </details>
              </div>
            ) : (
              <div className="bg-hos-bg-secondary rounded-xl border border-hos-border p-12 text-center">
                <div className="text-4xl mb-3">📋</div>
                <h3 className="text-lg font-semibold text-hos-text-secondary">Select a Template</h3>
                <p className="text-sm text-hos-text-muted mt-1">
                  Choose a template from the list to view its details, preview, and test with custom
                  variables.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
    </RouteGuard>
  );
}
