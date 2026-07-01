/** Admin UI formatting helpers */

const AVATAR_COLORS = [
  'bg-violet-500/25 text-violet-300',
  'bg-cyan-500/25 text-cyan-300',
  'bg-emerald-500/25 text-emerald-300',
  'bg-amber-500/25 text-amber-300',
  'bg-rose-500/25 text-rose-300',
  'bg-sky-500/25 text-sky-300',
  'bg-fuchsia-500/25 text-fuchsia-300',
  'bg-teal-500/25 text-teal-300',
];

export function avatarColorClass(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function formatAdminPrice(amount: number | string | null | undefined, currency = 'USD'): string {
  const value = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (value == null || Number.isNaN(value)) return '—';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

const ENTITY_LABELS: Record<string, string> = {
  product: 'Product',
  order: 'Order',
  user: 'User',
  submission: 'Product submission',
  seller: 'Seller',
  api: 'API integration',
  coupon: 'Coupon',
  banner: 'Banner',
  blog: 'Blog post',
};

const ACTION_LABELS: Record<string, string> = {
  created: 'was created',
  updated: 'was updated',
  deleted: 'was deleted',
  approved: 'was approved',
  rejected: 'was rejected',
  published: 'was published',
  submitted: 'was submitted',
};

function titleCase(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Turn raw activity log strings into admin-friendly copy */
export function formatActivityDescription(activity: {
  description?: string | null;
  action?: string | null;
  status?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
}): string {
  const description = activity.description?.trim();
  if (description && !/^Api\b/i.test(description) && !/^[A-Za-z]+ \(ID:/.test(description)) {
    return description.length > 120 ? `${description.slice(0, 117)}…` : description;
  }

  const meta = activity.metadata || {};
  const entity =
    (typeof meta.entityType === 'string' && meta.entityType) ||
    activity.entityType ||
    undefined;
  const entityLabel = entity ? ENTITY_LABELS[entity.toLowerCase()] || titleCase(entity) : 'Record';
  const actionRaw = (activity.action || activity.status || '').toLowerCase();
  const actionLabel = ACTION_LABELS[actionRaw] || (actionRaw ? titleCase(actionRaw) : 'was updated');

  const name =
    (typeof meta.name === 'string' && meta.name) ||
    (typeof meta.title === 'string' && meta.title) ||
    (typeof meta.storeName === 'string' && meta.storeName) ||
    undefined;

  if (name) return `${entityLabel} "${name}" ${actionLabel}`;

  const id = activity.entityId || (typeof meta.id === 'string' ? meta.id : undefined);
  if (id) {
    const shortId = id.length > 8 ? `${id.slice(0, 8)}…` : id;
    return `${entityLabel} (${shortId}) ${actionLabel}`;
  }

  if (description) {
    return description
      .replace(/^Api\b/i, 'API integration')
      .replace(/\(ID:\s*([a-f0-9-]+)\)/i, (_, uuid: string) => {
        const short = uuid.length > 8 ? `${uuid.slice(0, 8)}…` : uuid;
        return `(${short})`;
      });
  }

  return `${entityLabel} ${actionLabel}`;
}

export function formatActivityTitle(activity: {
  seller?: { storeName?: string | null };
  user?: { email?: string | null; firstName?: string | null; lastName?: string | null };
  entityType?: string | null;
}): string {
  if (activity.seller?.storeName) return activity.seller.storeName;
  if (activity.user?.firstName || activity.user?.lastName) {
    return [activity.user.firstName, activity.user.lastName].filter(Boolean).join(' ');
  }
  if (activity.user?.email) return activity.user.email;
  if (activity.entityType) return ENTITY_LABELS[activity.entityType.toLowerCase()] || titleCase(activity.entityType);
  return 'System activity';
}
