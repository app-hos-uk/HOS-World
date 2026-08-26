'use client';

import { useEffect, useRef } from 'react';

export function BarcodeScanner({
  onScan,
  onClose,
}: {
  onScan: (text: string) => void;
  onClose: () => void;
}) {
  const started = useRef(false);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    let scanner: { stop: () => Promise<void> } | null = null;
    let cancelled = false;

    (async () => {
      const { Html5Qrcode } = await import('html5-qrcode');
      if (cancelled || started.current) return;
      started.current = true;
      const instance = new Html5Qrcode('hos-barcode-reader');
      scanner = instance as unknown as { stop: () => Promise<void> };
      await instance.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (text: string) => {
          if (!text) return;
          onScanRef.current(text.trim());
          instance.stop().catch(() => undefined);
        },
        () => undefined,
      );
    })().catch(() => undefined);

    return () => {
      cancelled = true;
      scanner?.stop().catch(() => undefined);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-hos-bg-secondary rounded-lg p-4 w-full max-w-md space-y-3">
        <p className="text-sm text-hos-text">Point the camera at the receipt barcode</p>
        <div id="hos-barcode-reader" className="overflow-hidden rounded" />
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2 rounded border border-hos-border text-hos-text-secondary"
        >
          Close
        </button>
      </div>
    </div>
  );
}
