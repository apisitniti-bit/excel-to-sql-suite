import { useMemo } from 'react';
import { FileSpreadsheet, Table, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ExcelData } from '@/types/converter';
import { useState } from 'react';

interface DataPreviewProps {
  data: ExcelData;
}

const PAGE_SIZE = 50;

export function DataPreview({ data }: DataPreviewProps) {
  const [page, setPage] = useState(0);
  
  // Defensive checks
  if (!data) {
    console.error('[DataPreview] No data provided');
    return (
      <div className="panel h-full flex flex-col">
        <div className="panel-header">
          <span className="text-red-500">Error: No data available</span>
        </div>
      </div>
    );
  }
  
  if (!data.headers || data.headers.length === 0) {
    console.error('[DataPreview] No headers in data');
    return (
      <div className="panel h-full flex flex-col">
        <div className="panel-header">
          <span className="text-red-500">Error: No columns found</span>
        </div>
      </div>
    );
  }
  
  const totalPages = Math.ceil((data.rows?.length || 0) / PAGE_SIZE);
  const startRow = page * PAGE_SIZE;
  const endRow = Math.min(startRow + PAGE_SIZE, data.rows?.length || 0);
  const visibleRows = data.rows?.slice(startRow, endRow) || [];

  console.log('[DataPreview] Rendering:', {
    headers: data.headers.length,
    rows: data.rows?.length || 0,
    page,
    visibleRows: visibleRows.length
  });

  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header justify-between">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-primary" />
          <span>Excel Preview</span>
          <Badge variant="secondary" className="font-mono text-xs">
            {data.fileName}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Table className="w-3 h-3" />
          <span>{data.totalRows.toLocaleString()} rows</span>
          <span>•</span>
          <span>{data.headers.length} columns</span>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto scrollbar-thin">
        <table className="data-grid w-full border-collapse">
          <thead>
            <tr className="data-header">
              <th className="data-cell text-left w-12 text-muted-foreground">#</th>
              {data.headers.map((header, i) => (
                <th key={i} className="data-cell text-left" title={header}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-muted/50 transition-colors">
                <td className="data-cell text-muted-foreground">
                  {startRow + rowIndex + 1}
                </td>
                {data.headers.map((_, colIndex) => (
                  <td 
                    key={colIndex} 
                    className="data-cell"
                    title={row[colIndex] != null ? String(row[colIndex]) : ''}
                  >
                    {row[colIndex] != null ? String(row[colIndex]) : (
                      <span className="text-muted-foreground/50 italic">null</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {totalPages > 1 && (
        <div className="border-t p-2 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Showing {startRow + 1}-{endRow} of {data.rows.length}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs px-2">
              {page + 1} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => p + 1)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
