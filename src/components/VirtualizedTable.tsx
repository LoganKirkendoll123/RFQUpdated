import React, { useState, useEffect, useMemo, useRef } from 'react';
import { calculateVisibleItems } from '../utils/performance';

interface VirtualizedTableProps<T> {
  data: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
}

export function VirtualizedTable<T>({
  data,
  itemHeight,
  containerHeight,
  renderItem,
  className = ''
}: VirtualizedTableProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const { startIndex, endIndex } = useMemo(
    () => calculateVisibleItems(scrollTop, containerHeight, itemHeight, data.length),
    [scrollTop, containerHeight, itemHeight, data.length]
  );

  const visibleItems = useMemo(
    () => data.slice(startIndex, endIndex + 1),
    [data, startIndex, endIndex]
  );

  const totalHeight = data.length * itemHeight;
  const offsetY = startIndex * itemHeight;

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  return (
    <div
      ref={containerRef}
      className={`overflow-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, index) => (
            <div key={startIndex + index} style={{ height: itemHeight }}>
              {renderItem(item, startIndex + index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}