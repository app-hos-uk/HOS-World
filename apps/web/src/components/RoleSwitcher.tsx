'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import type { UserRole } from '@hos-marketplace/shared-types';

const AVAILABLE_ROLES: UserRole[] = [
  'CUSTOMER',
  'WHOLESALER',
  'B2C_SELLER',
  'SELLER',
  'PROCUREMENT',
  'FULFILLMENT',
  'CATALOG',
  'MARKETING',
  'FINANCE',
  'CMS_EDITOR',
];

const ROLE_LABELS: Record<UserRole, string> = {
  CUSTOMER: 'Customer',
  WHOLESALER: 'Wholesaler',
  B2C_SELLER: 'B2C Seller',
  SELLER: 'Seller',
  ADMIN: 'Admin',
  PROCUREMENT: 'Procurement',
  FULFILLMENT: 'Fulfillment',
  CATALOG: 'Catalog',
  MARKETING: 'Marketing',
  FINANCE: 'Finance',
  CMS_EDITOR: 'CMS Editor',
};

const ROLE_DASHBOARD_MAP: Record<UserRole, string> = {
  CUSTOMER: '/',
  WHOLESALER: '/wholesaler/dashboard',
  B2C_SELLER: '/seller/dashboard',
  SELLER: '/seller/dashboard',
  ADMIN: '/admin/dashboard',
  PROCUREMENT: '/procurement/dashboard',
  FULFILLMENT: '/fulfillment/dashboard',
  CATALOG: '/catalog/dashboard',
  MARKETING: '/marketing/dashboard',
  FINANCE: '/finance/dashboard',
  CMS_EDITOR: '/cms/dashboard',
};

export function RoleSwitcher() {
  const { user, impersonatedRole, switchRole, effectiveRole, loading } = useAuth();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  // Debug logging to help troubleshoot
  useEffect(() => {
    if (typeof window !== 'undefined') {
      console.log('[RoleSwitcher] Debug Info:', {
        hasUser: !!user,
        userRole: user?.role,
        isAdmin: user?.role === 'ADMIN',
        loading,
        impersonatedRole,
        effectiveRole,
      });
    }
  }, [user, loading, impersonatedRole, effectiveRole]);

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="px-4 py-2 bg-gray-200 text-gray-500 rounded-lg text-sm">
        Loading...
      </div>
    );
  }

  // Only show for admin users - check actual user role, not effective role
  // This allows admins to see the switcher even when impersonating
  // Normalize role to uppercase to handle any case variations
  const normalizedRole = user?.role?.toUpperCase();
  const isActualAdmin = normalizedRole === 'ADMIN';
  
  if (!user) {
    // User not loaded yet - don't show anything
    return null;
  }
  
  if (!isActualAdmin) {
    // User is not an admin - log for debugging
    console.warn('[RoleSwitcher] Not showing - User is not ADMIN. Current role:', user.role, 'Normalized:', normalizedRole, 'User:', user);
    return null;
  }

  const handleRoleSwitch = (role: UserRole | null) => {
    switchRole(role);
    setIsOpen(false);
    
    // Navigate to the appropriate dashboard for the selected role
    if (role) {
      const dashboardPath = ROLE_DASHBOARD_MAP[role] || '/admin/dashboard';
      router.push(dashboardPath);
      // Force a refresh to apply route guard changes
      setTimeout(() => {
        router.refresh();
      }, 100);
    } else {
      // Reset to admin dashboard
      router.push('/admin/dashboard');
      setTimeout(() => {
        router.refresh();
      }, 100);
    }
  };

  const handleBackToAdmin = () => {
    handleRoleSwitch(null);
  };

  const currentEffectiveRole = effectiveRole || user.role;
  const isImpersonating = !!impersonatedRole;

  return (
    <div className="relative flex items-center gap-2">
      {/* Back to Admin button - Show when impersonating */}
      {isImpersonating && (
        <button
          onClick={handleBackToAdmin}
          className="px-3 py-2 text-sm bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white font-semibold rounded-lg transition-all duration-300 flex items-center gap-1.5"
          title="Return to Admin Dashboard"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Back to Admin
        </button>
      )}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          px-4 py-2 rounded-lg font-medium text-sm transition-colors
          ${isImpersonating
            ? 'bg-amber-500 text-white hover:bg-amber-600 border-2 border-amber-600'
            : 'bg-purple-600 text-white hover:bg-purple-700'
          }
        `}
        title={isImpersonating ? `Viewing as: ${ROLE_LABELS[impersonatedRole!]}` : 'Switch Role (Admin)'}
      >
        {isImpersonating ? (
          <span className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 bg-white rounded-full animate-pulse"></span>
            Viewing as: {ROLE_LABELS[impersonatedRole!]}
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            Switch Role
          </span>
        )}
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown Menu */}
          <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border-2 border-purple-200 z-20 max-h-96 overflow-y-auto">
            <div className="p-2">
              {/* Header */}
              <div className="px-3 py-2 border-b border-gray-200">
                <p className="text-sm font-semibold text-gray-700">Switch Role</p>
                <p className="text-xs text-gray-500 mt-1">
                  View the platform as another role
                </p>
              </div>

              {/* Reset Option */}
              {isImpersonating && (
                <button
                  onClick={() => handleRoleSwitch(null)}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-purple-50 rounded-lg transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Reset to Admin
                </button>
              )}

              {/* Role Options */}
              <div className="py-1">
                {AVAILABLE_ROLES.map((role) => {
                  const isActive = impersonatedRole === role;
                  return (
                    <button
                      key={role}
                      onClick={() => handleRoleSwitch(role)}
                      className={`
                        w-full text-left px-3 py-2 text-sm rounded-lg transition-colors flex items-center justify-between
                        ${isActive
                          ? 'bg-amber-100 text-amber-900 font-semibold'
                          : 'text-gray-700 hover:bg-purple-50'
                        }
                      `}
                    >
                      <span>{ROLE_LABELS[role]}</span>
                      {isActive && (
                        <span className="inline-block w-2 h-2 bg-amber-600 rounded-full"></span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Info Footer */}
              <div className="px-3 py-2 border-t border-gray-200 mt-1">
                <p className="text-xs text-gray-500">
                  {isImpersonating
                    ? `You are viewing as ${ROLE_LABELS[impersonatedRole!]}. Your admin permissions are preserved.`
                    : 'Select a role to view the platform from that perspective.'
                  }
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

