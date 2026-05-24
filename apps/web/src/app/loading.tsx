export default function RootLoading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-hos-bg">
      <div className="w-12 h-12 border-4 border-hos-border border-t-hos-gold rounded-full animate-spin" />
      <p className="mt-4 text-hos-gold-hover font-medium font-[family-name:var(--font-body)] animate-pulse">
        Loading...
      </p>
    </div>
  );
}
