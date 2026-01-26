'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [impersonatedRole, setImpersonatedRole] = useState<UserRole | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Load impersonated role from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('admin_impersonated_role');
      if (stored) {
        try {
          const role = stored as UserRole;
          // Only set if we don't have a user yet, or if user is admin
          // If user is loaded and not admin, we'll clear it in the next effect
          if (!user || user.role === 'ADMIN') {
            setImpersonatedRole(role);
          }
        } catch (e) {
          // Invalid role stored, clear it
          localStorage.removeItem('admin_impersonated_role');
        }
      }
    }
  }, []); // Run once on mount

  // Clear impersonated role if user is not admin
  useEffect(() => {
    if (user && user.role !== 'ADMIN' && impersonatedRole) {
      localStorage.removeItem('admin_impersonated_role');
      setImpersonatedRole(null);
    }
  }, [user, impersonatedRole]);

  const fetchUser = useCallback(async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      
      if (!token) {
        setUser(null);
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
      } else {
        setUser(null);
        localStorage.removeItem('auth_token');
      }
    } catch (error: any) {
      console.error('Failed to fetch user:', error);
      setUser(null);
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

