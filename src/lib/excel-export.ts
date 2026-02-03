import { buildWorkbookBuffer } from '@/core/excel/export';
import type { ExcelSheet } from '@/core/types';

export interface ExportExcelOptions {
  fileName: string;
  includeHeaders?: boolean;
}

export function downloadExcel(sheets: ExcelSheet[], options: ExportExcelOptions): void {
  const buffer = buildWorkbookBuffer(sheets, { includeHeaders: options.includeHeaders });
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = options.fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
