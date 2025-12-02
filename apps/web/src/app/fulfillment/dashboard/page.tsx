import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export default function FulfillmentDashboardPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="container mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold mb-8">Fulfillment Center Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2">Incoming Shipments</h3>
            <p className="text-3xl font-bold">-</p>
          </div>
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2">Pending Verification</h3>
            <p className="text-3xl font-bold">-</p>
          </div>
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2">Verified</h3>
            <p className="text-3xl font-bold text-green-600">-</p>
          </div>
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2">Rejected</h3>
            <p className="text-3xl font-bold text-red-600">-</p>
          </div>
        </div>
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-2xl font-semibold mb-4">Shipment Queue</h2>
          <p className="text-gray-500">Shipment verification interface coming soon...</p>
        </div>
      </main>
      <Footer />
    </div>
  );
}

