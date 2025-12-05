import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export default function SellerDashboardPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-6 sm:mb-6 sm:mb-8">Seller Dashboard</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-4 sm:p-6 mb-6 sm:mb-6 sm:mb-8">
          <div className="bg-white border rounded-lg p-4 sm:p-4 sm:p-6">
            <h3 className="text-sm sm:text-base lg:text-sm sm:text-base lg:text-lg font-semibold mb-2">Total Sales</h3>
            <p className="text-2xl sm:text-2xl sm:text-3xl font-bold">$0</p>
          </div>
          <div className="bg-white border rounded-lg p-4 sm:p-4 sm:p-6">
            <h3 className="text-sm sm:text-base lg:text-sm sm:text-base lg:text-lg font-semibold mb-2">Total Orders</h3>
            <p className="text-2xl sm:text-2xl sm:text-3xl font-bold">0</p>
          </div>
          <div className="bg-white border rounded-lg p-4 sm:p-4 sm:p-6">
            <h3 className="text-sm sm:text-base lg:text-sm sm:text-base lg:text-lg font-semibold mb-2">Active Products</h3>
            <p className="text-2xl sm:text-2xl sm:text-3xl font-bold">0</p>
          </div>
          <div className="bg-white border rounded-lg p-4 sm:p-4 sm:p-6">
            <h3 className="text-sm sm:text-base lg:text-sm sm:text-base lg:text-lg font-semibold mb-2">Pending Approvals</h3>
            <p className="text-2xl sm:text-2xl sm:text-3xl font-bold">0</p>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-4 sm:p-6">
          <div className="bg-white border rounded-lg p-4 sm:p-4 sm:p-6">
            <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">Recent Submissions</h2>
            <p className="text-sm sm:text-base text-gray-500">Submission status coming soon...</p>
          </div>
          <div className="bg-white border rounded-lg p-4 sm:p-4 sm:p-6">
            <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">Theme Settings</h2>
            <p className="text-sm sm:text-base text-gray-500">Theme management coming soon...</p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

