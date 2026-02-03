/**
 * Excel Parser Module
 * Pure parsing - no type inference, no SQL generation
 * Framework-agnostic: works in browser and Node.js
 */

import * as XLSX from 'xlsx';
import type { ParsedExcelFile, ExcelSheet } from '../types';

export interface ParseOptions {
  sheetIndex?: number;
  sheetName?: string;
  maxRows?: number;
  headerRow?: number; // 0-indexed, default 0
}

const DEFAULT_OPTIONS: ParseOptions = {
  headerRow: 0,
  maxRows: 100000, // Safety limit
};

/**
 * Parse an Excel file (browser File or Node.js Buffer/ArrayBuffer)
 */
export async function parseExcelFile(
  file: File | ArrayBuffer,
  options: ParseOptions = {}
): Promise<ParsedExcelFile> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  const arrayBuffer = file instanceof File 
    ? await fileToArrayBuffer(file)
    : file;
  
  const workbook = XLSX.read(arrayBuffer, { 
    type: 'array',
    cellFormula: false, // Don't calculate formulas - raw values only
    cellHTML: false,
    cellNF: false,
  });

  if (workbook.SheetNames.length === 0) {
    throw new Error('Excel file contains no sheets');
  }

  // Select sheet
  let sheetName: string;
  if (opts.sheetName && workbook.SheetNames.includes(opts.sheetName)) {
    sheetName = opts.sheetName;
  } else if (opts.sheetIndex !== undefined && opts.sheetIndex < workbook.SheetNames.length) {
    sheetName = workbook.SheetNames[opts.sheetIndex];
  } else {
    sheetName = workbook.SheetNames[0];
  }

  const worksheet = workbook.Sheets[sheetName];
  
  // Convert to JSON with header row
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
    header: 1,
    defval: null,
    blankrows: false,
  }) as unknown[][];

  if (jsonData.length === 0) {
    throw new Error(`Sheet "${sheetName}" is empty`);
  }

  // Extract headers
  const headers = (jsonData[opts.headerRow] || [])
    .map((h, i) => h !== null ? String(h).trim() : `Column_${i + 1}`);

  // Extract data rows
  const dataRows = jsonData.slice(opts.headerRow + 1, opts.headerRow + 1 + opts.maxRows!);

  const sheet: ExcelSheet = {
    name: sheetName,
    rowCount: dataRows.length,
    headers,
    rows: dataRows,
  };

  const fileName = file instanceof File ? file.name : 'untitled.xlsx';

  // Build sheets array with parsed data for active sheet
  const sheets: ExcelSheet[] = workbook.SheetNames.map(name => ({
    name,
    rowCount: name === sheetName ? dataRows.length : 0,
    headers: name === sheetName ? headers : [],
    rows: name === sheetName ? dataRows : [],
  }));

  return {
    fileName,
    sheets,
    activeSheet: sheetName,
  };
}

/**
 * Parse a specific sheet by name
 */
export function parseSheet(
  arrayBuffer: ArrayBuffer,
  sheetName: string,
  options: ParseOptions = {}
): ExcelSheet {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  const workbook = XLSX.read(arrayBuffer, { 
    type: 'array',
    sheetRows: opts.maxRows! + opts.headerRow! + 1,
  });

  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    throw new Error(`Sheet "${sheetName}" not found`);
  }

  const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
    header: 1,
    defval: null,
    blankrows: false,
  }) as unknown[][];

  if (jsonData.length === 0) {
    throw new Error(`Sheet "${sheetName}" is empty`);
  }

  const headers = (jsonData[opts.headerRow] || [])
    .map((h, i) => h !== null ? String(h).trim() : `Column_${i + 1}`);

  const dataRows = jsonData.slice(opts.headerRow + 1);

  return {
    name: sheetName,
    rowCount: dataRows.length,
    headers,
    rows: dataRows,
  };
}

/**
 * Get sheet names without parsing full data
 */
export function getSheetNames(arrayBuffer: ArrayBuffer): string[] {
  const workbook = XLSX.read(arrayBuffer, { 
    type: 'array',
    sheetRows: 0, // Don't parse any rows
  });
  return workbook.SheetNames;
}

/**
 * Preview first N rows of a sheet
 */
export function previewSheet(
  arrayBuffer: ArrayBuffer,
  sheetName: string,
  rowCount: number = 10
): ExcelSheet {
  return parseSheet(arrayBuffer, sheetName, { maxRows: rowCount });
}

function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}
