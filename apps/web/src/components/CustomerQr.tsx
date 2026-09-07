'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

type Props = {
  value: string;
  size?: number;
  className?: string;
  /** Accessible label for the QR image. */
  alt?: string;
  /** When false, hide the payload text/link under the code (loyalty cards use JSON, not URLs). */
  showValue?: boolean;
};

/**
 * Renders a customer lookup QR as a data URL so the till does not depend on
 * api.qrserver.com (blocked by the app Content-Security-Policy img-src list).
 */
export function CustomerQr({
  value,
  size = 180,
  className,
  alt = 'Customer QR',
  showValue = true,
}: Props) {
  const [src, setSrc] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!value) {
      setSrc('');
      setFailed(false);
      return;
    }
    let cancelled = false;
    setFailed(false);
    QRCode.toString(value, { type: 'svg', width: size, margin: 1, errorCorrectionLevel: 'M' })
      .then((svg) => {
        if (!cancelled) {
          setSrc(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
        }
      })
      .catch((err) => {
        console.error('CustomerQr encode failed', err);
        if (!cancelled) {
          setSrc('');
          setFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (!value) return null;

  const isHttpUrl = /^https?:\/\//i.test(value);

  return (
    <div className={className ?? 'flex flex-col items-end gap-1'}>
      {src ? (
        <img
          alt={alt}
          className="bg-white p-2 rounded"
          src={src}
          width={size}
          height={size}
        />
      ) : (
        <div
          className="bg-white/10 rounded flex items-center justify-center text-xs text-hos-text-muted"
          style={{ width: size, height: size }}
          aria-hidden={!failed}
        >
          {failed ? 'QR unavailable' : ''}
        </div>
      )}
      {showValue && isHttpUrl ? (
        <a
          href={value}
          target="_blank"
          rel="noreferrer"
          className="text-[10px] text-hos-text-muted underline break-all max-w-[10rem] text-right"
        >
          {value}
        </a>
      ) : showValue ? (
        <p className="text-[10px] text-hos-text-muted break-all max-w-[10rem] text-right">{value}</p>
      ) : null}
    </div>
  );
}
