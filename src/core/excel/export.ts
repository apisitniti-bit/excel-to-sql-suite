import * as XLSX from 'xlsx';
import type { ExcelSheet } from '../types';

export interface ExportWorkbookOptions {
  includeHeaders?: boolean;
}

const DEFAULT_OPTIONS: ExportWorkbookOptions = {
  includeHeaders: true,
};

export function buildWorkbookBuffer(
  sheets: ExcelSheet[],
  options: ExportWorkbookOptions = {}
): ArrayBuffer {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const workbook = XLSX.utils.book_new();

  sheets.forEach((sheet, index) => {
    const headers = normalizeHeaders(sheet.headers, sheet.rows);
    const rows = normalizeRows(sheet.rows, headers.length);
    const data = opts.includeHeaders ? [headers, ...rows] : rows;
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    const sheetName = sheet.name || `Sheet${index + 1}`;
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  });

  return XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
}

function normalizeHeaders(headers: string[], rows: unknown[][]): string[] {
  if (headers.length > 0) return headers;

  const maxLength = rows.reduce((max, row) => Math.max(max, row.length), 0);
  return Array.from({ length: maxLength }, (_, i) => `Column_${i + 1}`);
}

function normalizeRows(rows: unknown[][], columnCount: number): unknown[][] {
  return rows.map(row => {
    const normalized = [...row];
    while (normalized.length < columnCount) {
      normalized.push(null);
    }
    return normalized;
  });
}
