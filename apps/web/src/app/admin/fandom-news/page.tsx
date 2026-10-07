'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { useDateTime } from '@/hooks/useDateTime';

const UNIVERSES = [
  'Marvel',
  'Star Wars',
  'DC Universe',
  'Wizarding World',
  'Middle Earth',
  'Naruto',
  'One Piece',
  'Dragon Ball',
  'Studio Ghibli',
  'Game of Thrones',
  'Disney',
  'Stranger Things',
  'The Witcher',
  'Video Games',
] as const;

const ARTICLE_STATUSES = ['auto', 'approved', 'featured', 'hidden'] as const;
const MEDIA_TYPES = ['article', 'video', 'gallery'] as const;
const MARKETS = ['US', 'MY'] as const;
const PAGE_SIZE = 20;

const inputClass = 'w-full border rounded-lg px-3 py-2 bg-hos-bg-secondary text-sm';

type FeedType = 'rss' | 'atom';
type ArticleStatus = (typeof ARTICLE_STATUSES)[number];
type MediaType = (typeof MEDIA_TYPES)[number];
type Tab = 'sources' | 'articles';

interface FandomSource {
  id: string;
  name: string;
  feedUrl: string;
  logoUrl: string | null;
  feedType: FeedType;
  marketCodes: string[];
  categories: string[];
  isActive: boolean;
  lastFetchedAt: string | null;
  articleCount: number;
  errorCount: number;
}

interface FandomArticle {
  id: string;
  title: string;
  imageUrl: string | null;
  sourceId: string;
  sourceName: string;
  status: string;
  mediaType: string;
  categories: string[];
  marketCodes: string[];
  publishedAt: string | null;
  externalUrl: string;
  videoUrl: string;
  isPinned: boolean;
  excerpt: string;
}

interface SourceForm {
  name: string;
  feedUrl: string;
  logoUrl: string;
  feedType: FeedType;
  marketCodes: string[];
  categories: string[];
  isActive: boolean;
}

interface ArticleDraft {
  status: ArticleStatus;
  categories: string[];
  marketCodes: string[];
  isPinned: boolean;
  videoUrl: string;
}

interface ConfirmState {
  title: string;
  description?: string;
  tone?: 'default' | 'danger';
  confirmLabel?: string;
  onConfirm: () => void;
}

const EMPTY_SOURCE: SourceForm = {
  name: '',
  feedUrl: '',
  logoUrl: '',
  feedType: 'rss',
  marketCodes: [],
  categories: [],
  isActive: true,
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function safeHttpUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.toString();
  } catch {
    return null;
  }
  return null;
}

function youtubeEmbedSrc(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\./, '');
    let id = '';
    if (host === 'youtu.be') id = url.pathname.split('/').filter(Boolean)[0] || '';
    else if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      if (url.pathname.startsWith('/embed/')) id = url.pathname.split('/')[2] || '';
      else if (url.pathname.startsWith('/shorts/')) id = url.pathname.split('/')[2] || '';
      else id = url.searchParams.get('v') || '';
    }
    if (!/^[\w-]{11}$/.test(id)) return null;
    return `https://www.youtube.com/embed/${id}`;
  } catch {
    return null;
  }
}

function normalizeSource(raw: unknown): FandomSource | null {
  const row = asRecord(raw);
  if (!row || typeof row.id !== 'string') return null;
  const feedType = row.feedType === 'atom' ? 'atom' : 'rss';
  return {
    id: row.id,
    name: typeof row.name === 'string' ? row.name : 'Untitled source',
    feedUrl: typeof row.feedUrl === 'string' ? row.feedUrl : '',
    logoUrl: typeof row.logoUrl === 'string' ? row.logoUrl : null,
    feedType,
    marketCodes: asStringList(row.marketCodes),
    categories: asStringList(row.categories ?? row.defaultCategories),
    isActive: Boolean(row.isActive ?? row.active ?? true),
    lastFetchedAt: typeof row.lastFetchedAt === 'string' ? row.lastFetchedAt : null,
    articleCount: Number(row.articleCount ?? 0) || 0,
    errorCount: Number(row.errorCount ?? 0) || 0,
  };
}

function normalizeArticle(raw: unknown): FandomArticle | null {
  const row = asRecord(raw);
  if (!row || typeof row.id !== 'string') return null;
  const source = asRecord(row.source);
  const status = typeof row.status === 'string' ? row.status : 'auto';
  return {
    id: row.id,
    title: typeof row.title === 'string' ? row.title : 'Untitled',
    imageUrl: typeof row.imageUrl === 'string' ? row.imageUrl : null,
    sourceId: typeof row.sourceId === 'string' ? row.sourceId : typeof source?.id === 'string' ? source.id : '',
    sourceName: typeof source?.name === 'string' ? source.name : typeof row.sourceName === 'string' ? row.sourceName : '—',
    status,
    mediaType: typeof row.mediaType === 'string' ? row.mediaType : 'article',
    categories: asStringList(row.categories),
    marketCodes: asStringList(row.marketCodes),
    publishedAt: typeof row.publishedAt === 'string' ? row.publishedAt : null,
    externalUrl: typeof row.externalUrl === 'string' ? row.externalUrl : '',
    videoUrl: typeof row.videoUrl === 'string' ? row.videoUrl : '',
    isPinned: Boolean(row.isPinned),
    excerpt: typeof row.excerpt === 'string' ? row.excerpt : '',
  };
}

function draftFromArticle(article: FandomArticle): ArticleDraft {
  const status = ARTICLE_STATUSES.includes(article.status as ArticleStatus)
    ? (article.status as ArticleStatus)
    : 'auto';
  return {
    status,
    categories: article.categories,
    marketCodes: article.marketCodes,
    isPinned: article.isPinned,
    videoUrl: article.videoUrl,
  };
}

function toggleValue(list: string[], value: string, checked: boolean) {
  if (checked) return Array.from(new Set([...list, value]));
  return list.filter((item) => item !== value);
}

function statusBadgeClass(status: string) {
  if (status === 'approved') return 'bg-green-500/15 text-green-400';
  if (status === 'featured') return 'bg-hos-gold/20 text-hos-gold';
  if (status === 'hidden') return 'bg-red-500/15 text-red-400';
  return 'bg-hos-bg-tertiary text-hos-text-secondary';
}

function mediaBadgeClass(mediaType: string) {
  if (mediaType === 'video') return 'bg-sky-500/15 text-sky-300';
  if (mediaType === 'gallery') return 'bg-violet-500/15 text-violet-300';
  return 'bg-hos-bg-tertiary text-hos-text-secondary';
}

function ChoiceList({
  label,
  hint,
  options,
  selected,
  onChange,
}: {
  label: string;
  hint?: string;
  options: readonly string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <fieldset>
      <legend className="block text-sm font-medium mb-1">{label}</legend>
      {hint && <p className="text-xs text-hos-text-muted mb-2">{hint}</p>}
      <div className="max-h-36 overflow-y-auto rounded-lg border border-hos-border p-2 grid grid-cols-2 gap-1">
        {options.map((option) => (
          <label key={option} className="flex items-center gap-2 text-sm px-1 py-1">
            <input
              type="checkbox"
              checked={selected.includes(option)}
              onChange={(e) => onChange(toggleValue(selected, option, e.target.checked))}
            />
            <span className="truncate">{option}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function AdminFandomNewsPage() {
  const toast = useToast();
  const { formatDateTime, formatRelative } = useDateTime();
  const [tab, setTab] = useState<Tab>('sources');
  const [sources, setSources] = useState<FandomSource[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [showSourceForm, setShowSourceForm] = useState(false);
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
  const [sourceForm, setSourceForm] = useState<SourceForm>(EMPTY_SOURCE);
  const [savingSource, setSavingSource] = useState(false);
  const [fetchingId, setFetchingId] = useState<string | null>(null);
  const [expandedErrors, setExpandedErrors] = useState<Record<string, boolean>>({});
  const [fetchErrors, setFetchErrors] = useState<Record<string, string>>({});

  const [articles, setArticles] = useState<FandomArticle[]>([]);
  const [articlesLoading, setArticlesLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [sourceId, setSourceId] = useState('');
  const [market, setMarket] = useState('');
  const [status, setStatus] = useState('');
  const [mediaType, setMediaType] = useState('');
  const [category, setCategory] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<string | null>(null);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ArticleDraft | null>(null);
  const [savingArticle, setSavingArticle] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmState | null>(null);

  const filterKey = `${sourceId}|${status}|${mediaType}|${category}|${market}|${search}`;
  const [appliedFilters, setAppliedFilters] = useState(filterKey);
  if (appliedFilters !== filterKey) {
    setAppliedFilters(filterKey);
    if (page !== 1) setPage(1);
  }

  const loadSources = useCallback(async () => {
    try {
      setSourcesLoading(true);
      const res = await apiClient.adminListFandomNewsSources();
      const rows = (Array.isArray(res?.data) ? res.data : []).map(normalizeSource).filter(Boolean) as FandomSource[];
      setSources(rows);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load sources');
    } finally {
      setSourcesLoading(false);
    }
  }, [toast]);

  const loadArticles = useCallback(async () => {
    try {
      setArticlesLoading(true);
      const res = await apiClient.adminListFandomNewsArticles({
        status: status || undefined,
        category: category || undefined,
        market: market || undefined,
        mediaType: mediaType || undefined,
        sourceId: sourceId || undefined,
        search: search || undefined,
        page,
        limit: PAGE_SIZE,
      });
      const payload = asRecord(res?.data);
      const rows = (Array.isArray(payload?.items) ? payload.items : []).map(normalizeArticle).filter(Boolean) as FandomArticle[];
      setArticles(rows);
      setTotal(Number(payload?.total ?? rows.length) || 0);
      setTotalPages(Math.max(1, Number(payload?.totalPages ?? 1) || 1));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load articles');
    } finally {
      setArticlesLoading(false);
    }
  }, [category, market, mediaType, page, search, sourceId, status, toast]);

  useEffect(() => {
    loadSources();
  }, [loadSources]);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (tab !== 'articles') return;
    loadArticles();
  }, [tab, loadArticles]);

  const selectedArticle = useMemo(
    () => articles.find((article) => article.id === selectedArticleId) ?? null,
    [articles, selectedArticleId],
  );

  useEffect(() => {
    setDraft(selectedArticle ? draftFromArticle(selectedArticle) : null);
  }, [selectedArticle]);

  const openNewSource = () => {
    setEditingSourceId(null);
    setSourceForm(EMPTY_SOURCE);
    setShowSourceForm(true);
  };

  const openEditSource = (source: FandomSource) => {
    setEditingSourceId(source.id);
    setSourceForm({
      name: source.name,
      feedUrl: source.feedUrl,
      logoUrl: source.logoUrl || '',
      feedType: source.feedType,
      marketCodes: source.marketCodes,
      categories: source.categories,
      isActive: source.isActive,
    });
    setShowSourceForm(true);
  };

  const saveSource = async () => {
    if (!sourceForm.name.trim()) {
      toast.error('Source name is required');
      return;
    }
    if (!safeHttpUrl(sourceForm.feedUrl.trim())) {
      toast.error('Feed URL must start with http:// or https://');
      return;
    }
    setSavingSource(true);
    try {
      const payload = {
        name: sourceForm.name.trim(),
        feedUrl: sourceForm.feedUrl.trim(),
        feedType: sourceForm.feedType,
        logoUrl: sourceForm.logoUrl.trim(),
        isActive: sourceForm.isActive,
        marketCodes: sourceForm.marketCodes,
        categories: sourceForm.categories,
      };
      if (editingSourceId) {
        await apiClient.adminUpdateFandomNewsSource(editingSourceId, payload);
        toast.success('Source updated');
      } else {
        await apiClient.adminCreateFandomNewsSource(payload);
        toast.success('Source added');
      }
      setShowSourceForm(false);
      await loadSources();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingSource(false);
    }
  };

  const deleteSource = (source: FandomSource) => {
    setConfirmDialog({
      title: `Delete ${source.name}?`,
      description: 'Articles from this source will be removed.',
      tone: 'danger',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await apiClient.adminDeleteFandomNewsSource(source.id);
          toast.success('Source deleted');
          await loadSources();
        } catch (err: unknown) {
          toast.error(err instanceof Error ? err.message : 'Delete failed');
        }
      },
    });
  };

  const fetchSource = async (source: FandomSource) => {
    setFetchingId(source.id);
    try {
      await apiClient.adminFetchFandomNewsSource(source.id);
      toast.success(`Fetched ${source.name}`);
      setFetchErrors((current) => {
        const next = { ...current };
        delete next[source.id];
        return next;
      });
      await loadSources();
      if (tab === 'articles') await loadArticles();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Fetch failed';
      setFetchErrors((current) => ({ ...current, [source.id]: message }));
      setExpandedErrors((current) => ({ ...current, [source.id]: true }));
      toast.error(message);
      await loadSources();
    } finally {
      setFetchingId(null);
    }
  };

  const pageIds = articles.map((article) => article.id);
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));

  const toggleArticle = (id: string, checked: boolean) => {
    setSelectedIds((current) => (checked ? Array.from(new Set([...current, id])) : current.filter((item) => item !== id)));
  };

  const togglePage = (checked: boolean) => {
    setSelectedIds((current) => {
      if (checked) return Array.from(new Set([...current, ...pageIds]));
      return current.filter((id) => !pageIds.includes(id));
    });
  };

  const runBulk = async (nextStatus: 'approved' | 'hidden') => {
    if (selectedIds.length === 0) return;
    setBulkStatus(nextStatus);
    try {
      await apiClient.adminBulkUpdateFandomNewsArticles({ ids: selectedIds, status: nextStatus });
      toast.success(nextStatus === 'approved' ? 'Selected articles approved' : 'Selected articles hidden');
      setSelectedIds([]);
      await loadArticles();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Bulk update failed');
    } finally {
      setBulkStatus(null);
    }
  };

  const saveArticle = async () => {
    if (!selectedArticle || !draft) return;
    setSavingArticle(true);
    try {
      const embed = youtubeEmbedSrc(draft.videoUrl);
      await apiClient.adminUpdateFandomNewsArticle(selectedArticle.id, {
        status: draft.status,
        categories: draft.categories,
        marketCodes: draft.marketCodes,
        isPinned: draft.isPinned,
        videoUrl: draft.videoUrl.trim(),
        ...(embed ? { videoType: 'youtube', mediaType: 'video' } : {}),
      });
      toast.success('Article updated');
      await loadArticles();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingArticle(false);
    }
  };

  const deleteArticle = (article: FandomArticle) => {
    setConfirmDialog({
      title: 'Delete this article?',
      tone: 'danger',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await apiClient.adminDeleteFandomNewsArticle(article.id);
          toast.success('Article deleted');
          if (selectedArticleId === article.id) setSelectedArticleId(null);
          setSelectedIds((current) => current.filter((id) => id !== article.id));
          await loadArticles();
          await loadSources();
        } catch (err: unknown) {
          toast.error(err instanceof Error ? err.message : 'Delete failed');
        }
      },
    });
  };

  const tabClass = (value: Tab) =>
    `px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
      tab === value
        ? 'border-hos-gold text-hos-gold'
        : 'border-transparent text-hos-text-muted hover:text-hos-text-secondary'
    }`;

  const originalUrl = selectedArticle ? safeHttpUrl(selectedArticle.externalUrl) : null;
  const previewEmbed = draft ? youtubeEmbedSrc(draft.videoUrl) : null;
  const previewImage = selectedArticle ? safeHttpUrl(selectedArticle.imageUrl || '') : null;

  return (
    <RouteGuard allowedRoles={['ADMIN']} showAccessDenied>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-hos-text-secondary">Fandom News</h1>
          <p className="text-hos-text-secondary mt-1">Manage RSS sources and moderate incoming articles</p>
        </div>
        {tab === 'sources' && (
          <button
            type="button"
            onClick={openNewSource}
            className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover text-sm font-medium"
          >
            + Add Source
          </button>
        )}
      </div>

      <div className="flex border-b border-hos-border mb-6">
        <button type="button" className={tabClass('sources')} onClick={() => setTab('sources')}>
          Sources
        </button>
        <button type="button" className={tabClass('articles')} onClick={() => setTab('articles')}>
          Articles
        </button>
      </div>

      {tab === 'sources' && (
        <>
          {showSourceForm && (
            <div className="bg-hos-bg-secondary border rounded-lg p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4">{editingSourceId ? 'Edit Source' : 'Add Source'}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Name *</label>
                  <input
                    className={inputClass}
                    value={sourceForm.name}
                    onChange={(e) => setSourceForm({ ...sourceForm, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Feed type</label>
                  <select
                    className={inputClass}
                    value={sourceForm.feedType}
                    onChange={(e) => setSourceForm({ ...sourceForm, feedType: e.target.value === 'atom' ? 'atom' : 'rss' })}
                  >
                    <option value="rss">rss</option>
                    <option value="atom">atom</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium mb-1">Feed URL *</label>
                  <input
                    type="url"
                    className={inputClass}
                    value={sourceForm.feedUrl}
                    onChange={(e) => setSourceForm({ ...sourceForm, feedUrl: e.target.value })}
                    placeholder="https://example.com/feed.xml"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium mb-1">Logo URL</label>
                  <input
                    className={inputClass}
                    value={sourceForm.logoUrl}
                    onChange={(e) => setSourceForm({ ...sourceForm, logoUrl: e.target.value })}
                    placeholder="Optional"
                  />
                </div>
                <ChoiceList
                  label="Markets"
                  hint="Leave empty for every market."
                  options={MARKETS}
                  selected={sourceForm.marketCodes}
                  onChange={(marketCodes) => setSourceForm({ ...sourceForm, marketCodes })}
                />
                <ChoiceList
                  label="Default categories"
                  options={UNIVERSES}
                  selected={sourceForm.categories}
                  onChange={(categories) => setSourceForm({ ...sourceForm, categories })}
                />
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={sourceForm.isActive}
                    onChange={(e) => setSourceForm({ ...sourceForm, isActive: e.target.checked })}
                  />
                  Active
                </label>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  type="button"
                  onClick={saveSource}
                  disabled={savingSource}
                  className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg disabled:opacity-50 text-sm font-medium"
                >
                  {savingSource ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowSourceForm(false)}
                  className="px-4 py-2 border rounded-lg text-sm font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {sourcesLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-hos-gold" />
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-hos-border bg-hos-bg-secondary">
              <table className="min-w-full text-sm">
                <thead className="bg-hos-bg-secondary text-left text-hos-text-muted">
                  <tr>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Feed URL</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Last fetch</th>
                    <th className="px-4 py-3">Articles</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((source) => {
                    const logo = source.logoUrl ? safeHttpUrl(source.logoUrl) : null;
                    const hasErrors = source.errorCount > 0 || Boolean(fetchErrors[source.id]);
                    const expanded = Boolean(expandedErrors[source.id]);
                    return (
                      <Fragment key={source.id}>
                        <tr className="border-t border-hos-border">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {logo ? (
                                <img src={logo} alt="" className="w-8 h-8 rounded object-cover bg-hos-bg-tertiary" />
                              ) : (
                                <div className="w-8 h-8 rounded bg-hos-bg-tertiary" />
                              )}
                              <div>
                                <p className="font-medium text-hos-text-secondary">{source.name}</p>
                                <p className="text-xs text-hos-text-muted">
                                  {source.feedType}
                                  {source.marketCodes.length ? ` · ${source.marketCodes.join(', ')}` : ' · Global'}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 max-w-[16rem]">
                            <p className="truncate text-hos-text-secondary" title={source.feedUrl}>
                              {source.feedUrl}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-2">
                              <span
                                className={`inline-block w-2.5 h-2.5 rounded-full ${
                                  hasErrors ? 'bg-red-500' : source.isActive ? 'bg-green-500' : 'bg-hos-text-muted'
                                }`}
                              />
                              {hasErrors ? 'Errors' : source.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-hos-text-secondary">
                            {source.lastFetchedAt ? formatRelative(source.lastFetchedAt) : 'Never'}
                          </td>
                          <td className="px-4 py-3">{source.articleCount}</td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => fetchSource(source)}
                                disabled={fetchingId === source.id}
                                className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-50"
                              >
                                {fetchingId === source.id ? 'Fetching…' : 'Fetch Now'}
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditSource(source)}
                                className="px-3 py-1.5 border rounded-lg text-sm"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteSource(source)}
                                className="px-3 py-1.5 border border-red-500/40 text-red-400 rounded-lg text-sm"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                        {hasErrors && (
                          <tr className="border-t border-hos-border bg-hos-bg-tertiary/40">
                            <td colSpan={6} className="px-4 py-2">
                              <button
                                type="button"
                                className="text-xs text-red-400"
                                onClick={() =>
                                  setExpandedErrors((current) => ({ ...current, [source.id]: !current[source.id] }))
                                }
                              >
                                {expanded ? 'Hide error details' : `Show error details (${source.errorCount})`}
                              </button>
                              {expanded && (
                                <p className="mt-2 text-sm text-hos-text-secondary">
                                  {fetchErrors[source.id] ||
                                    `${source.errorCount} failed fetch${source.errorCount === 1 ? '' : 'es'} since the last successful fetch.`}
                                </p>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                  {sources.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-hos-text-muted">
                        No sources yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'articles' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <select className={inputClass} value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
                <option value="">All sources</option>
                {sources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
              </select>
              <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">All statuses</option>
                {ARTICLE_STATUSES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <select className={inputClass} value={mediaType} onChange={(e) => setMediaType(e.target.value)}>
                <option value="">All media types</option>
                {MEDIA_TYPES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <select className={inputClass} value={market} onChange={(e) => setMarket(e.target.value)}>
                <option value="">All markets</option>
                {MARKETS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">All categories</option>
                {UNIVERSES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <input
                className={`${inputClass} sm:col-span-2`}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by title"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={selectedIds.length === 0 || bulkStatus !== null}
                onClick={() => runBulk('approved')}
                className="px-3 py-1.5 rounded-lg bg-hos-gold text-[#1a1406] text-sm font-medium disabled:opacity-50"
              >
                {bulkStatus === 'approved' ? 'Approving…' : 'Approve Selected'}
              </button>
              <button
                type="button"
                disabled={selectedIds.length === 0 || bulkStatus !== null}
                onClick={() => runBulk('hidden')}
                className="px-3 py-1.5 rounded-lg border text-sm font-medium disabled:opacity-50"
              >
                {bulkStatus === 'hidden' ? 'Hiding…' : 'Hide Selected'}
              </button>
              <span className="text-sm text-hos-text-muted self-center">{selectedIds.length} selected</span>
            </div>

            {articlesLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-hos-gold" />
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-hos-border bg-hos-bg-secondary">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-hos-text-muted">
                    <tr>
                      <th className="px-3 py-3">
                        <input type="checkbox" checked={allSelected} onChange={(e) => togglePage(e.target.checked)} />
                      </th>
                      <th className="px-3 py-3">Article</th>
                      <th className="px-3 py-3">Source</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3">Media</th>
                      <th className="px-3 py-3">Categories</th>
                      <th className="px-3 py-3">Market</th>
                      <th className="px-3 py-3">Published</th>
                    </tr>
                  </thead>
                  <tbody>
                    {articles.map((article) => {
                      const thumb = article.imageUrl ? safeHttpUrl(article.imageUrl) : null;
                      return (
                        <tr
                          key={article.id}
                          className={`border-t border-hos-border cursor-pointer hover:bg-hos-bg-tertiary ${
                            selectedArticleId === article.id ? 'bg-hos-bg-tertiary' : ''
                          }`}
                          onClick={() => setSelectedArticleId(article.id)}
                        >
                          <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(article.id)}
                              onChange={(e) => toggleArticle(article.id, e.target.checked)}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2 min-w-[12rem]">
                              {thumb ? (
                                <img src={thumb} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
                              ) : (
                                <div className="w-10 h-10 rounded bg-hos-bg-tertiary flex-shrink-0" />
                              )}
                              <span className="font-medium text-hos-text-secondary line-clamp-2">{article.title}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2">{article.sourceName}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${statusBadgeClass(article.status)}`}>
                              {article.status}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${mediaBadgeClass(article.mediaType)}`}>
                              {article.mediaType}
                            </span>
                          </td>
                          <td className="px-3 py-2 max-w-[10rem] truncate" title={article.categories.join(', ')}>
                            {article.categories.join(', ') || '—'}
                          </td>
                          <td className="px-3 py-2">{article.marketCodes.length ? article.marketCodes.join(', ') : 'All'}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {article.publishedAt ? formatDateTime(article.publishedAt) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                    {articles.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-hos-text-muted">
                          No articles match these filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex items-center justify-between text-sm">
              <p className="text-hos-text-muted">
                {total} article{total === 1 ? '' : 's'}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  className="px-3 py-1.5 border rounded-lg disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="self-center text-hos-text-secondary">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((current) => current + 1)}
                  className="px-3 py-1.5 border rounded-lg disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </div>

          <div className="bg-hos-bg-secondary border rounded-lg p-5">
            {!selectedArticle || !draft ? (
              <p className="text-hos-text-muted text-center py-12">Select an article to review and edit it.</p>
            ) : (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-hos-text-secondary">{selectedArticle.title}</h2>
                {previewImage && (
                  <img src={previewImage} alt="" className="w-full max-h-64 object-contain rounded-lg bg-hos-bg-tertiary" />
                )}
                {(selectedArticle.mediaType === 'video' || previewEmbed) && previewEmbed && (
                  <iframe
                    title="Video preview"
                    src={previewEmbed}
                    className="w-full aspect-video rounded-lg"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                )}
                {selectedArticle.excerpt && <p className="text-sm text-hos-text-secondary">{selectedArticle.excerpt}</p>}
                <label className="block text-sm">
                  <span className="font-medium">Status</span>
                  <select
                    className={`${inputClass} mt-1`}
                    value={draft.status}
                    onChange={(e) => setDraft({ ...draft, status: e.target.value as ArticleStatus })}
                  >
                    {ARTICLE_STATUSES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <ChoiceList
                  label="Categories"
                  options={UNIVERSES}
                  selected={draft.categories}
                  onChange={(categories) => setDraft({ ...draft, categories })}
                />
                <ChoiceList
                  label="Markets"
                  hint="Leave empty for every market."
                  options={MARKETS}
                  selected={draft.marketCodes}
                  onChange={(marketCodes) => setDraft({ ...draft, marketCodes })}
                />
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={draft.isPinned}
                    onChange={(e) => setDraft({ ...draft, isPinned: e.target.checked })}
                  />
                  Pinned
                </label>
                <label className="block text-sm">
                  <span className="font-medium">Video URL</span>
                  <input
                    className={`${inputClass} mt-1`}
                    value={draft.videoUrl}
                    onChange={(e) => setDraft({ ...draft, videoUrl: e.target.value })}
                    placeholder="Paste a YouTube URL"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={saveArticle}
                    disabled={savingArticle}
                    className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg text-sm font-medium disabled:opacity-50"
                  >
                    {savingArticle ? 'Saving...' : 'Save'}
                  </button>
                  {originalUrl && (
                    <a
                      href={originalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-2 border rounded-lg text-sm font-medium"
                    >
                      Open Original
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => deleteArticle(selectedArticle)}
                    className="px-4 py-2 border border-red-500/40 text-red-400 rounded-lg text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {confirmDialog && (
        <ConfirmDialog
          open
          title={confirmDialog.title}
          description={confirmDialog.description}
          tone={confirmDialog.tone}
          confirmLabel={confirmDialog.confirmLabel}
          onCancel={() => setConfirmDialog(null)}
          onConfirm={confirmDialog.onConfirm}
        />
      )}
    </RouteGuard>
  );
}
