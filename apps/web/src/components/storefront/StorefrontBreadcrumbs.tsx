import Link from 'next/link';

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

interface StorefrontBreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function StorefrontBreadcrumbs({ items, className = '' }: StorefrontBreadcrumbsProps) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={`text-sm text-hos-text-muted font-ui ${className}`}>
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
              {index > 0 ? <span aria-hidden className="text-hos-border">/</span> : null}
              {item.href && !isLast ? (
                <Link href={item.href} className="hover:text-hos-gold transition-colors">
                  {item.label}
                </Link>
              ) : (
                <span className={isLast ? 'text-hos-text-secondary font-medium' : undefined}>
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
