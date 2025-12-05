// Cache-bust: 2025-12-04 - Fixed TypeScript build error (removed process.env checks)
import type {
  User,
  Product,
  Cart,
  Order,
  AuthResponse,
  ApiResponse,
  PaginatedResponse,
  SearchFilters,
} from '@hos-marketplace/shared-types';

export class ApiClient {
  private baseUrl: string;
  private getToken: () => string | null;
  private onUnauthorized: () => void;

  private constructor(config: {
    baseUrl: string;
    getToken: () => string | null;
    onUnauthorized: () => void;
  }) {
    this.baseUrl = config.baseUrl;
    this.getToken = config.getToken;
    this.onUnauthorized = config.onUnauthorized;
  }

  static create(config: {
    baseUrl: string;
    getToken: () => string | null;
    onUnauthorized: () => void;
  }): ApiClient {
    return new ApiClient(config);
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (response.status === 401) {
        this.onUnauthorized();
        throw new Error('Unauthorized');
      }

      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
          console.error('API Error Response:', {
            status: response.status,
            statusText: response.statusText,
            error: errorData,
            url,
          });
        } catch (e) {
          // If response is not JSON, get text
          try {
            const text = await response.text();
            console.error('API Error (non-JSON):', {
              status: response.status,
              statusText: response.statusText,
              text,
              url,
            });
          } catch (textError) {
            console.error('API Error (unable to read response):', {
              status: response.status,
              statusText: response.statusText,
              url,
            });
          }
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      return data;
    } catch (error: any) {
      // Enhanced error logging
      if (typeof window !== 'undefined') {
        console.error('API Request failed:', { 
          url, 
          method: options.method || 'GET',
          error: error.message, 
          stack: error.stack,
        });
      }
      throw error;
    }
  }

  // Auth endpoints
  async register(data: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    role: 'customer' | 'seller';
    storeName?: string;
  }): Promise<ApiResponse<AuthResponse>> {
    return this.request<ApiResponse<AuthResponse>>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async login(data: { email: string; password: string }): Promise<ApiResponse<AuthResponse>> {
    return this.request<ApiResponse<AuthResponse>>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async logout(): Promise<ApiResponse<{ message: string }>> {
    return this.request<ApiResponse<{ message: string }>>('/auth/logout', {
      method: 'POST',
    });
  }

  async getCurrentUser(): Promise<ApiResponse<User>> {
    return this.request<ApiResponse<User>>('/auth/me');
  }

  async selectCharacter(characterId: string, favoriteFandoms?: string[]): Promise<ApiResponse<{ message: string }>> {
    return this.request<ApiResponse<{ message: string }>>('/auth/select-character', {
      method: 'POST',
      body: JSON.stringify({ characterId, favoriteFandoms }),
    });
  }

  async completeFandomQuiz(data: { favoriteFandoms: string[]; interests: string[] }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/auth/fandom-quiz', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Characters & Fandoms
  async getCharacters(fandomId?: string): Promise<ApiResponse<any[]>> {
    const query = fandomId ? `?fandomId=${fandomId}` : '';
    return this.request<ApiResponse<any[]>>(`/characters${query}`);
  }

  async getCharacter(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/characters/${id}`);
  }

  async getCharactersByFandom(fandomSlug: string): Promise<ApiResponse<any[]>> {
    return this.request<ApiResponse<any[]>>(`/characters/fandom/${fandomSlug}`);
  }

  async getFandoms(): Promise<ApiResponse<any[]>> {
    return this.request<ApiResponse<any[]>>('/fandoms');
  }

  async getFandom(slug: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/fandoms/${slug}`);
  }

  // AI Chat
  async sendChatMessage(characterId: string, message: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/ai/chat/${characterId}`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }

  async getChatHistory(characterId?: string): Promise<ApiResponse<any[]>> {
    const query = characterId ? `?characterId=${characterId}` : '';
    return this.request<ApiResponse<any[]>>(`/ai/chat/history${query}`);
  }

  async getAIRecommendations(): Promise<ApiResponse<any[]>> {
    return this.request<ApiResponse<any[]>>('/ai/recommendations');
  }

  // Social Sharing
  async shareItem(data: {
    type: 'PRODUCT' | 'COLLECTION' | 'WISHLIST' | 'ACHIEVEMENT' | 'QUEST';
    itemId: string;
    platform?: string;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/social-sharing/share', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getSharedItems(userId?: string, limit?: number): Promise<ApiResponse<any[]>> {
    const params = new URLSearchParams();
    if (userId) params.append('userId', userId);
    if (limit) params.append('limit', limit.toString());
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<ApiResponse<any[]>>(`/social-sharing/shared${query}`);
  }

  async getShareUrl(type: string, itemId: string): Promise<ApiResponse<{ url: string }>> {
    return this.request<ApiResponse<{ url: string }>>(`/social-sharing/share-url?type=${type}&itemId=${itemId}`);
  }

  // Products endpoints
  async getProducts(filters?: SearchFilters): Promise<ApiResponse<PaginatedResponse<Product>>> {
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value));
        }
      });
    }
    const query = queryParams.toString();
    return this.request<ApiResponse<PaginatedResponse<Product>>>(
      `/products${query ? `?${query}` : ''}`
    );
  }

  async getProduct(id: string): Promise<ApiResponse<Product>> {
    return this.request<ApiResponse<Product>>(`/products/${id}`);
  }

  async getProductBySlug(slug: string): Promise<ApiResponse<Product>> {
    return this.request<ApiResponse<Product>>(`/products/slug/${slug}`);
  }

  // Cart endpoints
  async getCart(): Promise<ApiResponse<Cart>> {
    return this.request<ApiResponse<Cart>>('/cart');
  }

  async addToCart(productId: string, quantity: number, variationOptions?: Record<string, string>): Promise<ApiResponse<Cart>> {
    return this.request<ApiResponse<Cart>>('/cart/items', {
      method: 'POST',
      body: JSON.stringify({ productId, quantity, variationOptions }),
    });
  }

  async updateCartItem(itemId: string, quantity: number): Promise<ApiResponse<Cart>> {
    return this.request<ApiResponse<Cart>>(`/cart/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity }),
    });
  }

  async removeCartItem(itemId: string): Promise<ApiResponse<Cart>> {
    return this.request<ApiResponse<Cart>>(`/cart/items/${itemId}`, {
      method: 'DELETE',
    });
  }

  async clearCart(): Promise<ApiResponse<Cart>> {
    return this.request<ApiResponse<Cart>>('/cart', {
      method: 'DELETE',
    });
  }

  // Orders endpoints
  async getOrders(): Promise<ApiResponse<Order[]>> {
    return this.request<ApiResponse<Order[]>>('/orders');
  }

  async getOrder(id: string): Promise<ApiResponse<Order>> {
    return this.request<ApiResponse<Order>>(`/orders/${id}`);
  }

  async createOrder(data: {
    shippingAddressId: string;
    billingAddressId?: string;
    paymentMethodId?: string;
  }): Promise<ApiResponse<Order>> {
    return this.request<ApiResponse<Order>>('/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Generic POST method for custom endpoints
  async post<T>(endpoint: string, data: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Generic GET method for custom endpoints
  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint);
  }

  // Generic PUT method for custom endpoints
  async put<T>(endpoint: string, data: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Generic DELETE method for custom endpoints
  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    });
  }

  // Dashboard endpoints
  async getAdminDashboardData(): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/dashboard/admin');
  }

  async getSellerDashboardData(startDate?: string, endDate?: string): Promise<ApiResponse<any>> {
    const query = startDate || endDate 
      ? `?${new URLSearchParams({ 
          ...(startDate && { startDate }), 
          ...(endDate && { endDate }) 
        }).toString()}`
      : '';
    return this.request<ApiResponse<any>>(`/dashboard/stats${query}`);
  }

  async getWholesalerDashboardData(): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/dashboard/stats');
  }

  async getProcurementDashboardData(): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/dashboard/procurement');
  }

  async getFulfillmentDashboardData(): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/dashboard/fulfillment');
  }

  async getCatalogDashboardData(): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/dashboard/catalog');
  }

  async getMarketingDashboardData(): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/dashboard/marketing');
  }

  async getFinanceDashboardData(): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/dashboard/finance');
  }

  // Submissions
  async createSubmission(data: {
    name: string;
    description: string;
    sku?: string;
    barcode?: string;
    ean?: string;
    price: number;
    tradePrice?: number;
    rrp?: number;
    currency?: string;
    taxRate?: number;
    stock: number;
    quantity?: number;
    fandom?: string;
    category?: string;
    tags?: string[];
    images: Array<{ url: string; alt?: string; order?: number }>;
    variations?: Array<{ name: string; options: any[] }>;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/submissions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getSubmissions(status?: string): Promise<ApiResponse<any[]>> {
    const url = status ? `/submissions?status=${status}` : '/submissions';
    return this.request<ApiResponse<any[]>>(url, {
      method: 'GET',
    });
  }

  async getFandoms(): Promise<ApiResponse<any[]>> {
    return this.request<ApiResponse<any[]>>('/fandoms', {
      method: 'GET',
    });
  }
}
