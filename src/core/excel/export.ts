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
    applyTextFormatting(worksheet);
    const sheetName = sheet.name || `Sheet${index + 1}`;
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  });

  return XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'array',
    cellStyles: true,
  }) as ArrayBuffer;
}

function normalizeHeaders(headers: string[], rows: unknown[][]): string[] {
  if (headers.length > 0) return headers.map(value => toText(value));

  const maxLength = rows.reduce((max, row) => Math.max(max, row.length), 0);
  return Array.from({ length: maxLength }, (_, i) => `Column_${i + 1}`);
}

function normalizeRows(rows: unknown[][], columnCount: number): string[][] {
  return rows.map(row => {
    const normalized = row.map(value => toText(value));
    while (normalized.length < columnCount) {
      normalized.push('');
    }
    return normalized;
  });
}

function toText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

function applyTextFormatting(worksheet: XLSX.WorkSheet): void {
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
  for (let row = range.s.r; row <= range.e.r; row += 1) {
    for (let col = range.s.c; col <= range.e.c; col += 1) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = worksheet[cellAddress];
      if (!cell) continue;
      cell.t = 's';
      cell.z = '@';
      cell.s = {
        font: {
          name: 'Arial',
          sz: 10,
        },
      };
    }
  }
}
