import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export default function FulfillmentDashboardPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-6 sm:mb-6 sm:mb-8">Fulfillment Center Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 sm:p-6 mb-6 sm:mb-8">
          <div className="bg-white border rounded-lg p-4 sm:p-6">
            <h3 className="text-sm sm:text-base lg:text-lg font-semibold mb-2">Incoming Shipments</h3>
            <p className="text-2xl sm:text-3xl font-bold">-</p>
          </div>
          <div className="bg-white border rounded-lg p-4 sm:p-6">
            <h3 className="text-sm sm:text-base lg:text-lg font-semibold mb-2">Pending Verification</h3>
            <p className="text-2xl sm:text-3xl font-bold">-</p>
          </div>
          <div className="bg-white border rounded-lg p-4 sm:p-6">
            <h3 className="text-sm sm:text-base lg:text-lg font-semibold mb-2">Verified</h3>
            <p className="text-2xl sm:text-3xl font-bold text-green-600">-</p>
          </div>
          <div className="bg-white border rounded-lg p-4 sm:p-6">
            <h3 className="text-sm sm:text-base lg:text-lg font-semibold mb-2">Rejected</h3>
            <p className="text-2xl sm:text-3xl font-bold text-red-600">-</p>
          </div>
        </div>
        <div className="bg-white border rounded-lg p-4 sm:p-6">
          <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">Shipment Queue</h2>
          <p className="text-gray-500">Shipment verification interface coming soon...</p>
        </div>
      </main>
      <Footer />
    </div>
  );
}

