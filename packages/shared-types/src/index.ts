// Theme Types
export interface Theme {
  id: string;
  name: string;
  type: 'hos' | 'seller' | 'customer';
  owner?: string; // sellerId for seller themes
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: {
      primary: string;
      secondary: string;
    };
    accent: string;
    error: string;
    success: string;
    warning: string;
  };
  typography: {
    fontFamily: {
      primary: string;
      secondary: string;
    };
    fontSize: {
      xs: string;
      sm: string;
      base: string;
      lg: string;
      xl: string;
      '2xl': string;
      '3xl': string;
    };
    fontWeight: {
      normal: number;
      medium: number;
      semibold: number;
      bold: number;
    };
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    '2xl': string;
    '3xl': string;
  };
  borderRadius: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
    full: string;
  };
  shadows: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  sellerBranding?: {
    logo?: string;
    favicon?: string;
    storeName?: string;
  };
}

// User Roles - matches backend schema
export type UserRole = 
  | 'CUSTOMER'
  | 'WHOLESALER'
  | 'B2C_SELLER'
  | 'SELLER' // Legacy - will be deprecated
  | 'ADMIN'
  | 'PROCUREMENT'
  | 'FULFILLMENT'
  | 'CATALOG'
  | 'MARKETING'
  | 'FINANCE'
  | 'CMS_EDITOR';

// User Types
export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  role: UserRole;
  avatar?: string;
  characterAvatar?: string; // Selected character ID for fandom experience
  createdAt: Date;
  updatedAt: Date;
}

export interface Customer extends User {
  role: 'CUSTOMER';
  addresses?: Address[];
  loyaltyPoints?: number;
  themePreference?: 'light' | 'dark' | 'accessibility';
}

// Seller Types
export interface Seller extends User {
  role: 'SELLER' | 'WHOLESALER' | 'B2C_SELLER';
  storeName: string;
  slug: string;
  description?: string;
  themeId?: string;
  logo?: string;
  location?: Location;
  verified: boolean;
  rating?: number;
  totalSales?: number;
}

export interface Location {
  country: string;
  city?: string;
  region?: string;
  timezone: string;
}

// Product Types
export interface Product {
  id: string;
  sellerId: string;
  name: string;
  description: string;
  slug: string;
  sku?: string;
  barcode?: string;
  ean?: string;
  price: number;
  tradePrice?: number;
  rrp?: number;
  currency: string;
  taxRate: number;
  stock: number;
  images: ProductImage[];
  variations?: ProductVariation[];
  fandom?: string;
  category?: string;
  tags?: string[];
  status: 'draft' | 'active' | 'inactive' | 'out_of_stock';
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductImage {
  id: string;
  url: string;
  alt?: string;
  order: number;
  type?: 'image' | 'video' | '360';
}

export interface ProductVariation {
  id: string;
  name: string; // e.g., "Size", "Color"
  options: VariationOption[];
}

export interface VariationOption {
  id: string;
  value: string; // e.g., "S", "M", "L", "XL"
  priceModifier?: number;
  stock?: number;
  sku?: string;
}

// Cart Types
export interface Cart {
  id: string;
  userId?: string;
  items: CartItem[];
  total: number;
  subtotal: number;
  tax: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CartItem {
  id: string;
  productId: string;
  product: Product;
  quantity: number;
  variationOptions?: Record<string, string>;
  price: number;
}

// Order Types
export interface Order {
  id: string;
  userId: string;
  sellerId: string;
  orderNumber: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  status: OrderStatus;
  shippingAddress: Address;
  billingAddress: Address;
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  trackingCode?: string;
  notes?: OrderNote[];
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  id: string;
  productId: string;
  product: Product;
  quantity: number;
  price: number;
  variationOptions?: Record<string, string>;
}

export type OrderStatus = 
  | 'pending' 
  | 'confirmed' 
  | 'processing' 
  | 'fulfilled' 
  | 'shipped' 
  | 'delivered' 
  | 'cancelled' 
  | 'refunded';

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export interface OrderNote {
  id: string;
  content: string;
  internal: boolean; // If true, only seller/admin can see
  createdAt: Date;
  createdBy: string;
}

// Address Types
export interface Address {
  id: string;
  userId: string;
  label?: string;
  firstName: string;
  lastName: string;
  street: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  phone?: string;
  isDefault: boolean;
}

// API Response Types
export interface ApiResponse<T> {
  data: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Search Types
export interface SearchFilters {
  query?: string;
  fandom?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sellerId?: string;
  inStock?: boolean;
  sortBy?: 'relevance' | 'price_asc' | 'price_desc' | 'newest' | 'popular';
  page?: number;
  limit?: number;
}

// Auth Types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role: 'CUSTOMER' | 'WHOLESALER' | 'B2C_SELLER';
  storeName?: string; // Required if role is seller type
}

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken?: string;
}


