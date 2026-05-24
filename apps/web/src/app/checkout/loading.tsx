export default function CheckoutLoading() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center">
      <div className="w-10 h-10 border-4 border-hos-border-accent border-t-hos-gold rounded-full animate-spin" />
      <p className="mt-3 text-sm text-hos-text-muted animate-pulse">
        Preparing checkout...
      </p>
    </div>
  );
}
