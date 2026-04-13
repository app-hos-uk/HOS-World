'use client';

import { useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

interface VirtualizedTableBodyProps {
  items: any[];
  renderRow: (item: any, index: number) => React.ReactNode;
  estimateSize?: number;
  overscan?: number;
  /** Ref to the scrollable parent (required when items > 50). Wrap table in div with overflow-auto and max-height. */
  scrollRef?: React.RefObject<HTMLElement | null>;
  /** Optional class name for each row. Receives (item, index). */
  getRowClassName?: (item: any, index: number) => string;
}

/**
 * Virtualized table body for large lists (>50 items).
 * Wrap the table in a div with overflow-auto and max-height (e.g. max-h-[500px]), then pass its ref as scrollRef.
 */
export function VirtualizedTableBody({
  items,
  renderRow,
  estimateSize = 52,
  overscan = 5,
  scrollRef,
  getRowClassName,
}: VirtualizedTableBodyProps) {
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef?.current ?? null,
    estimateSize: () => estimateSize,
    overscan,
  });

  // Keep a stable ref to virtualizer.measure so the effect below doesn't
  // re-fire on every render (useVirtualizer returns a new object each time).
  const measureRef = useRef(virtualizer.measure);
  measureRef.current = virtualizer.measure;

  // Force re-measure after the scroll container mounts or items change.
  // Without this, the virtualizer may initialize before the container is laid out,
  // seeing height 0 and rendering zero rows.
  useEffect(() => {
    if (items.length > 50) {
      const frame = requestAnimationFrame(() => measureRef.current());
      return () => cancelAnimationFrame(frame);
    }
  }, [items.length]);

  if (items.length <= 50) {
    return (
      <tbody>
        {items.map((item, index) => (
          <tr key={(item as { id?: string }).id ?? index} className={getRowClassName?.(item, index)}>
            {renderRow(item, index)}
          </tr>
        ))}
      </tbody>
    );
  }

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  return (
    <tbody
      style={{
        height: `${totalSize}px`,
        position: 'relative',
      }}
    >
      {virtualItems.map((virtualRow) => {
        const item = items[virtualRow.index];
        return (
          <tr
            key={virtualRow.key}
            data-index={virtualRow.index}
            ref={virtualizer.measureElement}
            className={getRowClassName?.(item, virtualRow.index)}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            {renderRow(item, virtualRow.index)}
          </tr>
        );
      })}
    </tbody>
  );
}
