/**
 * Multi-Sheet Excel Parser
 * Parses all sheets for cross-sheet VLOOKUP support
 */

import * as XLSX from 'xlsx';
import type { ExcelSheet, ParsedExcelFile } from '../types';
import type { MultiSheetContext } from '../types/vlookup';

export interface MultiSheetParseOptions {
  /** Parse all sheets (needed for cross-sheet lookups) */
  parseAllSheets?: boolean;
  /** Max rows per sheet (safety limit) */
  maxRows?: number;
  /** Header row index (0-based) */
  headerRow?: number;
  /** Specific sheet to use as primary (defaults to first) */
  primarySheet?: string;
}

const DEFAULT_OPTIONS: MultiSheetParseOptions = {
  parseAllSheets: false,
  maxRows: 100000,
  headerRow: 0,
};

/**
 * Parse Excel file with multi-sheet support
 */
export async function parseMultiSheet(
  file: File | ArrayBuffer,
  options: MultiSheetParseOptions = {}
): Promise<ParsedExcelFile & { context?: MultiSheetContext }> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  const arrayBuffer = file instanceof File 
    ? await fileToArrayBuffer(file)
    : file;
  
  const workbook = XLSX.read(arrayBuffer, { 
    type: 'array',
    cellFormula: false,
    cellHTML: false,
    cellNF: false,
  });

  if (workbook.SheetNames.length === 0) {
    throw new Error('Excel file contains no sheets');
  }

  // Determine primary sheet
  const primarySheetName = opts.primarySheet && workbook.SheetNames.includes(opts.primarySheet)
    ? opts.primarySheet
    : workbook.SheetNames[0];

  // Parse sheets based on options
  const sheets: ExcelSheet[] = [];
  const sheetMap = new Map<string, ExcelSheet>();

  for (const sheetName of workbook.SheetNames) {
    // Only parse data if: it's primary sheet, or we're parsing all sheets
    const shouldParseData = sheetName === primarySheetName || opts.parseAllSheets;
    
    const worksheet = workbook.Sheets[sheetName];
    
    if (shouldParseData) {
      const sheet = parseWorksheet(worksheet, sheetName, opts);
      sheets.push(sheet);
      sheetMap.set(sheetName, sheet);
    } else {
      // Parse just headers for non-primary sheets (for reference)
      const sheet = parseHeadersOnly(worksheet, sheetName, opts);
      sheets.push(sheet);
      sheetMap.set(sheetName, sheet);
    }
  }

  const fileName = file instanceof File ? file.name : 'untitled.xlsx';

  // Build context only if we have multiple sheets or might need lookups
  const context: MultiSheetContext | undefined = 
    sheets.length > 1 || opts.parseAllSheets
      ? createMultiSheetContext(sheetMap, primarySheetName)
      : undefined;

  return {
    fileName,
    sheets,
    activeSheet: primarySheetName,
    context,
  };
}

/**
 * Build MultiSheetContext from parsed sheets (public)
 */
export function buildContextFromSheets(
  sheets: ExcelSheet[],
  primarySheet: string
): MultiSheetContext {
  const sheetMap = new Map<string, ExcelSheet>();
  for (const sheet of sheets) {
    sheetMap.set(sheet.name, sheet);
  }
  return createMultiSheetContext(sheetMap, primarySheet);
}

/**
 * Parse a worksheet into ExcelSheet with full data
 */
function parseWorksheet(
  worksheet: XLSX.WorkSheet,
  sheetName: string,
  opts: MultiSheetParseOptions
): ExcelSheet {
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
    header: 1,
    defval: null,
    blankrows: false,
  }) as unknown[][];

  if (jsonData.length === 0) {
    return {
      name: sheetName,
      rowCount: 0,
      headers: [],
      rows: [],
    };
  }

  const headers = extractHeaders(jsonData[opts.headerRow!] || []);
  const dataRows = jsonData.slice(opts.headerRow! + 1, opts.headerRow! + 1 + opts.maxRows!);

  return {
    name: sheetName,
    rowCount: dataRows.length,
    headers,
    rows: dataRows,
  };
}

/**
 * Parse only headers from a worksheet (for reference sheets)
 */
function parseHeadersOnly(
  worksheet: XLSX.WorkSheet,
  sheetName: string,
  opts: MultiSheetParseOptions
): ExcelSheet {
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
    header: 1,
    defval: null,
    blankrows: false,
  }) as unknown[][];

  if (jsonData.length === 0) {
    return {
      name: sheetName,
      rowCount: 0,
      headers: [],
      rows: [],
    };
  }

  const headers = extractHeaders(jsonData[opts.headerRow!] || []);

  return {
    name: sheetName,
    rowCount: Math.max(0, jsonData.length - opts.headerRow! - 1),
    headers,
    rows: [], // Empty - not parsed to save memory
  };
}

/**
 * Extract headers from raw row data
 */
function extractHeaders(headerRow: unknown[]): string[] {
  return headerRow.map((h, i) => {
    if (h === null || h === undefined) {
      return `Column_${i + 1}`;
    }
    return String(h).trim();
  });
}

/**
 * Create MultiSheetContext from parsed sheets
 */
function createMultiSheetContext(
  sheetMap: Map<string, ExcelSheet>,
  primarySheet: string
): MultiSheetContext {
  return {
    sheets: sheetMap,
    primarySheet,
    
    getSheet(name: string): ExcelSheet {
      const sheet = sheetMap.get(name);
      if (!sheet) {
        throw new Error(`Sheet "${name}" not found. Available: ${Array.from(sheetMap.keys()).join(', ')}`);
      }
      return sheet;
    },
    
    hasSheet(name: string): boolean {
      return sheetMap.has(name);
    },
    
    getColumnIndex(sheet: ExcelSheet, columnName: string): number {
      // Try exact match first
      let index = sheet.headers.indexOf(columnName);
      if (index >= 0) return index;
      
      // Try case-insensitive match
      const normalizedTarget = columnName.toLowerCase().trim();
      index = sheet.headers.findIndex(h => h.toLowerCase().trim() === normalizedTarget);
      if (index >= 0) return index;
      
      throw new Error(
        `Column "${columnName}" not found in sheet "${sheet.name}". ` +
        `Available: ${sheet.headers.join(', ')}`
      );
    },
    
    getColumnName(sheet: ExcelSheet, index: number): string {
      if (index < 0 || index >= sheet.headers.length) {
        throw new Error(
          `Column index ${index} out of range for sheet "${sheet.name}" ` +
          `(has ${sheet.headers.length} columns)`
        );
      }
      return sheet.headers[index];
    },
  };
}

/**
 * Parse all sheets with full data (for cross-sheet lookups)
 */
export async function parseAllSheets(
  file: File | ArrayBuffer,
  options?: Omit<MultiSheetParseOptions, 'parseAllSheets'>
): Promise<ParsedExcelFile & { context: MultiSheetContext }> {
  return parseMultiSheet(file, { ...options, parseAllSheets: true }) as Promise<
    ParsedExcelFile & { context: MultiSheetContext }
  >;
}

/**
 * Get sheet names without parsing data
 */
export function getSheetNamesQuick(file: File | ArrayBuffer): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const process = (buffer: ArrayBuffer) => {
      try {
        const workbook = XLSX.read(buffer, { 
          type: 'array',
          sheetRows: 1, // Only parse first row
        });
        resolve(workbook.SheetNames);
      } catch (error) {
        reject(error);
      }
    };
    
    if (file instanceof File) {
      const reader = new FileReader();
      reader.onload = (e) => process(e.target?.result as ArrayBuffer);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    } else {
      process(file);
    }
  });
}

function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}
