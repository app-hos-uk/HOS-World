import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export default function ProcurementDashboardPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="container mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold mb-8">Procurement Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2">Pending Submissions</h3>
            <p className="text-3xl font-bold">-</p>
          </div>
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2">Duplicate Alerts</h3>
            <p className="text-3xl font-bold text-orange-600">-</p>
          </div>
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2">Under Review</h3>
            <p className="text-3xl font-bold">-</p>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-4">New Submissions</h2>
            <p className="text-gray-500">Submission review queue coming soon...</p>
          </div>
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-4">Duplicate Detection</h2>
            <p className="text-gray-500">Duplicate alerts coming soon...</p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

