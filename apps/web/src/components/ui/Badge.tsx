'use client';

import React from 'react';

type BadgeVariant = 'primary' | 'success' | 'warning' | 'error' | 'info' | 'gray';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  primary: 'bg-purple-100 text-purple-800',
  success: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  error: 'bg-red-100 text-red-800',
  info: 'bg-blue-100 text-blue-800',
  gray: 'bg-gray-100 text-gray-800',
};

const dotColors: Record<BadgeVariant, string> = {
  primary: 'bg-purple-500',
  success: 'bg-green-500',
  warning: 'bg-yellow-500',
  error: 'bg-red-500',
  info: 'bg-blue-500',
  gray: 'bg-gray-500',
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
};

export function Badge({
  variant = 'gray',
  size = 'sm',
  dot = false,
  children,
  className = '',
}: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-1.5 font-medium rounded-full
        ${variantStyles[variant]} ${sizeStyles[size]} ${className}
      `}
    >
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]}`} />
      )}
      {children}
    </span>
  );
}

// Status badge with predefined styles
interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusMap: Record<string, { variant: BadgeVariant; label?: string }> = {
  // Order statuses
  PENDING: { variant: 'warning' },
  CONFIRMED: { variant: 'info' },
  PROCESSING: { variant: 'info' },
  SHIPPED: { variant: 'primary' },
  IN_TRANSIT: { variant: 'primary' },
  OUT_FOR_DELIVERY: { variant: 'info' },
  DELIVERED: { variant: 'success' },
  COMPLETED: { variant: 'success' },
  CANCELLED: { variant: 'error' },
  REFUNDED: { variant: 'gray' },
  FAILED: { variant: 'error' },
  
  // General statuses
  ACTIVE: { variant: 'success' },
  INACTIVE: { variant: 'gray' },
  PUBLISHED: { variant: 'success' },
  DRAFT: { variant: 'gray' },
  APPROVED: { variant: 'success' },
  REJECTED: { variant: 'error' },
  SUBMITTED: { variant: 'warning' },
  UNDER_REVIEW: { variant: 'warning', label: 'Under Review' },
  
  // Default
  DEFAULT: { variant: 'gray' },
};

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const config = statusMap[status] || statusMap.DEFAULT;
  const label = config.label || status.replace(/_/g, ' ');
  
  return (
    <Badge variant={config.variant} dot className={className}>
      {label}
    </Badge>
  );
}
