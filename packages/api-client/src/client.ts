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
    return this.request<ApiResponse<any>>('/admin/dashboard', {
      method: 'GET',
    });
  }

  async getUsers(): Promise<ApiResponse<any[]>> {
    return this.request<ApiResponse<any[]>>('/admin/users', {
      method: 'GET',
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

  async getTaxRates(country: string): Promise<ApiResponse<{ rate: number }>> {
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

  async getCollections(): Promise<ApiResponse<any[]>> {
    return this.request<ApiResponse<any[]>>('/users/profile/collections', {
      method: 'GET',
    });
  }

  async updateProfile(data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    avatar?: string;
    themePreference?: string;
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

  // Admin Migration
  async runGlobalFeaturesMigration(): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/admin/migration/run-global-features', {
      method: 'POST',
    });
  }

  async verifyMigration(): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/admin/migration/verify', {
      method: 'POST',
    });
  }
}
