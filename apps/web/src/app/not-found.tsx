import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-white px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <h1 className="text-8xl font-bold text-purple-200 font-[family-name:var(--font-cinzel)]">
          404
        </h1>

        <h2 className="text-2xl font-bold text-purple-900 font-[family-name:var(--font-cinzel)]">
          Page Not Found
        </h2>

        <p className="text-gray-600 font-[family-name:var(--font-lora)]">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        <Link
          href="/"
          className="inline-block px-6 py-2.5 bg-purple-700 text-white rounded-lg hover:bg-purple-800 transition-colors font-medium"
        >
          Go Back to Homepage
        </Link>
      </div>
    </div>
  );
}
