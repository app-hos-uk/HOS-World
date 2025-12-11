'use client';

import React, { memo } from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    description?: string;
    price: number | string;
    images?: Array<{ url: string }>;
    fandom?: string;
  };
}

export const ProductCard = memo(({ product }: ProductCardProps) => {
  const formattedPrice = React.useMemo(
    () => `£${Number(product.price).toFixed(2)}`,
    [product.price]
  );

  return (
    <Link href={`/products/${product.id}`} className="group">
      <div className="bg-white border rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
        <div className="aspect-square bg-gray-100 relative">
          {product.images && product.images[0] ? (
            <Image
              src={product.images[0].url}
              alt={product.name}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              No Image
            </div>
          )}
        </div>
        <div className="p-4">
          <h3 className="font-semibold text-gray-900 group-hover:text-purple-600 transition-colors">
            {product.name}
          </h3>
          {product.description && (
            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{product.description}</p>
          )}
          <div className="mt-2 flex items-center justify-between">
            <span className="text-lg font-bold text-purple-900">{formattedPrice}</span>
            {product.fandom && (
              <span className="text-xs text-gray-500">{product.fandom}</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for better performance
  return (
    prevProps.product.id === nextProps.product.id &&
    prevProps.product.price === nextProps.product.price &&
    prevProps.product.name === nextProps.product.name
  );
});

ProductCard.displayName = 'ProductCard';

