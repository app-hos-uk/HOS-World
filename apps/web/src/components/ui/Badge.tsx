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
  primary: 'bg-hos-gold/20 text-hos-gold',
  success: 'bg-green-900/40 text-green-400',
  warning: 'bg-yellow-900/40 text-yellow-400',
  error: 'bg-red-900/40 text-red-400',
  info: 'bg-hos-gold/15 text-hos-gold',
  gray: 'bg-hos-bg-tertiary text-hos-text-secondary',
};

const dotColors: Record<BadgeVariant, string> = {
  primary: 'bg-hos-gold',
  success: 'bg-green-500',
  warning: 'bg-yellow-500',
  error: 'bg-red-500',
  info: 'bg-hos-gold',
  gray: 'bg-hos-text-muted',
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
