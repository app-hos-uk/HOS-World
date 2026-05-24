import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-hos-bg px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <h1 className="text-8xl font-bold text-hos-gold/30 font-[family-name:var(--font-display)]">
          404
        </h1>

        <h2 className="text-2xl font-bold text-hos-gold font-[family-name:var(--font-display)]">
          Page Not Found
        </h2>

        <p className="text-hos-text-secondary font-[family-name:var(--font-body)]">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        <Link
          href="/"
          className="inline-block px-6 py-2.5 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover transition-colors font-medium"
        >
          Go Back to Homepage
        </Link>
      </div>
    </div>
  );
}
