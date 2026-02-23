export default function RootLoading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
      <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-700 rounded-full animate-spin" />
      <p className="mt-4 text-purple-700 font-medium font-[family-name:var(--font-lora)] animate-pulse">
        Loading...
      </p>
    </div>
  );
}
