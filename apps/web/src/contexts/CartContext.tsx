'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { useAuth } from './AuthContext';

interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  price: number;
  product?: {
    id: string;
    name: string;
    images?: Array<{ url: string }>;
  };
}

interface Cart {
  id: string;
  items: CartItem[];
  subtotal?: number;
  total?: number;
  discount?: number;
  shipping?: number;
  tax?: number;
  couponCode?: string;
}

interface CartContextType {
  cart: Cart | null;
  cartItemCount: number;
  loading: boolean;
  refreshCart: () => Promise<void>;
  addToCart: (productId: string, quantity?: number) => Promise<void>;
  removeFromCart: (itemId: string) => Promise<void>;
  updateCartItem: (itemId: string, quantity: number) => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchCart = useCallback(async () => {
    if (!isAuthenticated) {
      setCart(null);
      return;
    }

    try {
      setLoading(true);
      const response = await apiClient.getCart();
      if (response?.data) {
        setCart(response.data);
      } else {
        setCart(null);
      }
    } catch (error: any) {
      console.error('Error fetching cart:', error);
      // Don't show error toast here - cart might not exist yet
      setCart(null);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const refreshCart = useCallback(async () => {
    await fetchCart();
  }, [fetchCart]);

  const addToCart = useCallback(async (productId: string, quantity: number = 1) => {
    try {
      await apiClient.addToCart(productId, quantity);
      // Refresh cart after adding
      await fetchCart();
    } catch (error) {
      throw error;
    }
  }, [fetchCart]);

  const removeFromCart = useCallback(async (itemId: string) => {
    try {
      await apiClient.removeCartItem(itemId);
      // Refresh cart after removing
      await fetchCart();
    } catch (error) {
      throw error;
    }
  }, [fetchCart]);

  const updateCartItem = useCallback(async (itemId: string, quantity: number) => {
    try {
      await apiClient.updateCartItem(itemId, { quantity });
      // Refresh cart after updating
      await fetchCart();
    } catch (error) {
      throw error;
    }
  }, [fetchCart]);

  const cartItemCount = cart?.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;

  return (
    <CartContext.Provider
      value={{
        cart,
        cartItemCount,
        loading,
        refreshCart,
        addToCart,
        removeFromCart,
        updateCartItem,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
