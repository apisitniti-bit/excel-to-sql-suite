import * as XLSX from 'xlsx';
import type { ExcelData, ExcelColumn, PostgresDataType } from '@/types/converter';

export async function parseExcelFile(file: File): Promise<ExcelData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        
        const sheets = workbook.SheetNames;
        const firstSheet = workbook.Sheets[sheets[0]];
        
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];
        
        if (jsonData.length === 0) {
          reject(new Error('Excel file is empty'));
          return;
        }
        
        const headers = (jsonData[0] || []).map((h, i) => 
          h ? String(h).trim() : `Column_${i + 1}`
        );
        
        const rows = jsonData.slice(1, 1001); // First 1000 data rows
        const totalRows = jsonData.length - 1;
        
        resolve({
          headers,
          rows,
          totalRows,
          fileName: file.name,
          sheetName: sheets[0],
          sheets,
        });
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

export function detectDataType(values: any[]): PostgresDataType {
  const nonEmptyValues = values.filter(v => v !== null && v !== undefined && v !== '');
  
  if (nonEmptyValues.length === 0) return 'TEXT';
  
  // Check for UUID pattern
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (nonEmptyValues.every(v => uuidRegex.test(String(v)))) return 'UUID';
  
  // Check for boolean
  const boolValues = ['true', 'false', '1', '0', 'yes', 'no'];
  if (nonEmptyValues.every(v => boolValues.includes(String(v).toLowerCase()))) return 'BOOLEAN';
  
  // Check for integers
  if (nonEmptyValues.every(v => Number.isInteger(Number(v)) && !isNaN(Number(v)))) {
    const maxVal = Math.max(...nonEmptyValues.map(Number));
    return maxVal > 2147483647 ? 'BIGINT' : 'INTEGER';
  }
  
  // Check for decimals
  if (nonEmptyValues.every(v => !isNaN(Number(v)))) return 'DECIMAL';
  
  // Check for dates
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (nonEmptyValues.every(v => dateRegex.test(String(v)))) return 'DATE';
  
  // Check for timestamps
  const timestampRegex = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/;
  if (nonEmptyValues.every(v => timestampRegex.test(String(v)))) return 'TIMESTAMPTZ';
  
  // Check for JSON
  if (nonEmptyValues.every(v => {
    try {
      const parsed = JSON.parse(String(v));
      return typeof parsed === 'object';
    } catch {
      return false;
    }
  })) return 'JSONB';
  
  return 'TEXT';
}

export function analyzeColumns(data: ExcelData): ExcelColumn[] {
  return data.headers.map((name, index) => {
    const sampleValues = data.rows
      .slice(0, 100)
      .map(row => row[index])
      .filter(v => v !== null && v !== undefined);
    
    return {
      name,
      index,
      sampleValues: sampleValues.slice(0, 5).map(String),
      detectedType: detectDataType(sampleValues),
    };
  });
}
