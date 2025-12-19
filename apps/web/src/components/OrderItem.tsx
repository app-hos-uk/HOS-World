'use client';

import React, { memo } from 'react';

interface OrderItemProps {
  order: {
    id: string;
    status: string;
    total?: number;
    currency?: string;
    createdAt?: string;
    user?: { email?: string };
    customer?: { email?: string };
  };
  onRetry?: () => void;
}

export const OrderItem = memo(({ order, onRetry }: OrderItemProps) => {
  const formattedDate = React.useMemo(
    () => order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A',
    [order.createdAt]
  );

  const formattedTotal = React.useMemo(
    () => {
      if (!order.total) return 'N/A';
      const currency = order.currency || 'GBP';
      return `${currency} ${order.total.toFixed(2)}`;
    },
    [order.total, order.currency]
  );

  const customerEmail = React.useMemo(
    () => order.user?.email || order.customer?.email || 'N/A',
    [order.user?.email, order.customer?.email]
  );

  const statusClass = React.useMemo(() => {
    if (order.status === 'COMPLETED') {
      return 'bg-green-100 text-green-800';
    }
    if (order.status === 'CANCELLED') {
      return 'bg-red-100 text-red-800';
    }
    return 'bg-yellow-100 text-yellow-800';
  }, [order.status]);

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
        {order.id.substring(0, 8)}...
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {customerEmail}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {formattedTotal}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClass}`}>
          {order.status}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {formattedDate}
      </td>
    </tr>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.order.id === nextProps.order.id &&
    prevProps.order.status === nextProps.order.status &&
    prevProps.order.total === nextProps.order.total
  );
});

OrderItem.displayName = 'OrderItem';


