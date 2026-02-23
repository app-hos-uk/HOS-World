export default function FulfillmentLoading() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center">
      <div className="w-10 h-10 border-4 border-purple-200 border-t-purple-700 rounded-full animate-spin" />
      <p className="mt-3 text-sm text-gray-500 animate-pulse">Loading...</p>
    </div>
  );
}
