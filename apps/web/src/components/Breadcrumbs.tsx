'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
  homeLabel?: string;
  homeHref?: string;
  className?: string;
}

// Map of path segments to human-readable labels
const pathLabels: Record<string, string> = {
  admin: 'Admin',
  dashboard: 'Dashboard',
  products: 'Products',
  orders: 'Orders',
  users: 'Users',
  sellers: 'Sellers',
  'seller-analytics': 'Seller Analytics',
  'seller-applications': 'Seller Applications',
  submissions: 'Submissions',
  catalog: 'Catalog',
  categories: 'Fandoms',
  tags: 'Tags',
  attributes: 'Attributes',
  settings: 'Settings',
  permissions: 'Permissions',
  themes: 'Themes',
  finance: 'Finance',
  reports: 'Reports',
  sales: 'Sales',
  platform: 'Platform',
  inventory: 'Inventory',
  warehouses: 'Warehouses',
  transfers: 'Transfers',
  promotions: 'Promotions',
  reviews: 'Reviews',
  support: 'Support',
  activity: 'Activity',
  discrepancies: 'Discrepancies',
  domains: 'Domains',
  'fulfillment-centers': 'Fulfillment Centers',
  'customer-groups': 'Customer Groups',
  'return-policies': 'Return Policies',
  'tax-zones': 'Tax Zones',
  logistics: 'Logistics',
  marketing: 'Marketing',
  whatsapp: 'WhatsApp',
  shipments: 'Shipments',
  pricing: 'Pricing',
  create: 'Create',
  edit: 'Edit',
  profile: 'Profile',
  cart: 'Cart',
  checkout: 'Checkout',
  wishlist: 'Wishlist',
  search: 'Search',
  collections: 'Collections',
  quests: 'Quests',
  leaderboard: 'Leaderboard',
};

export function Breadcrumbs({ 
  items, 
  homeLabel = 'Home', 
  homeHref = '/',
  className = '' 
}: BreadcrumbsProps) {
  const pathname = usePathname();
  
  // Generate breadcrumbs from pathname if items not provided
  const breadcrumbItems: BreadcrumbItem[] = items || (() => {
    if (!pathname) return [];
    
    const segments = pathname.split('/').filter(Boolean);
    const crumbs: BreadcrumbItem[] = [];
    let currentPath = '';
    
    segments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      const isLast = index === segments.length - 1;
      
      // Skip UUIDs or other dynamic segments (they'll be shown as the final item)
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment);
      
      if (isUUID) {
        crumbs.push({
          label: 'Details',
          href: isLast ? undefined : currentPath,
        });
      } else {
        crumbs.push({
          label: pathLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' '),
          href: isLast ? undefined : currentPath,
        });
      }
    });
    
    return crumbs;
  })();

  if (breadcrumbItems.length === 0) {
    return null;
  }

  return (
    <nav className={`flex items-center text-sm ${className}`} aria-label="Breadcrumb">
      <ol className="flex items-center space-x-2">
        <li>
          <Link 
            href={homeHref} 
            className="text-gray-500 hover:text-purple-600 transition-colors"
          >
            {homeLabel}
          </Link>
        </li>
        
        {breadcrumbItems.map((item, index) => (
          <li key={index} className="flex items-center">
            <svg
              className="w-4 h-4 text-gray-400 mx-2"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
            {item.href ? (
              <Link 
                href={item.href} 
                className="text-gray-500 hover:text-purple-600 transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span className="text-gray-900 font-medium">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

// Simplified breadcrumb for admin pages
export function AdminBreadcrumbs({ className = '' }: { className?: string }) {
  return (
    <Breadcrumbs 
      homeLabel="Admin" 
      homeHref="/admin/dashboard" 
      className={className}
    />
  );
}
