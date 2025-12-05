'use client';

import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { RouteGuard } from '@/components/RouteGuard';

export default function AdminSettingsPage() {
  return (
    <RouteGuard allowedRoles={['ADMIN']} showAccessDenied={true}>
      <div className="min-h-screen bg-white">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">System Settings</h1>
            <a
              href="/admin/dashboard"
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium text-sm sm:text-base whitespace-nowrap"
            >
              Back to Dashboard
            </a>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-8">
            <p className="text-gray-500 text-center">Settings page coming soon...</p>
            <p className="text-sm text-gray-400 text-center mt-2">
              This page will include system configuration, email templates, and notification settings.
            </p>
          </div>
        </main>
        <Footer />
      </div>
    </RouteGuard>
  );
}

