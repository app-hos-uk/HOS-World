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

  // Payment endpoints
  async createPaymentIntent(data: {
    orderId: string;
    amount: number;
    currency?: string;
    paymentMethod?: string;
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

  async createSupportTicket(data: any): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/support/tickets', {
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
    active?: boolean;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/fulfillment/centers', {
      method: 'POST',
      body: JSON.stringify(data),
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
    sellerId?: string | null;
    isPlatformOwned?: boolean;
    status?: 'DRAFT' | 'PUBLISHED';
    sku?: string;
    barcode?: string;
    ean?: string;
    tradePrice?: number;
    rrp?: number;
    taxRate?: number;
    fandom?: string;
  }): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>('/admin/products', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}
