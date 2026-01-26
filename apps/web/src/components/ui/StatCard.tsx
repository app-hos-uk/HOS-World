'use client';

import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  iconBgColor?: string;
  trend?: {
    value: number;
    label?: string;
    isPositive?: boolean;
  };
  onClick?: () => void;
  isActive?: boolean;
  valueColor?: string;
  className?: string;
}

export function StatCard({
  label,
  value,
  icon,
  iconBgColor = 'bg-purple-50',
  trend,
  onClick,
  isActive = false,
  valueColor = 'text-gray-900',
  className = '',
}: StatCardProps) {
  const Component = onClick ? 'button' : 'div';
  
  return (
    <Component
      onClick={onClick}
      className={`
        bg-white rounded-xl border p-5 text-left w-full
        transition-all duration-200
        ${onClick ? 'cursor-pointer hover:shadow-md' : ''}
        ${isActive ? 'ring-2 ring-purple-500 border-purple-200' : 'border-gray-100 shadow-sm'}
        ${className}
      `}
    >
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          {label}
        </p>
        {icon && (
          <div className={`p-2 rounded-lg ${iconBgColor}`}>
            {icon}
          </div>
        )}
      </div>
      
      <p className={`text-3xl font-semibold mt-2 tabular-nums ${valueColor}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      
      {trend && (
        <p className={`text-xs mt-1.5 flex items-center gap-1 ${
          trend.isPositive !== false ? 'text-green-600' : 'text-red-600'
        }`}>
          <span>{trend.isPositive !== false ? '↑' : '↓'}</span>
          <span>{trend.value > 0 ? '+' : ''}{trend.value}%</span>
          {trend.label && <span className="text-gray-500">{trend.label}</span>}
        </p>
      )}
    </Component>
  );
}

// Mini stat card for smaller spaces
interface MiniStatCardProps {
  label: string;
  value: string | number;
  valueColor?: string;
  onClick?: () => void;
  isActive?: boolean;
}

export function MiniStatCard({
  label,
  value,
  valueColor = 'text-gray-900',
  onClick,
  isActive = false,
}: MiniStatCardProps) {
  const Component = onClick ? 'button' : 'div';
  
  return (
    <Component
      onClick={onClick}
      className={`
        bg-white rounded-lg border p-3 text-left w-full
        transition-all duration-200
        ${onClick ? 'cursor-pointer hover:shadow-md' : ''}
        ${isActive ? 'ring-2 ring-purple-500 border-purple-200' : 'border-gray-100 shadow-sm'}
      `}
    >
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-xl font-semibold mt-1 tabular-nums ${valueColor}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
    </Component>
  );
}
