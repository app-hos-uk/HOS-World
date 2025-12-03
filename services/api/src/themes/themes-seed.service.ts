import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class ThemesSeedService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    // Don't block startup - seed in background
    // Return immediately so NestJS doesn't wait
    (async () => {
      try {
        // Check if themes table exists by attempting a simple query
        // If table doesn't exist, Prisma will throw an error
        await this.prisma.$queryRaw`SELECT 1 FROM themes LIMIT 1`.catch(() => {
          throw new Error('Themes table does not exist. Please run database migrations first.');
        });
        
        // Only seed if no themes exist
        const themeCount = await this.prisma.theme.count();
        if (themeCount === 0) {
          await this.seedDefaultThemes();
        }
      } catch (error) {
        // Don't throw - allow app to start even if seeding fails
        // This is expected if migrations haven't been run yet
        if (error.message?.includes('does not exist') || error.message?.includes('table')) {
          console.warn('⚠️ Themes table not found. Skipping theme seeding. Please run database migrations.');
        } else {
          console.warn('⚠️ Theme seeding failed:', error.message);
        }
      }
    })().catch(() => {
      // Ignore errors
    });
    // Return immediately - don't wait for seeding
  }

  async seedDefaultThemes(): Promise<void> {
    // House of Spells Default Theme
    await this.prisma.theme.upsert({
      where: { id: 'hos-default' },
      update: {},
      create: {
        id: 'hos-default',
        name: 'House of Spells Default',
        type: 'HOS',
        config: {
          colors: {
            primary: '#1a1a1a',
            secondary: '#6b7280',
            background: '#ffffff',
            surface: '#f9fafb',
            text: {
              primary: '#111827',
              secondary: '#6b7280',
            },
            accent: '#8b5cf6',
            error: '#ef4444',
            success: '#10b981',
            warning: '#f59e0b',
          },
          typography: {
            fontFamily: {
              primary: '"Inter", system-ui, -apple-system, sans-serif',
              secondary: '"Georgia", serif',
            },
            fontSize: {
              xs: '0.75rem',
              sm: '0.875rem',
              base: '1rem',
              lg: '1.125rem',
              xl: '1.25rem',
              '2xl': '1.5rem',
              '3xl': '1.875rem',
            },
          },
          spacing: {
            xs: '0.25rem',
            sm: '0.5rem',
            md: '1rem',
            lg: '1.5rem',
            xl: '2rem',
            '2xl': '3rem',
            '3xl': '4rem',
          },
          borderRadius: {
            sm: '0.25rem',
            md: '0.5rem',
            lg: '0.75rem',
            xl: '1rem',
            full: '9999px',
          },
          shadows: {
            sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
            md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          },
        },
        isActive: true,
      },
    });

    // Seller Theme Templates
    const templates = [
      {
        id: 'template-minimal',
        name: 'Minimal',
        colors: {
          primary: '#2563eb',
          accent: '#3b82f6',
        },
      },
      {
        id: 'template-modern',
        name: 'Modern',
        colors: {
          primary: '#7c3aed',
          accent: '#8b5cf6',
        },
      },
      {
        id: 'template-classic',
        name: 'Classic',
        colors: {
          primary: '#059669',
          accent: '#10b981',
        },
      },
      {
        id: 'template-bold',
        name: 'Bold',
        colors: {
          primary: '#dc2626',
          accent: '#ef4444',
        },
      },
    ];

    for (const template of templates) {
      const baseConfig = await this.getBaseConfig();
      await this.prisma.theme.upsert({
        where: { id: template.id },
        update: {},
        create: {
          id: template.id,
          name: `Template: ${template.name}`,
          type: 'SELLER',
          sellerId: null, // Templates don't belong to specific sellers
          config: {
            ...baseConfig,
            colors: {
              ...baseConfig.colors,
              ...template.colors,
            },
          },
          isActive: true,
        },
      });
    }
  }

  private async getBaseConfig() {
    const hosTheme = await this.prisma.theme.findUnique({
      where: { id: 'hos-default' },
    });

    if (hosTheme) {
      return hosTheme.config;
    }

    // Fallback config
    return {
      colors: {
        primary: '#1a1a1a',
        secondary: '#6b7280',
        background: '#ffffff',
        surface: '#f9fafb',
        text: {
          primary: '#111827',
          secondary: '#6b7280',
        },
        accent: '#8b5cf6',
        error: '#ef4444',
        success: '#10b981',
        warning: '#f59e0b',
      },
      typography: {
        fontFamily: {
          primary: '"Inter", system-ui, -apple-system, sans-serif',
          secondary: '"Georgia", serif',
        },
        fontSize: {
          xs: '0.75rem',
          sm: '0.875rem',
          base: '1rem',
          lg: '1.125rem',
          xl: '1.25rem',
          '2xl': '1.5rem',
          '3xl': '1.875rem',
        },
      },
      spacing: {
        xs: '0.25rem',
        sm: '0.5rem',
        md: '1rem',
        lg: '1.5rem',
        xl: '2rem',
        '2xl': '3rem',
        '3xl': '4rem',
      },
      borderRadius: {
        sm: '0.25rem',
        md: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
        full: '9999px',
      },
      shadows: {
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      },
    };
  }
}


