import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export default function AdminDashboardPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="container mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold mb-8">Admin Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2">Total Products</h3>
            <p className="text-3xl font-bold">-</p>
          </div>
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2">Total Orders</h3>
            <p className="text-3xl font-bold">-</p>
          </div>
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2">Total Sellers</h3>
            <p className="text-3xl font-bold">-</p>
          </div>
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2">Total Customers</h3>
            <p className="text-3xl font-bold">-</p>
          </div>
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2">Pending Approvals</h3>
            <p className="text-3xl font-bold">-</p>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-4">Recent Activity</h2>
            <p className="text-gray-500">Activity feed coming soon...</p>
          </div>
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-4">Theme Management</h2>
            <p className="text-gray-500">Theme management coming soon...</p>
          </div>
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-4">Domain Management</h2>
            <p className="text-gray-500">Domain settings coming soon...</p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

