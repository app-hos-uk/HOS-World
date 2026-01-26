'use client';

import React from 'react';
import Link from 'next/link';

interface SectionCardProps {
  title?: string;
  subtitle?: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function SectionCard({
  title,
  subtitle,
  action,
  children,
  className = '',
  noPadding = false,
}: SectionCardProps) {
  return (
    <div className={`bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden ${className}`}>
      {(title || action) && (
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            {title && <h3 className="text-base font-semibold text-gray-900">{title}</h3>}
            {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          {action && (
            action.href ? (
              <Link 
                href={action.href} 
                className="text-sm font-medium text-purple-600 hover:text-purple-700 transition-colors"
              >
                {action.label}
              </Link>
            ) : (
              <button 
                onClick={action.onClick}
                className="text-sm font-medium text-purple-600 hover:text-purple-700 transition-colors"
              >
                {action.label}
              </button>
            )
          )}
        </div>
      )}
      <div className={noPadding ? '' : 'p-5'}>
        {children}
      </div>
    </div>
  );
}

// Chart card variant
interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  height?: string;
  className?: string;
}

export function ChartCard({
  title,
  subtitle,
  children,
  height = 'h-64',
  className = '',
}: ChartCardProps) {
  return (
    <div className={`bg-white rounded-xl border border-gray-100 shadow-sm p-5 ${className}`}>
      <div className="mb-4">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className={height}>
        {children}
      </div>
    </div>
  );
}

// Activity/List card item
interface ActivityItemProps {
  icon?: React.ReactNode;
  iconBg?: string;
  title: string;
  subtitle?: string;
  timestamp?: string;
  action?: React.ReactNode;
}

export function ActivityItem({
  icon,
  iconBg = 'bg-purple-100',
  title,
  subtitle,
  timestamp,
  action,
}: ActivityItemProps) {
  return (
    <div className="flex items-start gap-3 p-3 bg-gray-50/50 rounded-lg hover:bg-gray-50 transition-colors">
      {icon && (
        <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{title}</p>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        {timestamp && <p className="text-xs text-gray-400 mt-1">{timestamp}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

// Empty state component
interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
}

export function EmptyState({
  icon = '📭',
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="text-center py-12">
      <span className="text-5xl block mb-4">{icon}</span>
      <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
      {description && <p className="text-sm text-gray-500 mb-4 max-w-sm mx-auto">{description}</p>}
      {action && (
        action.href ? (
          <Link href={action.href} className="btn-primary inline-flex">
            {action.label}
          </Link>
        ) : (
          <button onClick={action.onClick} className="btn-primary">
            {action.label}
          </button>
        )
      )}
    </div>
  );
}
