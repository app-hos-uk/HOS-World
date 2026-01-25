'use client';

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  showHeader?: boolean;
  className?: string;
}

export function TableSkeleton({ 
  rows = 5, 
  columns = 5, 
  showHeader = true,
  className = '' 
}: TableSkeletonProps) {
  return (
    <div className={`bg-white rounded-lg shadow overflow-hidden ${className}`}>
      <div className="animate-pulse">
        {showHeader && (
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <div className="h-5 bg-gray-200 rounded w-1/4"></div>
          </div>
        )}
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {Array.from({ length: columns }).map((_, i) => (
                <th key={i} className="px-6 py-3">
                  <div className="h-4 bg-gray-200 rounded w-20"></div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <tr key={rowIndex}>
                {Array.from({ length: columns }).map((_, colIndex) => (
                  <td key={colIndex} className="px-6 py-4 whitespace-nowrap">
                    <div 
                      className={`h-4 bg-gray-200 rounded ${
                        colIndex === 0 ? 'w-32' : colIndex === columns - 1 ? 'w-16' : 'w-24'
                      }`}
                    ></div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface CardSkeletonProps {
  className?: string;
}

export function CardSkeleton({ className = '' }: CardSkeletonProps) {
  return (
    <div className={`bg-white rounded-lg shadow p-6 animate-pulse ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="h-4 bg-gray-200 rounded w-24"></div>
        <div className="h-8 w-8 bg-gray-200 rounded-full"></div>
      </div>
      <div className="h-8 bg-gray-200 rounded w-16 mb-2"></div>
      <div className="h-3 bg-gray-200 rounded w-20"></div>
    </div>
  );
}

interface StatsGridSkeletonProps {
  count?: number;
  columns?: number;
  className?: string;
}

export function StatsGridSkeleton({ 
  count = 4, 
  columns = 4,
  className = '' 
}: StatsGridSkeletonProps) {
  const gridCols = {
    2: 'grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-4',
    5: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5',
    6: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6',
  };

  return (
    <div className={`grid ${gridCols[columns as keyof typeof gridCols] || 'grid-cols-4'} gap-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

interface ChartSkeletonProps {
  height?: number;
  className?: string;
}

export function ChartSkeleton({ height = 256, className = '' }: ChartSkeletonProps) {
  return (
    <div className={`bg-white rounded-lg shadow p-6 animate-pulse ${className}`}>
      <div className="h-5 bg-gray-200 rounded w-32 mb-4"></div>
      <div 
        className="bg-gray-100 rounded flex items-end justify-around px-4"
        style={{ height: `${height}px` }}
      >
        {Array.from({ length: 7 }).map((_, i) => (
          <div 
            key={i} 
            className="bg-gray-200 rounded-t w-8"
            style={{ height: `${30 + Math.random() * 70}%` }}
          ></div>
        ))}
      </div>
    </div>
  );
}

interface PageSkeletonProps {
  showTitle?: boolean;
  showStats?: boolean;
  statsCount?: number;
  showChart?: boolean;
  showTable?: boolean;
  tableRows?: number;
  tableColumns?: number;
  className?: string;
}

export function PageSkeleton({
  showTitle = true,
  showStats = true,
  statsCount = 4,
  showChart = false,
  showTable = true,
  tableRows = 5,
  tableColumns = 5,
  className = '',
}: PageSkeletonProps) {
  return (
    <div className={`space-y-6 ${className}`}>
      {showTitle && (
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-64"></div>
        </div>
      )}
      
      {showStats && <StatsGridSkeleton count={statsCount} />}
      
      {showChart && <ChartSkeleton />}
      
      {showTable && <TableSkeleton rows={tableRows} columns={tableColumns} />}
    </div>
  );
}

interface ListSkeletonProps {
  items?: number;
  showAvatar?: boolean;
  className?: string;
}

export function ListSkeleton({ 
  items = 5, 
  showAvatar = true,
  className = '' 
}: ListSkeletonProps) {
  return (
    <div className={`bg-white rounded-lg shadow divide-y divide-gray-200 ${className}`}>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="p-4 animate-pulse">
          <div className="flex items-center gap-4">
            {showAvatar && (
              <div className="h-10 w-10 bg-gray-200 rounded-full flex-shrink-0"></div>
            )}
            <div className="flex-1">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
            <div className="h-6 bg-gray-200 rounded w-16"></div>
          </div>
        </div>
      ))}
    </div>
  );
}
