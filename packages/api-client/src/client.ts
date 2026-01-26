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
  private unauthorizedHandled = false;
  private refreshInFlight: Promise<boolean> | null = null;

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
    // Validate baseUrl at runtime (when API call is made)
    if (!this.baseUrl) {
      const errorMessage = 'API base URL is not configured. Please set NEXT_PUBLIC_API_URL environment variable.';
      console.error('❌', errorMessage);
      throw new Error(errorMessage);
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    const url = `${this.baseUrl}${endpoint}`;

    try {
      const isAuthEndpoint =
        endpoint.startsWith('/auth/login') ||
        endpoint.startsWith('/auth/register') ||
        endpoint.startsWith('/auth/accept-invitation') ||
        endpoint.startsWith('/auth/refresh');

      const doFetch = async () => {
        const nextHeaders: Record<string, string> = { ...headers };
        const token = this.getToken();
        if (token) {
          nextHeaders['Authorization'] = `Bearer ${token}`;
        }
        return fetch(url, { ...options, headers: nextHeaders });
      };

      let response = await doFetch();

      // For protected endpoints, try to refresh once on 401 before logging out.
      if (response.status === 401 && !isAuthEndpoint) {
        const refreshed = await this.tryRefreshToken();
        if (refreshed) {
          response = await doFetch();
        }
      }

      // NOTE: We intentionally parse the error body (if any) before throwing.
      // This preserves useful backend messages like "Invalid credentials" for /auth/login.
      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          // Nest often returns `message` as string | string[]
          const msg = (errorData as any)?.message;
          errorMessage = Array.isArray(msg) ? msg.join(', ') : msg || errorMessage;
          if (!(response.status === 401 && this.unauthorizedHandled)) {
            console.error('API Error Response:', {
              status: response.status,
              statusText: response.statusText,
              error: errorData,
              url,
            });
          }
        } catch (e) {
          try {
            const text = await response.text();
            if (text) errorMessage = text;
            if (!(response.status === 401 && this.unauthorizedHandled)) {
              console.error('API Error (non-JSON):', {
                status: response.status,
                statusText: response.statusText,
                text,
                url,
              });
            }
          } catch (textError) {
            if (!(response.status === 401 && this.unauthorizedHandled)) {
              console.error('API Error (unable to read response):', {
                status: response.status,
                statusText: response.statusText,
                url,
              });
            }
          }
        }

        if (response.status === 401 && !isAuthEndpoint) {
          if (!this.unauthorizedHandled) {
            this.unauthorizedHandled = true;
            this.onUnauthorized();
          }
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();
      return data;
    } catch (error: any) {
      // Enhanced error logging
      if (typeof window !== 'undefined') {
        if (!(this.unauthorizedHandled && String(error?.message || '').toLowerCase().includes('invalid or expired token'))) {
          console.error('API Request failed:', { 
            url, 
            method: options.method || 'GET',
            error: error.message, 
            stack: error.stack,
          });
        }
      }
      throw error;
    }
  }

  private async tryRefreshToken(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    if (!this.baseUrl) return false;
    
    try {
      const existing = localStorage.getItem('refresh_token');
      if (!existing) return false;

      if (this.refreshInFlight) return await this.refreshInFlight;

      this.refreshInFlight = (async () => {
        try {
          const res = await fetch(`${this.baseUrl}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: existing }),
          });
          if (!res.ok) return false;
          const json = await res.json();
          const token = json?.data?.token;
          const refreshToken = json?.data?.refreshToken;
          if (!token || !refreshToken) return false;
          localStorage.setItem('auth_token', token);
          localStorage.setItem('refresh_token', refreshToken);
          this.unauthorizedHandled = false;
          return true;
        } catch {
          return false;
        } finally {
          this.refreshInFlight = null;
        }
      })();

      return await this.refreshInFlight;
    } catch {
      return false;
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
    country: string;
    whatsappNumber?: string;
    preferredCommunicationMethod: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PHONE';
    gdprConsent: boolean;
    dataProcessingConsent?: Record<string, boolean>;
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

  async updateOrderStatus(id: string, status: string): Promise<ApiResponse<Order>> {
    return this.request<ApiResponse<Order>>(`/orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
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

  // Payment endpoints
  /**
   * Create a payment intent for an order.
   * 
   * @param data - Payment intent data (MUST use named properties, not positional arguments)
   * @param data.orderId - Order ID (required)
   * @param data.paymentMethod - Payment provider name, e.g., 'stripe', 'klarna' (optional)
   * @param data.amount - Payment amount (required, critical for accurate processing after gift card redemptions)
   * @param data.currency - Payment currency, e.g., 'GBP' (required, critical for currency conversion)
   * 
   * @example
   * ```typescript
   * // ✅ CORRECT: Use named properties
   * await apiClient.createPaymentIntent({
   *   orderId: 'order-123',
   *   paymentMethod: 'stripe',
   *   amount: 100.50,
   *   currency: 'GBP'
   * });
   * ```
   */
  async createPaymentIntent(data: {
    orderId: string;
    paymentMethod?: string;
    amount: number; // Required: critical for accurate payment processing, especially after gift card redemptions
    currency: string; // Required: critical for currency conversion and payment processing
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/payments/intent', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async confirmPayment(data: {
    orderId: string;
    paymentIntentId: string;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/payments/confirm', {
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

  // Procurement
  async getProcurementSubmissions(status?: string): Promise<ApiResponse<any[]>> {
    const url = status ? `/procurement/submissions?status=${status}` : '/procurement/submissions';
    return this.request<ApiResponse<any[]>>(url, {
      method: 'GET',
    });
  }

  async getProcurementSubmission(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/procurement/submissions/${id}`, {
      method: 'GET',
    });
  }

  async approveProcurementSubmission(
    id: string,
    data: { selectedQuantity?: number; notes?: string }
  ): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/procurement/submissions/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async rejectProcurementSubmission(
    id: string,
    data: { reason: string }
  ): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/procurement/submissions/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Fulfillment
  async getFulfillmentShipments(status?: string): Promise<ApiResponse<any[]>> {
    const url = status ? `/fulfillment/shipments?status=${status}` : '/fulfillment/shipments';
    return this.request<ApiResponse<any[]>>(url, {
      method: 'GET',
    });
  }

  async getFulfillmentShipment(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/fulfillment/shipments/${id}`, {
      method: 'GET',
    });
  }

  async verifyShipment(
    id: string,
    data: { status: string; verificationNotes?: string; trackingNumber?: string }
  ): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/fulfillment/shipments/${id}/verify`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Catalog
  async getCatalogPending(): Promise<ApiResponse<any[]>> {
    return this.request<ApiResponse<any[]>>('/catalog/pending', {
      method: 'GET',
    });
  }

  async getCatalogSubmission(submissionId: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/catalog/submissions/${submissionId}`, {
      method: 'GET',
    });
  }

  async createCatalogEntry(
    submissionId: string,
    data: {
      title: string;
      description: string;
      keywords: string[];
      specs?: any;
      images: string[];
    }
  ): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/catalog/entries/${submissionId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Marketing
  async getMarketingPending(): Promise<ApiResponse<any[]>> {
    return this.request<ApiResponse<any[]>>('/marketing/pending', {
      method: 'GET',
    });
  }

  async getMarketingMaterials(submissionId?: string, type?: string): Promise<ApiResponse<any[]>> {
    let url = '/marketing/materials';
    const params = new URLSearchParams();
    if (submissionId) params.append('submissionId', submissionId);
    if (type) params.append('type', type);
    if (params.toString()) url += `?${params.toString()}`;
    return this.request<ApiResponse<any[]>>(url, {
      method: 'GET',
    });
  }

  async createMarketingMaterial(data: {
    submissionId: string;
    type: string;
    url: string;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/marketing/materials', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateMarketingMaterial(id: string, data: {
    type?: string;
    url?: string;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/marketing/materials/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteMarketingMaterial(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/marketing/materials/${id}`, {
      method: 'DELETE',
    });
  }

  async markMarketingComplete(submissionId: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/marketing/submissions/${submissionId}/complete`, {
      method: 'POST',
    });
  }

  async getMarketingDashboardStats(): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/marketing/dashboard/stats', {
      method: 'GET',
    });
  }

  // Finance
  async getFinancePending(): Promise<ApiResponse<any[]>> {
    return this.request<ApiResponse<any[]>>('/finance/pending', {
      method: 'GET',
    });
  }

  async setFinancePricing(
    submissionId: string,
    data: {
      margin: number;
      visibilityLevel?: string;
      notes?: string;
    }
  ): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/finance/pricing/${submissionId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async approveFinancePricing(
    submissionId: string,
    data: { notes?: string }
  ): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/finance/approve/${submissionId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async rejectFinancePricing(
    submissionId: string,
    data: { reason: string }
  ): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/finance/reject/${submissionId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Admin
  async getAdminDashboardData(): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/dashboard/admin', {
      method: 'GET',
    });
  }

  async getUsers(): Promise<ApiResponse<any[]>> {
    return this.request<ApiResponse<any[]>>('/admin/users', {
      method: 'GET',
    });
  }

  async createUser(data: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    role: string;
    storeName?: string;
    permissionRoleName?: string;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/admin/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getUserById(userId: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/admin/users/${userId}`, {
      method: 'GET',
    });
  }

  async updateUser(
    userId: string,
    data: {
      firstName?: string;
      lastName?: string;
      email?: string;
      role?: string;
      avatar?: string;
    }
  ): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteUser(userId: string): Promise<ApiResponse<{ message: string }>> {
    return this.request<ApiResponse<{ message: string }>>(`/admin/users/${userId}`, {
      method: 'DELETE',
    });
  }

  async resetUserPassword(userId: string, newPassword: string): Promise<ApiResponse<{ message: string }>> {
    return this.request<ApiResponse<{ message: string }>>(`/admin/users/${userId}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    });
  }

  async getSystemSettings(): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/admin/settings', {
      method: 'GET',
    });
  }

  async updateSystemSettings(settings: any): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  async getRolePermissions(role: string): Promise<ApiResponse<string[]>> {
    return this.request<ApiResponse<string[]>>(`/admin/permissions/${role}`, {
      method: 'GET',
    });
  }

  async updateRolePermissions(role: string, permissions: string[]): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/admin/permissions/${role}`, {
      method: 'PUT',
      body: JSON.stringify({ permissions }),
    });
  }

  async listPermissionRoles(): Promise<ApiResponse<string[]>> {
    return this.request<ApiResponse<string[]>>('/admin/roles', {
      method: 'GET',
    });
  }

  async createPermissionRole(name: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/admin/roles', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async getPermissionCatalog(): Promise<ApiResponse<Array<{ id: string }>>> {
    return this.request<ApiResponse<Array<{ id: string }>>>('/admin/permissions/catalog', {
      method: 'GET',
    });
  }

  // Themes
  async getThemes(type?: string): Promise<ApiResponse<any[]>> {
    const url = type ? `/themes?type=${type}` : '/themes';
    return this.request<ApiResponse<any[]>>(url, {
      method: 'GET',
    });
  }

  async getTheme(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/themes/${id}`, {
      method: 'GET',
    });
  }

  async updateTheme(id: string, updates: any): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/themes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteTheme(id: string): Promise<ApiResponse<{ message: string }>> {
    return this.request<ApiResponse<{ message: string }>>(`/themes/${id}`, {
      method: 'DELETE',
    });
  }

  async getSellerTheme(sellerId?: string): Promise<ApiResponse<any>> {
    const url = sellerId ? `/themes/seller/${sellerId}` : '/themes/seller/my-theme';
    return this.request<ApiResponse<any>>(url, {
      method: 'GET',
    });
  }

  async updateSellerTheme(updates: {
    themeId?: string;
    customLogoUrl?: string;
    customFaviconUrl?: string;
    customColors?: Record<string, string>;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/themes/seller/my-theme', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async getThemeTemplates(): Promise<ApiResponse<any[]>> {
    return this.request<ApiResponse<any[]>>('/themes/templates/list', {
      method: 'GET',
    });
  }

  async applyThemeTemplate(templateId: string, name?: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/themes/templates/${templateId}/apply`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  // Domains
  async getSellerDomains(sellerId: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/domains/sellers/${sellerId}`, {
      method: 'GET',
    });
  }

  async getMyDomains(): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/domains/my-domains', {
      method: 'GET',
    });
  }

  async assignSubDomain(sellerId: string, data: { subDomain: string }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/domains/sellers/${sellerId}/subdomain`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async assignCustomDomain(
    sellerId: string,
    data: { customDomain: string; domainPackagePurchased?: boolean }
  ): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/domains/sellers/${sellerId}/custom-domain`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async removeSubDomain(sellerId: string): Promise<ApiResponse<{ message: string }>> {
    return this.request<ApiResponse<{ message: string }>>(`/domains/sellers/${sellerId}/subdomain`, {
      method: 'DELETE',
    });
  }

  async removeCustomDomain(sellerId: string): Promise<ApiResponse<{ message: string }>> {
    return this.request<ApiResponse<{ message: string }>>(`/domains/sellers/${sellerId}/custom-domain`, {
      method: 'DELETE',
    });
  }

  async getDomainPackages(): Promise<ApiResponse<any[]>> {
    return this.request<ApiResponse<any[]>>('/domains/packages', {
      method: 'GET',
    });
  }

  async getDNSConfiguration(sellerId: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/domains/sellers/${sellerId}/dns-config`, {
      method: 'GET',
    });
  }

  // Admin - Sellers
  async getAdminSellers(): Promise<ApiResponse<any[]>> {
    return this.request<ApiResponse<any[]>>('/admin/sellers', {
      method: 'GET',
    });
  }

  async inviteSeller(data: { email: string; sellerType: 'WHOLESALER' | 'B2C_SELLER'; message?: string }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/admin/sellers/invite', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getSellerInvitations(status?: string): Promise<ApiResponse<any[]>> {
    const url = status ? `/admin/sellers/invitations?status=${status}` : '/admin/sellers/invitations';
    return this.request<ApiResponse<any[]>>(url, {
      method: 'GET',
    });
  }

  async resendSellerInvitation(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/admin/sellers/invitations/${id}/resend`, {
      method: 'PUT',
    });
  }

  async cancelSellerInvitation(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/admin/sellers/invitations/${id}`, {
      method: 'DELETE',
    });
  }

  async validateInvitation(token: string): Promise<ApiResponse<{ email: string; sellerType: string; expiresAt: string }>> {
    return this.request<ApiResponse<{ email: string; sellerType: string; expiresAt: string }>>(`/auth/invitation?token=${token}`, {
      method: 'GET',
    });
  }

  async acceptInvitation(data: {
    token: string;
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    storeName: string;
    country: string;
    whatsappNumber?: string;
    preferredCommunicationMethod: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PHONE';
    gdprConsent: boolean;
    dataProcessingConsent?: Record<string, boolean>;
    logisticsOption?: 'HOS_LOGISTICS' | 'SELLER_OWN' | 'HOS_PARTNER';
  }): Promise<ApiResponse<{ user: any; token: string; refreshToken: string }>> {
    return this.request<ApiResponse<{ user: any; token: string; refreshToken: string }>>('/auth/accept-invitation', {
      method: 'POST',
      body: JSON.stringify({
        token: data.token,
        registerDto: {
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          password: data.password,
          role: 'seller', // Will be determined by invitation sellerType
          storeName: data.storeName,
          country: data.country,
          whatsappNumber: data.whatsappNumber,
          preferredCommunicationMethod: data.preferredCommunicationMethod,
          gdprConsent: data.gdprConsent,
          dataProcessingConsent: data.dataProcessingConsent,
          logisticsOption: data.logisticsOption,
        },
      }),
    });
  }

  // Currency & Exchange Rates
  async getCurrencyRates(): Promise<ApiResponse<Record<string, number>>> {
    return this.request<ApiResponse<Record<string, number>>>('/currency/rates', {
      method: 'GET',
    });
  }

  async convertCurrency(amount: number, from: string, to: string): Promise<ApiResponse<{ amount: number; from: string; to: string; converted: number }>> {
    return this.request<ApiResponse<{ amount: number; from: string; to: string; converted: number }>>(`/currency/convert?amount=${amount}&from=${from}&to=${to}`, {
      method: 'GET',
    });
  }

  async getUserCurrency(): Promise<ApiResponse<{ currency: string; rates: Record<string, number> }>> {
    return this.request<ApiResponse<{ currency: string; rates: Record<string, number> }>>('/currency/user-currency', {
      method: 'GET',
    });
  }

  // Geolocation
  async detectCountry(): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/geolocation/detect', {
      method: 'GET',
    });
  }

  async confirmCountry(data: { country: string; countryCode?: string }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/geolocation/confirm', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // GDPR
  async updateGDPRConsent(data: { marketing?: boolean; analytics?: boolean; essential?: boolean }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/gdpr/consent', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getGDPRConsent(): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/gdpr/consent', {
      method: 'GET',
    });
  }

  async exportUserData(): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/gdpr/export', {
      method: 'GET',
    });
  }

  async deleteUserData(): Promise<ApiResponse<{ message: string }>> {
    return this.request<ApiResponse<{ message: string }>>('/gdpr/data', {
      method: 'DELETE',
    });
  }

  async getGDPRConsentHistory(): Promise<ApiResponse<any[]>> {
    return this.request<ApiResponse<any[]>>('/gdpr/consent-history', {
      method: 'GET',
    });
  }

  // Compliance
  async getComplianceRequirements(country: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/compliance/requirements/${country}`, {
      method: 'GET',
    });
  }

  async getTaxRateByCountry(country: string): Promise<ApiResponse<{ rate: number }>> {
    return this.request<ApiResponse<{ rate: number }>>(`/compliance/tax-rates/${country}`, {
      method: 'GET',
    });
  }

  async verifyAge(data: { country: string; age: number }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/compliance/verify-age', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // User Profile & Gamification
  async getProfile(): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/users/profile', {
      method: 'GET',
    });
  }

  async getGamificationStats(): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/users/profile/gamification', {
      method: 'GET',
    });
  }

  async getBadges(): Promise<ApiResponse<any[]>> {
    return this.request<ApiResponse<any[]>>('/users/profile/badges', {
      method: 'GET',
    });
  }

  async getCollections(includePublic?: boolean): Promise<ApiResponse<any[]>> {
    const query = includePublic ? '?includePublic=true' : '';
    return this.request<ApiResponse<any[]>>(`/collections${query}`, {
      method: 'GET',
    });
  }

  async getCollection(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/collections/${id}`, {
      method: 'GET',
    });
  }

  async createCollection(data: { name: string; description?: string; isPublic?: boolean }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/collections', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCollection(id: string, data: { name?: string; description?: string; isPublic?: boolean }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/collections/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteCollection(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/collections/${id}`, {
      method: 'DELETE',
    });
  }

  async addProductToCollection(collectionId: string, productId: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/collections/${collectionId}/products/${productId}`, {
      method: 'POST',
    });
  }

  async removeProductFromCollection(collectionId: string, productId: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/collections/${collectionId}/products/${productId}`, {
      method: 'DELETE',
    });
  }

  // Quests
  async getQuests(): Promise<ApiResponse<any[]>> {
    return this.request<ApiResponse<any[]>>('/quests', {
      method: 'GET',
    });
  }

  async getQuest(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/quests/${id}`, {
      method: 'GET',
    });
  }

  async getAvailableQuests(): Promise<ApiResponse<any[]>> {
    return this.request<ApiResponse<any[]>>('/quests/available', {
      method: 'GET',
    });
  }

  async getActiveQuests(): Promise<ApiResponse<any[]>> {
    return this.request<ApiResponse<any[]>>('/quests/active', {
      method: 'GET',
    });
  }

  async getCompletedQuests(): Promise<ApiResponse<any[]>> {
    return this.request<ApiResponse<any[]>>('/quests/completed', {
      method: 'GET',
    });
  }

  async startQuest(questId: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/quests/${questId}/start`, {
      method: 'POST',
    });
  }

  async completeQuest(questId: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/quests/${questId}/complete`, {
      method: 'POST',
    });
  }

  // Badges - additional methods
  async getAllBadges(): Promise<ApiResponse<any[]>> {
    return this.request<ApiResponse<any[]>>('/badges', {
      method: 'GET',
    });
  }

  async getBadge(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/badges/${id}`, {
      method: 'GET',
    });
  }

  async getMyBadges(): Promise<ApiResponse<any[]>> {
    return this.request<ApiResponse<any[]>>('/badges/my-badges', {
      method: 'GET',
    });
  }

  // Leaderboard
  async getLeaderboard(params?: { timeframe?: string; category?: string; limit?: number }): Promise<ApiResponse<any>> {
    const query = params 
      ? `?${Object.entries(params).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join('&')}`
      : '';
    return this.request<ApiResponse<any>>(`/gamification/leaderboard${query}`, {
      method: 'GET',
    });
  }

  async getGamificationProfile(): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/gamification/profile', {
      method: 'GET',
    });
  }

  // Digital Products
  async getDigitalProducts(): Promise<ApiResponse<any[]>> {
    return this.request<ApiResponse<any[]>>('/digital-products/my-purchases', {
      method: 'GET',
    });
  }

  async getDigitalProduct(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/digital-products/${id}`, {
      method: 'GET',
    });
  }

  async downloadDigitalProduct(id: string): Promise<ApiResponse<{ downloadUrl: string }>> {
    return this.request<ApiResponse<{ downloadUrl: string }>>(`/digital-products/${id}/download`, {
      method: 'POST',
    });
  }

  async updateProfile(data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    avatar?: string;
    themePreference?: string;
    country?: string;
    whatsappNumber?: string;
    preferredCommunicationMethod?: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PHONE';
    currencyPreference?: string;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async changePassword(data: {
    currentPassword: string;
    newPassword: string;
  }): Promise<ApiResponse<{ message: string }>> {
    return this.request<ApiResponse<{ message: string }>>('/users/password', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Seller Profile
  async getSellerProfile(): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/sellers/me', {
      method: 'GET',
    });
  }

  async getSellerProducts(): Promise<ApiResponse<any[]>> {
    // Get seller profile first to get seller database ID
    const profileResponse = await this.getSellerProfile();
    if (!profileResponse?.data?.id) {
      return { data: [], message: 'Seller profile not found' };
    }
    // The seller object has an 'id' field which is the seller's database ID
    // The products service expects sellerId to be the userId, which it then converts to seller database ID
    // So we need to use the userId from the seller's user relation
    const userId = profileResponse.data.user?.id || profileResponse.data.userId;
    if (!userId) {
      return { data: [], message: 'User ID not found in seller profile' };
    }
    // Use products endpoint with sellerId filter (expects userId)
    const url = `/products?sellerId=${userId}`;
    const response = await this.request<ApiResponse<any>>(url, {
      method: 'GET',
    });
    // Extract products from paginated response
    const products = response.data?.data || response.data || [];
    return { data: Array.isArray(products) ? products : [], message: 'Products retrieved successfully' };
  }

  async getSellerOrders(status?: string): Promise<ApiResponse<any[]>> {
    // Orders endpoint automatically filters by user role (seller gets their orders)
    const response = await this.getOrders();
    let orders = Array.isArray(response.data) ? response.data : [];
    // Filter by status if provided
    if (status) {
      orders = orders.filter((order: any) => order.status === status);
    }
    return { data: orders, message: 'Orders retrieved successfully' };
  }

  async getSellerSubmissions(status?: string): Promise<ApiResponse<any[]>> {
    // Submissions endpoint automatically filters by user
    return this.getSubmissions(status);
  }

  async getWholesalerProducts(): Promise<ApiResponse<any[]>> {
    // Wholesalers are sellers with WHOLESALER role, use same approach as sellers
    const profileResponse = await this.getSellerProfile();
    if (!profileResponse?.data?.id) {
      return { data: [], message: 'Seller profile not found' };
    }
    // The seller object has an 'id' field which is the seller's database ID
    // The products service expects sellerId to be the userId, which it then converts to seller database ID
    // So we need to use the userId from the seller's user relation
    const userId = profileResponse.data.user?.id || profileResponse.data.userId;
    if (!userId) {
      return { data: [], message: 'User ID not found in seller profile' };
    }
    // Use products endpoint with sellerId filter (expects userId)
    const url = `/products?sellerId=${userId}`;
    const response = await this.request<ApiResponse<any>>(url, {
      method: 'GET',
    });
    // Extract products from paginated response
    const products = response.data?.data || response.data || [];
    return { data: Array.isArray(products) ? products : [], message: 'Products retrieved successfully' };
  }

  async getWholesalerOrders(status?: string): Promise<ApiResponse<any[]>> {
    // Orders endpoint automatically filters by user role (wholesaler gets their orders)
    const response = await this.getOrders();
    let orders = Array.isArray(response.data) ? response.data : [];
    // Filter by status if provided
    if (status) {
      orders = orders.filter((order: any) => order.status === status);
    }
    return { data: orders, message: 'Orders retrieved successfully' };
  }

  async getWholesalerSubmissions(status?: string): Promise<ApiResponse<any[]>> {
    // Submissions endpoint automatically filters by user
    return this.getSubmissions(status);
  }

  async updateSellerProfile(data: {
    storeName?: string;
    description?: string;
    logo?: string;
    country?: string;
    city?: string;
    region?: string;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/sellers/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Comprehensive Features Migration
  async runComprehensiveFeaturesMigration(): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/admin/migration-features/run-sql', {
      method: 'POST',
    });
  }

  async verifyComprehensiveFeaturesMigration(): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/admin/migration-features/verify');
  }

  // Taxonomy Migration
  async runTaxonomyMigration(): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/admin/migration-taxonomy/run-sql', {
      method: 'POST',
    });
  }

  async verifyTaxonomyMigration(): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/admin/migration-taxonomy/verify', {
      method: 'GET',
    });
  }

  async migrateTaxonomyData(): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/admin/migration-taxonomy-data/migrate', {
      method: 'POST',
    });
  }

  async getTaxonomyMigrationStatus(): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/admin/migration-taxonomy-data/status', {
      method: 'GET',
    });
  }

  // Finance - Transactions
  async getTransactions(filters?: { sellerId?: string; customerId?: string; type?: string; startDate?: string; endDate?: string }): Promise<ApiResponse<any[]>> {
    const params = new URLSearchParams();
    if (filters?.sellerId) params.append('sellerId', filters.sellerId);
    if (filters?.customerId) params.append('customerId', filters.customerId);
    if (filters?.type) params.append('type', filters.type);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    const query = params.toString();
    return this.request<ApiResponse<any[]>>(`/finance/transactions${query ? `?${query}` : ''}`);
  }

  async createTransaction(data: any): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/finance/transactions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Finance - Payouts
  async getPayouts(sellerId?: string): Promise<ApiResponse<any[]>> {
    const url = sellerId ? `/finance/payouts?sellerId=${sellerId}` : '/finance/payouts';
    return this.request<ApiResponse<any[]>>(url);
  }

  async schedulePayout(data: any): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/finance/payouts/schedule', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Finance - Refunds
  async getRefunds(customerId?: string): Promise<ApiResponse<any[]>> {
    const url = customerId ? `/finance/refunds?customerId=${customerId}` : '/finance/refunds';
    return this.request<ApiResponse<any[]>>(url);
  }

  async processRefund(data: any): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/finance/refunds', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Finance - Reports
  async getRevenueReport(startDate?: string, endDate?: string): Promise<ApiResponse<any>> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const query = params.toString();
    return this.request<ApiResponse<any>>(`/finance/reports/revenue${query ? `?${query}` : ''}`);
  }

  // Support - Tickets
  async getSupportTickets(filters?: { status?: string; assignedTo?: string; priority?: string }): Promise<ApiResponse<any[]>> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.assignedTo) params.append('assignedTo', filters.assignedTo);
    if (filters?.priority) params.append('priority', filters.priority);
    const query = params.toString();
    return this.request<ApiResponse<any[]>>(`/support/tickets${query ? `?${query}` : ''}`);
  }

  async getSupportTicket(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/support/tickets/${id}`);
  }

  async createSupportTicket(data: any): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/support/tickets', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateSupportTicket(id: string, data: { status?: string; priority?: string; assignedTo?: string }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/support/tickets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async replyToSupportTicket(id: string, data: { content: string; sender?: string }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/support/tickets/${id}/reply`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Fulfillment Centers
  async createFulfillmentCenter(data: {
    name: string;
    address: string;
    city: string;
    country: string;
    postalCode?: string;
    contactEmail?: string;
    contactPhone?: string;
    latitude?: number;
    longitude?: number;
    capacity?: number;
    isActive?: boolean;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/fulfillment/centers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateFulfillmentCenter(id: string, data: {
    name?: string;
    address?: string;
    city?: string;
    country?: string;
    postalCode?: string;
    contactEmail?: string;
    contactPhone?: string;
    latitude?: number;
    longitude?: number;
    capacity?: number;
    isActive?: boolean;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/fulfillment/centers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteFulfillmentCenter(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/fulfillment/centers/${id}`, {
      method: 'DELETE',
    });
  }

  async getFulfillmentCenters(activeOnly?: boolean): Promise<ApiResponse<any[]>> {
    const query = activeOnly ? '?activeOnly=true' : '';
    return this.request<ApiResponse<any[]>>(`/fulfillment/centers${query}`);
  }

  // Logistics Partners
  async createLogisticsPartner(data: {
    name: string;
    type?: string;
    contactEmail?: string;
    contactPhone?: string;
    website?: string;
    active?: boolean;
    isActive?: boolean;
  }): Promise<ApiResponse<any>> {
    const payload: any = {
      name: data.name,
    };
    if (data.type) payload.type = data.type;
    if (data.website) payload.website = data.website;
    if (data.contactEmail || data.contactPhone) {
      payload.contactInfo = {
        name: data.name,
        email: data.contactEmail || '',
        phone: data.contactPhone,
      };
    }
    if (data.isActive !== undefined) payload.isActive = data.isActive;
    return this.request<ApiResponse<any>>('/logistics/partners', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getLogisticsPartners(activeOnly?: boolean): Promise<ApiResponse<any[]>> {
    const query = activeOnly ? '?activeOnly=true' : '';
    return this.request<ApiResponse<any[]>>(`/logistics/partners${query}`);
  }

  // Activity Logs
  async getActivityLogs(filters?: { sellerId?: string; userId?: string; action?: string }): Promise<ApiResponse<any[]>> {
    const params = new URLSearchParams();
    if (filters?.sellerId) params.append('sellerId', filters.sellerId);
    if (filters?.userId) params.append('userId', filters.userId);
    if (filters?.action) params.append('action', filters.action);
    const query = params.toString();
    return this.request<ApiResponse<any[]>>(`/activity/logs${query ? `?${query}` : ''}`);
  }

  // Discrepancies
  async getDiscrepancies(filters?: { sellerId?: string; type?: string; status?: string }): Promise<ApiResponse<any[]>> {
    const params = new URLSearchParams();
    if (filters?.sellerId) params.append('sellerId', filters.sellerId);
    if (filters?.type) params.append('type', filters.type);
    if (filters?.status) params.append('status', filters.status);
    const query = params.toString();
    return this.request<ApiResponse<any[]>>(`/discrepancies${query ? `?${query}` : ''}`);
  }

  // WhatsApp
  async getWhatsAppConversations(): Promise<ApiResponse<any[]>> {
    return this.request<ApiResponse<any[]>>('/whatsapp/conversations');
  }

  // Admin - Products
  async createAdminProduct(data: {
    name: string;
    description: string;
    price: number;
    currency?: string;
    stock?: number;
    category?: string;
    tags?: string[];
    categoryId?: string;
    tagIds?: string[];
    attributes?: Array<{
      attributeId: string;
      attributeValueId?: string;
      textValue?: string;
      numberValue?: number;
      booleanValue?: boolean;
      dateValue?: string;
    }>;
    sellerId?: string | null;
    isPlatformOwned?: boolean;
    status?: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'OUT_OF_STOCK';
    sku?: string;
    barcode?: string;
    ean?: string;
    tradePrice?: number;
    rrp?: number;
    taxRate?: number;
    fandom?: string;
    images?: Array<{ url: string; alt?: string; order?: number }>;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/admin/products', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAdminProduct(
    id: string,
    data: {
      name?: string;
      description?: string;
      price?: number;
      stock?: number;
      category?: string;
      tags?: string[];
      categoryId?: string;
      tagIds?: string[];
      attributes?: Array<{
        attributeId: string;
        attributeValueId?: string;
        textValue?: string;
        numberValue?: number;
        booleanValue?: boolean;
        dateValue?: string;
      }>;
      sellerId?: string | null;
      status?: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'OUT_OF_STOCK';
      sku?: string;
      barcode?: string;
      ean?: string;
      tradePrice?: number;
      rrp?: number;
      taxRate?: number;
      fandom?: string;
      images?: Array<{ url: string; alt?: string; order?: number }>;
    },
  ): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/admin/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getAdminProducts(params?: {
    sellerId?: string | null;
    status?: string;
    category?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<any>> {
    const qp = new URLSearchParams();
    if (params?.sellerId === null) qp.append('sellerId', 'null');
    if (params?.sellerId) qp.append('sellerId', params.sellerId);
    if (params?.status) qp.append('status', params.status);
    if (params?.category) qp.append('category', params.category);
    if (params?.search) qp.append('search', params.search);
    if (params?.page) qp.append('page', String(params.page));
    if (params?.limit) qp.append('limit', String(params.limit));
    const query = qp.toString();
    return this.request<ApiResponse<any>>(`/admin/products${query ? `?${query}` : ''}`, {
      method: 'GET',
    });
  }

  // Taxonomy - Categories
  async getCategories(): Promise<ApiResponse<any[]>> {
    return this.request<ApiResponse<any[]>>('/taxonomy/categories');
  }

  async getCategoryTree(): Promise<ApiResponse<any[]>> {
    return this.request<ApiResponse<any[]>>('/taxonomy/categories/tree');
  }

  async getCategory(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/taxonomy/categories/${id}`);
  }

  async createCategory(data: {
    name: string;
    slug?: string;
    parentId?: string;
    level?: number;
    description?: string;
    image?: string;
    order?: number;
    isActive?: boolean;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/taxonomy/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCategory(id: string, data: {
    name?: string;
    slug?: string;
    parentId?: string;
    description?: string;
    image?: string;
    order?: number;
    isActive?: boolean;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/taxonomy/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteCategory(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/taxonomy/categories/${id}`, {
      method: 'DELETE',
    });
  }

  // Taxonomy - Attributes
  async getAttributes(filters?: {
    categoryId?: string;
    isGlobal?: boolean;
    type?: 'TEXT' | 'NUMBER' | 'SELECT' | 'BOOLEAN' | 'DATE';
  }): Promise<ApiResponse<any[]>> {
    const params = new URLSearchParams();
    if (filters?.categoryId) params.append('categoryId', filters.categoryId);
    if (filters?.isGlobal !== undefined) params.append('isGlobal', String(filters.isGlobal));
    if (filters?.type) params.append('type', filters.type);
    const query = params.toString();
    return this.request<ApiResponse<any[]>>(`/taxonomy/attributes${query ? `?${query}` : ''}`);
  }

  async getGlobalAttributes(): Promise<ApiResponse<any[]>> {
    return this.request<ApiResponse<any[]>>('/taxonomy/attributes/global');
  }

  async getAttributesForCategory(categoryId: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/taxonomy/attributes/category/${categoryId}`);
  }

  async getAttribute(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/taxonomy/attributes/${id}`);
  }

  async getAttributeValues(attributeId: string): Promise<ApiResponse<any[]>> {
    return this.request<ApiResponse<any[]>>(`/taxonomy/attributes/${attributeId}/values`);
  }

  async createAttribute(data: {
    name: string;
    slug?: string;
    type: 'TEXT' | 'NUMBER' | 'SELECT' | 'BOOLEAN' | 'DATE';
    isRequired?: boolean;
    isFilterable?: boolean;
    isSearchable?: boolean;
    isGlobal?: boolean;
    categoryId?: string;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/taxonomy/attributes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async createAttributeValue(attributeId: string, data: {
    value: string;
    slug?: string;
    order?: number;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/taxonomy/attributes/${attributeId}/values`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAttribute(id: string, data: {
    name?: string;
    slug?: string;
    type?: 'TEXT' | 'NUMBER' | 'SELECT' | 'BOOLEAN' | 'DATE';
    isRequired?: boolean;
    isFilterable?: boolean;
    isSearchable?: boolean;
    isGlobal?: boolean;
    categoryId?: string;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/taxonomy/attributes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async updateAttributeValue(valueId: string, data: {
    value?: string;
    order?: number;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/taxonomy/attributes/values/${valueId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteAttribute(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/taxonomy/attributes/${id}`, {
      method: 'DELETE',
    });
  }

  async deleteAttributeValue(valueId: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/taxonomy/attributes/values/${valueId}`, {
      method: 'DELETE',
    });
  }

  // Taxonomy - Tags
  async getTags(filters?: {
    category?: 'THEME' | 'OCCASION' | 'STYLE' | 'CHARACTER' | 'FANDOM' | 'CUSTOM';
    isActive?: boolean;
    search?: string;
  }): Promise<ApiResponse<any[]>> {
    const params = new URLSearchParams();
    if (filters?.category) params.append('category', filters.category);
    if (filters?.isActive !== undefined) params.append('isActive', String(filters.isActive));
    if (filters?.search) params.append('search', filters.search);
    const query = params.toString();
    return this.request<ApiResponse<any[]>>(`/taxonomy/tags${query ? `?${query}` : ''}`);
  }

  async searchTags(query: string): Promise<ApiResponse<any[]>> {
    return this.request<ApiResponse<any[]>>(`/taxonomy/tags/search?q=${encodeURIComponent(query)}`);
  }

  async getTagsByCategory(category: 'THEME' | 'OCCASION' | 'STYLE' | 'CHARACTER' | 'FANDOM' | 'CUSTOM'): Promise<ApiResponse<any[]>> {
    return this.request<ApiResponse<any[]>>(`/taxonomy/tags/category/${category}`);
  }

  async getTag(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/taxonomy/tags/${id}`);
  }

  async createTag(data: {
    name: string;
    slug?: string;
    category: 'THEME' | 'OCCASION' | 'STYLE' | 'CHARACTER' | 'FANDOM' | 'CUSTOM';
    description?: string;
    synonyms?: string[];
    isActive?: boolean;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/taxonomy/tags', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTag(id: string, data: {
    name?: string;
    slug?: string;
    category?: 'THEME' | 'OCCASION' | 'STYLE' | 'CHARACTER' | 'FANDOM' | 'CUSTOM';
    description?: string;
    synonyms?: string[];
    isActive?: boolean;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/taxonomy/tags/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteTag(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/taxonomy/tags/${id}`, {
      method: 'DELETE',
    });
  }

  // CMS Content Management
  async getCMSPages(): Promise<ApiResponse<any[]>> {
    return this.request<ApiResponse<any[]>>('/cms/pages');
  }

  async getCMSPage(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/cms/pages/${id}`);
  }

  async createCMSPage(data: {
    title: string;
    slug: string;
    content: string;
    metaTitle?: string;
    metaDescription?: string;
    keywords?: string;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/cms/pages', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCMSPage(id: string, data: {
    title?: string;
    slug?: string;
    content?: string;
    metaTitle?: string;
    metaDescription?: string;
    keywords?: string;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/cms/pages/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteCMSPage(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/cms/pages/${id}`, {
      method: 'DELETE',
    });
  }

  async getCMSBanners(type?: 'hero' | 'promotional' | 'sidebar'): Promise<ApiResponse<any[]>> {
    const url = type ? `/cms/banners?type=${type}` : '/cms/banners';
    return this.request<ApiResponse<any[]>>(url);
  }

  async getCMSBanner(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/cms/banners/${id}`);
  }

  async createCMSBanner(data: {
    title: string;
    type: 'hero' | 'promotional' | 'sidebar';
    image: string;
    link?: string;
    content?: string;
    active?: boolean;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/cms/banners', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCMSBanner(id: string, data: {
    title?: string;
    type?: 'hero' | 'promotional' | 'sidebar';
    image?: string;
    link?: string;
    content?: string;
    active?: boolean;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/cms/banners/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteCMSBanner(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/cms/banners/${id}`, {
      method: 'DELETE',
    });
  }

  async getCMSBlogPosts(limit?: number): Promise<ApiResponse<any[]>> {
    const url = limit ? `/cms/blog?limit=${limit}` : '/cms/blog';
    return this.request<ApiResponse<any[]>>(url);
  }

  async getCMSBlogPost(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/cms/blog/${id}`);
  }

  async createCMSBlogPost(data: {
    title: string;
    slug: string;
    excerpt: string;
    content: string;
    coverImage?: string;
    author?: string;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/cms/blog', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCMSBlogPost(id: string, data: {
    title?: string;
    slug?: string;
    excerpt?: string;
    content?: string;
    coverImage?: string;
    author?: string;
    publishedAt?: string;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/cms/blog/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteCMSBlogPost(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/cms/blog/${id}`, {
      method: 'DELETE',
    });
  }

  async publishCMSBlogPost(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/cms/blog/${id}/publish`, {
      method: 'POST',
    });
  }

  // CMS Media - Uses uploads endpoint
  async getCMSMedia(): Promise<ApiResponse<any[]>> {
    // Note: There's no dedicated media list endpoint in the backend
    // This would need to be implemented or use a different approach
    // For now, return empty array with a note that this needs backend implementation
    console.warn('getCMSMedia: Backend endpoint /cms/media does not exist. This method needs backend implementation.');
    return { data: [], message: 'Media endpoint not implemented in backend' };
  }

  async uploadCMSMedia(formData: FormData): Promise<ApiResponse<any>> {
    if (!this.baseUrl) {
      throw new Error('API base URL is not configured. Please set NEXT_PUBLIC_API_URL environment variable.');
    }
    
    // Use the uploads endpoint instead of non-existent /cms/media
    const token = this.getToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = `${this.baseUrl}/uploads/single`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
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

      // Backend returns ApiResponse structure: { data: { url: string }, message: string }
      const result = await response.json();
      // Ensure the response matches ApiResponse structure
      if (result && typeof result === 'object' && 'data' in result) {
        return result as ApiResponse<any>;
      }
      // If backend doesn't return ApiResponse structure, wrap it
      return {
        data: result,
        message: 'File uploaded successfully',
      } as ApiResponse<any>;
    } catch (error: any) {
      // Enhanced error logging - matches pattern used in request() method
      if (typeof window !== 'undefined') {
        console.error('API Request failed:', {
          url,
          method: 'POST',
          error: error.message,
          stack: error.stack,
        });
      }
      throw error;
    }
  }

  // Uploads (generic)
  async uploadSingleFile(file: File, folder: string = 'uploads'): Promise<ApiResponse<{ url: string }>> {
    if (!this.baseUrl) {
      throw new Error('API base URL is not configured. Please set NEXT_PUBLIC_API_URL environment variable.');
    }
    
    const token = this.getToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);

    const url = `${this.baseUrl}/uploads/single`;
    const response = await fetch(url, { method: 'POST', headers, body: formData });

    if (response.status === 401) {
      this.onUnauthorized();
      throw new Error('Unauthorized');
    }

    const result = await response.json();
    if (!response.ok) {
      const msg = (result as any)?.message;
      throw new Error(Array.isArray(msg) ? msg.join(', ') : msg || `HTTP error! status: ${response.status}`);
    }

    return result as ApiResponse<{ url: string }>;
  }

  async uploadMultipleFiles(files: File[], folder: string = 'uploads'): Promise<ApiResponse<{ urls: string[] }>> {
    if (!this.baseUrl) {
      throw new Error('API base URL is not configured. Please set NEXT_PUBLIC_API_URL environment variable.');
    }
    
    const token = this.getToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const formData = new FormData();
    files.forEach((f) => formData.append('files', f));
    formData.append('folder', folder);

    const url = `${this.baseUrl}/uploads/multiple`;
    const response = await fetch(url, { method: 'POST', headers, body: formData });

    if (response.status === 401) {
      this.onUnauthorized();
      throw new Error('Unauthorized');
    }

    const result = await response.json();
    if (!response.ok) {
      const msg = (result as any)?.message;
      throw new Error(Array.isArray(msg) ? msg.join(', ') : msg || `HTTP error! status: ${response.status}`);
    }

    return result as ApiResponse<{ urls: string[] }>;
  }

  // CMS Settings - Uses admin settings endpoint
  async getCMSSettings(): Promise<ApiResponse<any>> {
    // CMS settings should use admin settings endpoint
    return this.request<ApiResponse<any>>('/admin/settings', {
      method: 'GET',
    });
  }

  async updateCMSSettings(settings: any): Promise<ApiResponse<any>> {
    // CMS settings should use admin settings endpoint
    return this.request<ApiResponse<any>>('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  // Gift Cards
  async createGiftCard(data: {
    type: 'digital' | 'physical';
    amount: number;
    currency?: string;
    issuedToEmail?: string;
    issuedToName?: string;
    message?: string;
    expiresAt?: string;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/gift-cards', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async validateGiftCard(code: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/gift-cards/validate/${code}`, {
      method: 'GET',
    });
  }

  async redeemGiftCard(data: { code: string; amount: number; orderId?: string }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/gift-cards/redeem', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getMyGiftCards(): Promise<ApiResponse<any[]>> {
    return this.request<ApiResponse<any[]>>('/gift-cards/my-gift-cards', {
      method: 'GET',
    });
  }

  async getGiftCardTransactions(giftCardId: string): Promise<ApiResponse<any[]>> {
    return this.request<ApiResponse<any[]>>(`/gift-cards/${giftCardId}/transactions`, {
      method: 'GET',
    });
  }

  // Promotions & Coupons
  async getPromotions(): Promise<ApiResponse<any[]>> {
    return this.request<ApiResponse<any[]>>('/promotions');
  }

  async getPromotion(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/promotions/${id}`);
  }

  async createPromotion(data: {
    name: string;
    type: string;
    discountType: string;
    discountValue: number;
    conditions?: any;
    actions?: any;
    startDate?: string;
    endDate?: string;
    isActive?: boolean;
    sellerId?: string;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/promotions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePromotion(id: string, data: {
    name?: string;
    type?: string;
    discountType?: string;
    discountValue?: number;
    conditions?: any;
    actions?: any;
    startDate?: string;
    endDate?: string;
    isActive?: boolean;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/promotions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deletePromotion(id: string): Promise<ApiResponse<null>> {
    return this.request<ApiResponse<null>>(`/promotions/${id}`, {
      method: 'DELETE',
    });
  }

  async validateCoupon(couponCode: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/promotions/coupons/validate', {
      method: 'POST',
      body: JSON.stringify({ couponCode }),
    });
  }

  async applyCoupon(cartId: string, couponCode: string): Promise<ApiResponse<Cart>> {
    return this.request<ApiResponse<Cart>>('/promotions/coupons/apply', {
      method: 'POST',
      body: JSON.stringify({ cartId, couponCode }),
    });
  }

  async removeCoupon(cartId: string): Promise<ApiResponse<Cart>> {
    return this.request<ApiResponse<Cart>>('/promotions/coupons/remove', {
      method: 'POST',
      body: JSON.stringify({ cartId }),
    });
  }

  // Shipping
  async getShippingMethods(sellerId?: string): Promise<ApiResponse<any[]>> {
    const query = sellerId ? `?sellerId=${sellerId}` : '';
    return this.request<ApiResponse<any[]>>(`/shipping/methods${query}`);
  }

  async getShippingOptions(data: {
    cartItems: Array<{ productId: string; quantity: number; price: number }>;
    cartValue: number;
    destination: { country: string; state?: string; city?: string; postalCode?: string };
    sellerId?: string;
  }): Promise<ApiResponse<any[]>> {
    return this.request<ApiResponse<any[]>>('/shipping/options', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Inventory & Warehouses
  async getProductInventory(productId: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/inventory/products/${productId}`);
  }

  async getWarehouses(): Promise<ApiResponse<any[]>> {
    return this.request<ApiResponse<any[]>>('/inventory/warehouses');
  }

  async createWarehouse(data: {
    name: string;
    code: string;
    address: string;
    city: string;
    state?: string;
    country: string;
    postalCode: string;
    latitude?: number;
    longitude?: number;
    contactEmail?: string;
    contactPhone?: string;
    managerName?: string;
    capacity?: number;
    warehouseType?: string;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/inventory/warehouses', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateWarehouse(id: string, data: {
    name?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
    latitude?: number;
    longitude?: number;
    contactEmail?: string;
    contactPhone?: string;
    managerName?: string;
    capacity?: number;
    warehouseType?: string;
    isActive?: boolean;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/inventory/warehouses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteWarehouse(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/inventory/warehouses/${id}`, {
      method: 'DELETE',
    });
  }

  // Stock Transfers
  async createStockTransfer(data: {
    fromWarehouseId: string;
    toWarehouseId: string;
    productId: string;
    quantity: number;
    notes?: string;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/inventory/transfers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getStockTransfers(filters?: {
    fromWarehouseId?: string;
    toWarehouseId?: string;
    productId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<any>> {
    const queryParams = new URLSearchParams();
    if (filters?.fromWarehouseId) queryParams.append('fromWarehouseId', filters.fromWarehouseId);
    if (filters?.toWarehouseId) queryParams.append('toWarehouseId', filters.toWarehouseId);
    if (filters?.productId) queryParams.append('productId', filters.productId);
    if (filters?.status) queryParams.append('status', filters.status);
    if (filters?.page) queryParams.append('page', filters.page.toString());
    if (filters?.limit) queryParams.append('limit', filters.limit.toString());
    const query = queryParams.toString();
    return this.request<ApiResponse<any>>(`/inventory/transfers${query ? `?${query}` : ''}`);
  }

  // Warehouse Routing
  async findNearestWarehouse(data: {
    latitude: number;
    longitude: number;
    productQuantities: Array<{ productId: string; quantity: number }>;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/inventory/routing/nearest-warehouse', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async findNearestFulfillmentCenter(data: {
    latitude: number;
    longitude: number;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/inventory/routing/nearest-fulfillment-center', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getOptimalFulfillmentSource(data: {
    shippingAddressId: string;
    productQuantities: Array<{ productId: string; quantity: number }>;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/inventory/routing/optimal-source', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async geocodeAddress(addressId: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/inventory/geocode/${addressId}`, {
      method: 'POST',
    });
  }

  async completeStockTransfer(transferId: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/inventory/transfers/${transferId}/complete`, {
      method: 'POST',
    });
  }

  // Stock Movements
  async getStockMovements(filters?: {
    inventoryLocationId?: string;
    productId?: string;
    warehouseId?: string;
    movementType?: string;
    referenceType?: string;
    referenceId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<any>> {
    const queryParams = new URLSearchParams();
    if (filters?.inventoryLocationId) queryParams.append('inventoryLocationId', filters.inventoryLocationId);
    if (filters?.productId) queryParams.append('productId', filters.productId);
    if (filters?.warehouseId) queryParams.append('warehouseId', filters.warehouseId);
    if (filters?.movementType) queryParams.append('movementType', filters.movementType);
    if (filters?.referenceType) queryParams.append('referenceType', filters.referenceType);
    if (filters?.referenceId) queryParams.append('referenceId', filters.referenceId);
    if (filters?.startDate) queryParams.append('startDate', filters.startDate);
    if (filters?.endDate) queryParams.append('endDate', filters.endDate);
    if (filters?.page) queryParams.append('page', filters.page.toString());
    if (filters?.limit) queryParams.append('limit', filters.limit.toString());
    const query = queryParams.toString();
    return this.request<ApiResponse<any>>(`/inventory/movements${query ? `?${query}` : ''}`);
  }

  async recordStockMovement(data: {
    inventoryLocationId: string;
    productId: string;
    quantity: number;
    movementType: 'IN' | 'OUT' | 'ADJUST' | 'RESERVE' | 'RELEASE';
    referenceType?: string;
    referenceId?: string;
    notes?: string;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/inventory/movements', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getInventoryLocations(warehouseId?: string, productId?: string): Promise<ApiResponse<any[]>> {
    const queryParams = new URLSearchParams();
    if (warehouseId) queryParams.append('warehouseId', warehouseId);
    if (productId) queryParams.append('productId', productId);
    const query = queryParams.toString();
    return this.request<ApiResponse<any[]>>(`/inventory/locations${query ? `?${query}` : ''}`);
  }

  // Customer Groups
  async getCustomerGroups(includeInactive?: boolean): Promise<ApiResponse<any[]>> {
    const query = includeInactive ? '?includeInactive=true' : '';
    return this.request<ApiResponse<any[]>>(`/customer-groups${query}`);
  }

  async getCustomerGroup(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/customer-groups/${id}`);
  }

  async createCustomerGroup(data: {
    name: string;
    description?: string;
    type: string;
    isActive?: boolean;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/customer-groups', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCustomerGroup(id: string, data: Partial<{
    name: string;
    description?: string;
    type: string;
    isActive?: boolean;
  }>): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/customer-groups/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async addCustomerToGroup(groupId: string, userId: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/customer-groups/${groupId}/customers/${userId}`, {
      method: 'POST',
    });
  }

  async removeCustomerFromGroup(userId: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/customer-groups/customers/${userId}`, {
      method: 'DELETE',
    });
  }

  async getMyCustomerGroup(): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/customer-groups/my/group');
  }

  // Return Policies
  async getReturnPolicies(sellerId?: string, productId?: string, categoryId?: string): Promise<ApiResponse<any[]>> {
    const params = new URLSearchParams();
    if (sellerId) params.append('sellerId', sellerId);
    if (productId) params.append('productId', productId);
    if (categoryId) params.append('categoryId', categoryId);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<ApiResponse<any[]>>(`/return-policies${query}`);
  }

  async getReturnPolicy(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/return-policies/${id}`);
  }

  async getApplicableReturnPolicy(productId: string, sellerId?: string, categoryId?: string): Promise<ApiResponse<any>> {
    const params = new URLSearchParams();
    if (sellerId) params.append('sellerId', sellerId);
    if (categoryId) params.append('categoryId', categoryId);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<ApiResponse<any>>(`/return-policies/applicable/${productId}${query}`);
  }

  async checkReturnEligibility(orderId: string, productId?: string): Promise<ApiResponse<any>> {
    const query = productId ? `?productId=${productId}` : '';
    return this.request<ApiResponse<any>>(`/return-policies/eligibility/${orderId}${query}`);
  }

  async createReturnPolicy(data: {
    name: string;
    description?: string;
    sellerId?: string;
    productId?: string;
    categoryId?: string;
    isReturnable?: boolean;
    returnWindowDays: number;
    requiresApproval?: boolean;
    requiresInspection?: boolean;
    refundMethod?: string;
    restockingFee?: number;
    priority?: number;
    isActive?: boolean;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/return-policies', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateReturnPolicy(id: string, data: Partial<{
    name: string;
    description?: string;
    sellerId?: string;
    productId?: string;
    categoryId?: string;
    isReturnable?: boolean;
    returnWindowDays?: number;
    requiresApproval?: boolean;
    requiresInspection?: boolean;
    refundMethod?: string;
    restockingFee?: number;
    priority?: number;
    isActive?: boolean;
  }>): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/return-policies/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteReturnPolicy(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/return-policies/${id}`, {
      method: 'DELETE',
    });
  }

  async evaluateReturnPolicy(orderId: string, productId?: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/return-policies/evaluate', {
      method: 'POST',
      body: JSON.stringify({ orderId, productId }),
    });
  }

  // Return Requests
  async getReturns(): Promise<ApiResponse<any[]>> {
    return this.request<ApiResponse<any[]>>('/returns');
  }

  async getReturn(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/returns/${id}`);
  }

  async createReturnRequest(data: {
    orderId: string;
    reason: string;
    notes?: string;
    items?: Array<{
      orderItemId: string;
      quantity: number;
      reason?: string;
    }>;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/returns', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateReturnStatus(id: string, data: {
    status: string;
    refundAmount?: number;
    refundMethod?: string;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/returns/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Payment Providers
  async getPaymentProviders(): Promise<ApiResponse<string[]>> {
    return this.request<ApiResponse<string[]>>('/payments/providers');
  }

  // Tax Zones & Classes
  async getTaxZones(includeInactive?: boolean): Promise<ApiResponse<any[]>> {
    const query = includeInactive ? '?includeInactive=true' : '';
    return this.request<ApiResponse<any[]>>(`/tax/zones${query}`);
  }

  async getTaxZone(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/tax/zones/${id}`);
  }

  async createTaxZone(data: {
    name: string;
    country?: string;
    state?: string;
    city?: string;
    postalCodes?: string[];
    isActive?: boolean;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/tax/zones', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTaxZone(id: string, data: {
    name?: string;
    country?: string;
    state?: string;
    city?: string;
    postalCodes?: string[];
    isActive?: boolean;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/tax/zones/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteTaxZone(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/tax/zones/${id}`, {
      method: 'DELETE',
    });
  }

  async getTaxClasses(): Promise<ApiResponse<any[]>> {
    return this.request<ApiResponse<any[]>>('/tax/classes');
  }

  async getTaxClass(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/tax/classes/${id}`);
  }

  async createTaxClass(data: {
    name: string;
    description?: string;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/tax/classes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTaxClass(id: string, data: {
    name?: string;
    description?: string;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/tax/classes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteTaxClass(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/tax/classes/${id}`, {
      method: 'DELETE',
    });
  }

  async getTaxRates(taxZoneId?: string, taxClassId?: string): Promise<ApiResponse<any[]>> {
    const queryParams = new URLSearchParams();
    if (taxZoneId) queryParams.append('taxZoneId', taxZoneId);
    if (taxClassId) queryParams.append('taxClassId', taxClassId);
    const query = queryParams.toString();
    return this.request<ApiResponse<any[]>>(`/tax/rates${query ? `?${query}` : ''}`);
  }

  async createTaxRate(data: {
    taxZoneId: string;
    taxClassId?: string;
    rate: number;
    isInclusive?: boolean;
    isActive?: boolean;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/tax/rates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTaxRate(id: string, data: {
    rate?: number;
    isInclusive?: boolean;
    isActive?: boolean;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/tax/rates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteTaxRate(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/tax/rates/${id}`, {
      method: 'DELETE',
    });
  }

  async calculateTax(data: {
    amount: number;
    taxClassId: string;
    location: { country: string; state?: string; city?: string; postalCode?: string };
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/tax/calculate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Wishlist
  async addToWishlist(productId: string): Promise<ApiResponse<{ message: string }>> {
    return this.request<ApiResponse<{ message: string }>>(`/wishlist/products/${productId}`, {
      method: 'POST',
    });
  }

  async removeFromWishlist(productId: string): Promise<ApiResponse<{ message: string }>> {
    return this.request<ApiResponse<{ message: string }>>(`/wishlist/products/${productId}`, {
      method: 'DELETE',
    });
  }

  async getWishlist(): Promise<ApiResponse<any[]>> {
    return this.request<ApiResponse<any[]>>('/wishlist');
  }

  async checkWishlistStatus(productId: string): Promise<ApiResponse<{ inWishlist: boolean }>> {
    return this.request<ApiResponse<{ inWishlist: boolean }>>(`/wishlist/products/${productId}/check`);
  }

  // Reviews
  async getProductReviews(productId: string): Promise<ApiResponse<any[]>> {
    return this.request<ApiResponse<any[]>>(`/reviews/products/${productId}`);
  }

  async createReview(productId: string, data: { rating: number; title: string; comment: string }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/reviews/products/${productId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateReview(reviewId: string, data: { rating?: number; title?: string; comment?: string }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/reviews/${reviewId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteReview(reviewId: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/reviews/${reviewId}`, {
      method: 'DELETE',
    });
  }

  // Addresses
  async getAddresses(): Promise<ApiResponse<any[]>> {
    return this.request<ApiResponse<any[]>>('/addresses');
  }

  async getAddress(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/addresses/${id}`);
  }

  async createAddress(data: {
    street: string;
    city: string;
    state?: string;
    postalCode: string;
    country: string;
    isDefault?: boolean;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/addresses', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAddress(id: string, data: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    isDefault?: boolean;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/addresses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteAddress(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/addresses/${id}`, {
      method: 'DELETE',
    });
  }

  async setDefaultAddress(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/addresses/${id}/set-default`, {
      method: 'POST',
    });
  }

  // File Uploads - Using existing uploadSingleFile and uploadMultipleFiles methods
  // Alias methods for convenience
  async uploadFile(file: File, folder?: string): Promise<ApiResponse<string>> {
    const result = await this.uploadSingleFile(file, folder || 'uploads');
    // Transform response format if needed
    if (result?.data?.url) {
      return { data: result.data.url, message: result.message || 'Upload successful' } as ApiResponse<string>;
    }
    return result as any;
  }

  // Bulk Product Operations - Note: Export returns JSON, convert to CSV on frontend
  async exportProducts(): Promise<ApiResponse<any[]>> {
    return this.request<ApiResponse<any[]>>('/products/export/csv');
  }

  async importProducts(products: any[]): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/products/import', {
      method: 'POST',
      body: JSON.stringify({ products }),
    });
  }

  // Analytics
  async getSalesTrends(filters?: {
    startDate?: string;
    endDate?: string;
    sellerId?: string;
    period?: 'daily' | 'weekly' | 'monthly' | 'yearly';
    compareWithPrevious?: boolean;
  }): Promise<ApiResponse<any>> {
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value));
        }
      });
    }
    const query = queryParams.toString();
    return this.request<ApiResponse<any>>(`/analytics/sales/trends${query ? `?${query}` : ''}`);
  }

  async getCustomerMetrics(filters?: {
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<any>> {
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value));
        }
      });
    }
    const query = queryParams.toString();
    return this.request<ApiResponse<any>>(`/analytics/customers/metrics${query ? `?${query}` : ''}`);
  }

  async getProductPerformance(filters?: {
    startDate?: string;
    endDate?: string;
    sellerId?: string;
    limit?: number;
  }): Promise<ApiResponse<any>> {
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value));
        }
      });
    }
    const query = queryParams.toString();
    return this.request<ApiResponse<any>>(`/analytics/products/performance${query ? `?${query}` : ''}`);
  }

  async getInventoryMetrics(filters?: {
    warehouseId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<any>> {
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value));
        }
      });
    }
    const query = queryParams.toString();
    return this.request<ApiResponse<any>>(`/analytics/inventory/metrics${query ? `?${query}` : ''}`);
  }

  async getRevenueGrowth(filters: {
    startDate: string;
    endDate: string;
    comparisonType?: 'month' | 'year';
  }): Promise<ApiResponse<any>> {
    const queryParams = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, String(value));
      }
    });
    const query = queryParams.toString();
    return this.request<ApiResponse<any>>(`/analytics/revenue/growth?${query}`);
  }

  async exportAnalytics(
    reportType: 'sales' | 'customers' | 'products' | 'inventory',
    format: 'csv' | 'xlsx' | 'pdf',
    filters?: {
      startDate?: string;
      endDate?: string;
    }
  ): Promise<Blob> {
    const queryParams = new URLSearchParams();
    queryParams.append('reportType', reportType);
    queryParams.append('format', format);
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value));
        }
      });
    }
    const query = queryParams.toString();

    // For file downloads, we need to handle the response as a blob
    const token = this.getToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const baseUrl = this.baseUrl || '';
    const url = `${baseUrl}/analytics/export/${format}?${query}`;

    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      throw new Error(`Export failed: ${response.statusText}`);
    }

    return response.blob();
  }

  // ============================================================
  // SETTLEMENTS API
  // ============================================================

  async getSettlements(filters?: {
    sellerId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<any[]>> {
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) queryParams.append(key, value);
      });
    }
    const query = queryParams.toString();
    return this.request<ApiResponse<any[]>>(`/settlements${query ? `?${query}` : ''}`);
  }

  async getSettlement(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/settlements/${id}`);
  }

  async createSettlement(data: {
    sellerId: string;
    periodStart: string;
    periodEnd: string;
    notes?: string;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/settlements', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async processSettlement(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/settlements/${id}/process`, {
      method: 'POST',
    });
  }

  async markSettlementPaid(id: string, data: {
    paymentReference: string;
    paymentMethod?: string;
    notes?: string;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/settlements/${id}/mark-paid`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async cancelSettlement(id: string, data: {
    reason: string;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/settlements/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async retrySettlement(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/settlements/${id}/retry`, {
      method: 'POST',
    });
  }

  async getSellerSettlements(sellerId?: string): Promise<ApiResponse<any[]>> {
    const query = sellerId ? `?sellerId=${sellerId}` : '';
    return this.request<ApiResponse<any[]>>(`/settlements/seller${query}`);
  }

  async getSettlementsSummary(filters?: {
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<any>> {
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) queryParams.append(key, value);
      });
    }
    const query = queryParams.toString();
    return this.request<ApiResponse<any>>(`/settlements/summary${query ? `?${query}` : ''}`);
  }

  // ==================== Integrations ====================

  async getIntegrations(category?: string): Promise<ApiResponse<any[]>> {
    const query = category ? `?category=${encodeURIComponent(category)}` : '';
    return this.request<ApiResponse<any[]>>(`/integrations${query}`);
  }

  async getIntegrationById(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/integrations/${encodeURIComponent(id)}`);
  }

  async getIntegrationsByCategory(category: string): Promise<ApiResponse<any[]>> {
    return this.request<ApiResponse<any[]>>(`/integrations/category/${encodeURIComponent(category)}`);
  }

  async getActiveIntegration(category: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/integrations/category/${encodeURIComponent(category)}/active`);
  }

  async getAvailableProviders(): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/integrations/providers');
  }

  async getProviderMetadata(provider: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/integrations/providers/${encodeURIComponent(provider)}`);
  }

  async createIntegration(data: {
    category: string;
    provider: string;
    displayName: string;
    description?: string;
    isActive?: boolean;
    isTestMode?: boolean;
    credentials: Record<string, any>;
    settings?: Record<string, any>;
    priority?: number;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/integrations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateIntegration(id: string, data: {
    displayName?: string;
    description?: string;
    isActive?: boolean;
    isTestMode?: boolean;
    credentials?: Record<string, any>;
    settings?: Record<string, any>;
    priority?: number;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/integrations/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteIntegration(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/integrations/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  async testIntegrationConnection(id: string, credentials?: Record<string, any>): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/integrations/${encodeURIComponent(id)}/test`, {
      method: 'POST',
      body: JSON.stringify({ credentials }),
    });
  }

  async getIntegrationLogs(id: string, options?: {
    limit?: number;
    offset?: number;
    action?: string;
  }): Promise<ApiResponse<any>> {
    const queryParams = new URLSearchParams();
    if (options?.limit) queryParams.append('limit', options.limit.toString());
    if (options?.offset) queryParams.append('offset', options.offset.toString());
    if (options?.action) queryParams.append('action', options.action);
    const query = queryParams.toString();
    return this.request<ApiResponse<any>>(`/integrations/${encodeURIComponent(id)}/logs${query ? `?${query}` : ''}`);
  }

  async activateIntegration(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/integrations/${encodeURIComponent(id)}/activate`, {
      method: 'PUT',
    });
  }

  async deactivateIntegration(id: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(`/integrations/${encodeURIComponent(id)}/deactivate`, {
      method: 'PUT',
    });
  }
}
