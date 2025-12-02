import { ApiClient } from './client';

export interface Theme {
  id: string;
  name: string;
  type: 'hos' | 'seller' | 'customer';
  sellerId?: string;
  config: {
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
        '2xl'?: string;
        '3xl'?: string;
      };
    };
    spacing?: Record<string, string>;
    borderRadius?: Record<string, string>;
    shadows?: Record<string, string>;
  };
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface SellerTheme {
  theme: Theme | null;
  customSettings: {
    customLogoUrl?: string;
    customFaviconUrl?: string;
    customColors?: Record<string, string>;
  } | null;
}

export interface ThemePreference {
  themePreference: 'light' | 'dark' | 'accessibility' | 'auto' | null;
}

export class ThemesApi {
  constructor(private client: ApiClient) {}

  // Theme CRUD
  async getAllThemes(type?: string, sellerId?: string): Promise<Theme[]> {
    const params = new URLSearchParams();
    if (type) params.append('type', type);
    if (sellerId) params.append('sellerId', sellerId);

    const response = await this.client.get<{ data: Theme[] }>(
      `/themes?${params.toString()}`,
    );
    return response.data;
  }

  async getTheme(id: string): Promise<Theme> {
    const response = await this.client.get<{ data: Theme }>(`/themes/${id}`);
    return response.data;
  }

  async createTheme(theme: {
    name: string;
    type: 'HOS' | 'SELLER' | 'CUSTOMER';
    sellerId?: string;
    config: Theme['config'];
    isActive?: boolean;
  }): Promise<Theme> {
    const response = await this.client.post<{ data: Theme }>('/themes', theme);
    return response.data;
  }

  async updateTheme(id: string, updates: Partial<Theme>): Promise<Theme> {
    const response = await this.client.put<{ data: Theme }>(
      `/themes/${id}`,
      updates,
    );
    return response.data;
  }

  async deleteTheme(id: string): Promise<void> {
    await this.client.delete(`/themes/${id}`);
  }

  // Seller Theme Customization
  async getSellerTheme(sellerId?: string): Promise<SellerTheme> {
    const endpoint = sellerId
      ? `/themes/seller/${sellerId}`
      : '/themes/seller/my-theme';
    const response = await this.client.get<{ data: SellerTheme }>(endpoint);
    return response.data;
  }

  async updateSellerTheme(updates: {
    themeId?: string;
    customLogoUrl?: string;
    customFaviconUrl?: string;
    customColors?: Record<string, string>;
  }): Promise<SellerTheme> {
    const response = await this.client.put<{ data: SellerTheme }>(
      '/themes/seller/my-theme',
      updates,
    );
    return response.data;
  }

  // Customer Theme Preferences
  async getCustomerThemePreference(): Promise<ThemePreference> {
    const response = await this.client.get<{ data: ThemePreference }>(
      '/themes/customer/preference',
    );
    return response.data;
  }

  async updateCustomerThemePreference(
    preference: 'light' | 'dark' | 'accessibility' | 'auto',
  ): Promise<ThemePreference> {
    const response = await this.client.put<{ data: ThemePreference }>(
      '/themes/customer/preference',
      { themePreference: preference },
    );
    return response.data;
  }

  // Theme Templates
  async getThemeTemplates(): Promise<Theme[]> {
    const response = await this.client.get<{ data: Theme[] }>(
      '/themes/templates/list',
    );
    return response.data;
  }

  async createThemeFromTemplate(
    templateId: string,
    name?: string,
  ): Promise<Theme> {
    const response = await this.client.post<{ data: Theme }>(
      `/themes/templates/${templateId}/apply`,
      { name },
    );
    return response.data;
  }
}
