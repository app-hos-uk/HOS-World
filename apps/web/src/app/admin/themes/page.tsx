import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export default function AdminThemesPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="container mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold mb-8">Theme Management</h1>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-4">Upload Theme</h2>
            <p className="text-gray-500 mb-4">Upload a new theme ZIP file</p>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <p className="text-gray-500">Theme upload interface coming soon...</p>
            </div>
          </div>
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-4">Active Themes</h2>
            <p className="text-gray-500">Theme list coming soon...</p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

