import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export default function SellerDashboardPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="container mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold mb-8">Seller Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2">Total Sales</h3>
            <p className="text-3xl font-bold">$0</p>
          </div>
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2">Total Orders</h3>
            <p className="text-3xl font-bold">0</p>
          </div>
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2">Active Products</h3>
            <p className="text-3xl font-bold">0</p>
          </div>
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2">Pending Approvals</h3>
            <p className="text-3xl font-bold">0</p>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-4">Recent Submissions</h2>
            <p className="text-gray-500">Submission status coming soon...</p>
          </div>
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-4">Theme Settings</h2>
            <p className="text-gray-500">Theme management coming soon...</p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

