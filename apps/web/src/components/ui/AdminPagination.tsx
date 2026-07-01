'use client';

interface AdminPaginationProps {
  page: number;
  totalPages: number;
  totalItems?: number;
  onPageChange: (page: number) => void;
  itemLabel?: string;
}

export function AdminPagination({
  page,
  totalPages,
  totalItems,
  onPageChange,
  itemLabel = 'matching',
}: AdminPaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-t border-hos-border bg-hos-bg-secondary/80">
      <p className="text-sm text-hos-text-muted">
        Page <span className="font-medium text-hos-text-secondary">{page}</span> of{' '}
        <span className="font-medium text-hos-text-secondary">{totalPages}</span>
        {totalItems != null ? (
          <>
            {' '}
            (<span className="tabular-nums">{totalItems}</span> {itemLabel})
          </>
        ) : null}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="admin-pagination-btn"
          aria-label="Previous page"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="admin-pagination-btn admin-pagination-btn-primary"
          aria-label="Next page"
        >
          Next
        </button>
      </div>
    </div>
  );
}
