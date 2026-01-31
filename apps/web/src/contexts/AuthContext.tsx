'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import type { User, UserRole } from '@hos-marketplace/shared-types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  hasRole: (role: UserRole | UserRole[]) => boolean;
  hasAnyRole: (roles: UserRole[]) => boolean;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
  // Role switching (admin only)
  impersonatedRole: UserRole | null;
  switchRole: (role: UserRole | null) => void;
  effectiveRole: UserRole | null; // Returns impersonated role if set, otherwise user role
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const VALID_USER_ROLES: UserRole[] = [
  'CUSTOMER', 'WHOLESALER', 'B2C_SELLER', 'SELLER', 'ADMIN', 'INFLUENCER',
  'PROCUREMENT', 'FULFILLMENT', 'CATALOG', 'MARKETING', 'FINANCE', 'CMS_EDITOR',
];

function isValidUserRole(value: string): value is UserRole {
  return VALID_USER_ROLES.includes(value as UserRole);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [impersonatedRole, setImpersonatedRole] = useState<UserRole | null>(null);
  const router = useRouter();

  // Clear impersonated role if user is not admin (e.g. after login as non-admin)
  useEffect(() => {
    if (user && user.role !== 'ADMIN' && impersonatedRole) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('admin_impersonated_role');
      }
      setImpersonatedRole(null);
    }
  }, [user, impersonatedRole]);

  const fetchUser = useCallback(async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      
      if (!token) {
        setUser(null);
        setImpersonatedRole(null);
        setLoading(false);
        return;
      }

      const response = await apiClient.getCurrentUser();
      
      if (response?.data) {
        // Normalize role to uppercase to match backend
        const normalizedUser = {
          ...response.data,
          role: response.data.role?.toUpperCase() as UserRole,
        };
        setUser(normalizedUser);
        // Only restore impersonated role from localStorage for ADMIN users.
        // This prevents wholesalers/sellers from inheriting a stale admin_impersonated_role
        // (e.g. from a previous admin session) which caused random "access denied" on sidebar nav.
        if (normalizedUser.role === 'ADMIN' && typeof window !== 'undefined') {
          const stored = localStorage.getItem('admin_impersonated_role');
          if (stored && isValidUserRole(stored)) {
            setImpersonatedRole(stored as UserRole);
          } else if (stored) {
            localStorage.removeItem('admin_impersonated_role');
          }
        } else {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('admin_impersonated_role');
          }
          setImpersonatedRole(null);
        }
      } else {
        setUser(null);
        setImpersonatedRole(null);
        localStorage.removeItem('auth_token');
      }
    } catch (error: any) {
      console.error('Failed to fetch user:', error);
      setUser(null);
      setImpersonatedRole(null);
      localStorage.removeItem('auth_token');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();

    // Listen for storage changes (login/logout in other tabs)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'auth_token') {
        fetchUser();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [fetchUser]);

  // Get effective role (impersonated if set, otherwise actual user role)
  const effectiveRole = impersonatedRole || user?.role || null;

  const hasRole = useCallback((role: UserRole | UserRole[]): boolean => {
    if (!user) return false;
    
    const currentRole = impersonatedRole || user.role;
    
    if (Array.isArray(role)) {
      return role.includes(currentRole);
    }
    
    return currentRole === role;
  }, [user, impersonatedRole]);

  const hasAnyRole = useCallback((roles: UserRole[]): boolean => {
    if (!user) return false;
    const currentRole = impersonatedRole || user.role;
    return roles.includes(currentRole);
  }, [user, impersonatedRole]);

  const switchRole = useCallback((role: UserRole | null) => {
    setImpersonatedRole(role);
    if (typeof window !== 'undefined') {
      if (role) {
        localStorage.setItem('admin_impersonated_role', role);
      } else {
        localStorage.removeItem('admin_impersonated_role');
      }
    }
    // Force a re-render by updating pathname (will cause RouteGuard to re-evaluate)
    if (role) {
      router.refresh();
    }
  }, [router]);

  const refreshUser = useCallback(async () => {
    await fetchUser();
  }, [fetchUser]);

  const logout = useCallback(async () => {
    try {
      await apiClient.logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
    localStorage.removeItem('auth_token');
    localStorage.removeItem('admin_impersonated_role');
    setUser(null);
    setImpersonatedRole(null);
    router.push('/login');
  }, [router]);

  const value: AuthContextType = {
    user,
    loading,
    isAuthenticated: !!user,
    hasRole,
    hasAnyRole,
    refreshUser,
    logout,
    impersonatedRole,
    switchRole,
    effectiveRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

