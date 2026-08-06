'use client';

type LoadingStateProps = {
  label?: string;
  rows?: number;
  className?: string;
};

/**
 * Standard dashboard loading treatment — prefer this over bare "Loading…" text.
 */
export function LoadingState({
  label = 'Loading…',
  rows = 4,
  className = '',
}: LoadingStateProps) {
  return (
    <div
      className={`rounded-lg border border-hos-border bg-hos-bg-secondary p-4 ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <p className="text-sm text-hos-text-muted mb-3">{label}</p>
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="h-3 rounded bg-hos-bg-tertiary animate-pulse"
            style={{ width: `${88 - i * 8}%` }}
          />
        ))}
      </div>
    </div>
  );
}

