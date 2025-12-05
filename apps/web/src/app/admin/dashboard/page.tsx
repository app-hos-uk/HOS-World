import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export default function AdminDashboardPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-6 sm:mb-6 sm:mb-8">Admin Dashboard</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-4 sm:p-6 mb-6 sm:mb-6 sm:mb-8">
          <div className="bg-white border rounded-lg p-4 sm:p-4 sm:p-6">
            <h3 className="text-sm sm:text-base lg:text-sm sm:text-base lg:text-lg font-semibold mb-2">Total Products</h3>
            <p className="text-2xl sm:text-2xl sm:text-3xl font-bold">-</p>
          </div>
          <div className="bg-white border rounded-lg p-4 sm:p-4 sm:p-6">
            <h3 className="text-sm sm:text-base lg:text-sm sm:text-base lg:text-lg font-semibold mb-2">Total Orders</h3>
            <p className="text-2xl sm:text-2xl sm:text-3xl font-bold">-</p>
          </div>
          <div className="bg-white border rounded-lg p-4 sm:p-4 sm:p-6">
            <h3 className="text-sm sm:text-base lg:text-sm sm:text-base lg:text-lg font-semibold mb-2">Total Sellers</h3>
            <p className="text-2xl sm:text-2xl sm:text-3xl font-bold">-</p>
          </div>
          <div className="bg-white border rounded-lg p-4 sm:p-4 sm:p-6">
            <h3 className="text-sm sm:text-base lg:text-sm sm:text-base lg:text-lg font-semibold mb-2">Total Customers</h3>
            <p className="text-2xl sm:text-2xl sm:text-3xl font-bold">-</p>
          </div>
          <div className="bg-white border rounded-lg p-4 sm:p-4 sm:p-6">
            <h3 className="text-sm sm:text-base lg:text-sm sm:text-base lg:text-lg font-semibold mb-2">Pending Approvals</h3>
            <p className="text-2xl sm:text-2xl sm:text-3xl font-bold">-</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-4 sm:p-6">
          <div className="bg-white border rounded-lg p-4 sm:p-4 sm:p-6">
            <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">Recent Activity</h2>
            <p className="text-sm sm:text-base text-gray-500">Activity feed coming soon...</p>
          </div>
          <div className="bg-white border rounded-lg p-4 sm:p-4 sm:p-6">
            <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">Theme Management</h2>
            <p className="text-sm sm:text-base text-gray-500">Theme management coming soon...</p>
          </div>
          <div className="bg-white border rounded-lg p-4 sm:p-4 sm:p-6 md:col-span-2 lg:col-span-1">
            <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">Domain Management</h2>
            <p className="text-sm sm:text-base text-gray-500">Domain settings coming soon...</p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

