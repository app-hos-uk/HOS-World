interface ProductGridSkeletonProps {
  count?: number;
  className?: string;
}

export function ProductGridSkeleton({ count = 8, className = '' }: ProductGridSkeletonProps) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-hos-border bg-hos-bg-secondary overflow-hidden animate-pulse"
        >
          <div className="aspect-square bg-hos-bg-tertiary" />
          <div className="p-3 space-y-2">
            <div className="h-3 bg-hos-bg-tertiary rounded w-3/4" />
            <div className="h-3 bg-hos-bg-tertiary rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
