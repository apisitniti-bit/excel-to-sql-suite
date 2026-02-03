import { describe, it, expect } from 'vitest';
import { applyVLookups } from '@/core/vlookup/engine';
import { buildContextFromSheets } from '@/core/excel/multi-sheet';
import type { ExcelSheet } from '@/core/types';
import type { VLookupSet } from '@/core/types/vlookup';

const mainSheet: ExcelSheet = {
  name: 'Orders',
  headers: ['OrderID', 'ProductCode', 'Qty'],
  rows: [
    ['A1', 'P100', 2],
    ['A2', 'P200', 1],
    ['A3', 'P999', 4],
    ['A4', '', 3],
  ],
  rowCount: 4,
};

const lookupSheet: ExcelSheet = {
  name: 'Products',
  headers: ['Code', 'Name'],
  rows: [
    ['P100', 'Widget'],
    ['P200', 'Gadget'],
  ],
  rowCount: 2,
};

const sheets = [mainSheet, lookupSheet];

describe('VLOOKUP Engine - Multi-sheet', () => {
  it('handles basic cross-sheet VLOOKUP (happy path)', () => {
    const lookupSet: VLookupSet = {
      enabled: true,
      previewOnly: false,
      lookups: [
        {
          id: 'lookup1',
          sourceColumn: 'ProductCode',
          targetColumn: 'ProductName',
          sourceType: 'sheet',
          sheetLookup: {
            sheetName: 'Products',
            keyColumn: 'Code',
            valueColumn: 'Name',
          },
          defaultValue: null,
          caseSensitive: false,
          trimKeys: true,
        },
      ],
    };

    const context = buildContextFromSheets(sheets, 'Orders');
    const result = applyVLookups(mainSheet, lookupSet, context);

    expect(result.errors).toHaveLength(0);
    expect(result.headers).toContain('ProductName');
    expect(result.rows[0][3]).toBe('Widget');
    expect(result.rows[1][3]).toBe('Gadget');
  });

  it('handles missing lookup key -> result null, no crash', () => {
    const lookupSet: VLookupSet = {
      enabled: true,
      previewOnly: false,
      lookups: [
        {
          id: 'lookup2',
          sourceColumn: 'ProductCode',
          targetColumn: 'ProductName',
          sourceType: 'sheet',
          sheetLookup: {
            sheetName: 'Products',
            keyColumn: 'Code',
            valueColumn: 'Name',
          },
          defaultValue: null,
          caseSensitive: false,
          trimKeys: true,
        },
      ],
    };

    const context = buildContextFromSheets(sheets, 'Orders');
    const result = applyVLookups(mainSheet, lookupSet, context);

    expect(result.rows[2][3]).toBeNull(); // P999 not found
  });

  it('fails fast with missing lookup column', () => {
    const lookupSet: VLookupSet = {
      enabled: true,
      previewOnly: false,
      lookups: [
        {
          id: 'lookup3',
          sourceColumn: 'ProductCode',
          targetColumn: 'ProductName',
          sourceType: 'sheet',
          sheetLookup: {
            sheetName: 'Products',
            keyColumn: 'Missing',
            valueColumn: 'Name',
          },
          defaultValue: null,
          caseSensitive: false,
          trimKeys: true,
        },
      ],
    };

    const context = buildContextFromSheets(sheets, 'Orders');
    const result = applyVLookups(mainSheet, lookupSet, context, { failFast: true });

    expect(result.errors[0].type).toBe('missing_column');
  });

  it('fails fast with missing sheet', () => {
    const lookupSet: VLookupSet = {
      enabled: true,
      previewOnly: false,
      lookups: [
        {
          id: 'lookup4',
          sourceColumn: 'ProductCode',
          targetColumn: 'ProductName',
          sourceType: 'sheet',
          sheetLookup: {
            sheetName: 'MissingSheet',
            keyColumn: 'Code',
            valueColumn: 'Name',
          },
          defaultValue: null,
          caseSensitive: false,
          trimKeys: true,
        },
      ],
    };

    const context = buildContextFromSheets(sheets, 'Orders');
    const result = applyVLookups(mainSheet, lookupSet, context, { failFast: true });

    expect(result.errors[0].type).toBe('missing_sheet');
  });

  it('handles header mismatch (case/whitespace)', () => {
    const lookupSet: VLookupSet = {
      enabled: true,
      previewOnly: false,
      lookups: [
        {
          id: 'lookup5',
          sourceColumn: 'ProductCode',
          targetColumn: 'ProductName',
          sourceType: 'sheet',
          sheetLookup: {
            sheetName: 'Products',
            keyColumn: ' code ',
            valueColumn: ' name ',
          },
          defaultValue: null,
          caseSensitive: false,
          trimKeys: true,
        },
      ],
    };

    const context = buildContextFromSheets(sheets, 'Orders');
    const result = applyVLookups(mainSheet, lookupSet, context);

    expect(result.errors).toHaveLength(0);
    expect(result.rows[0][3]).toBe('Widget');
  });

  it('handles empty cells in lookup source', () => {
    const lookupSet: VLookupSet = {
      enabled: true,
      previewOnly: false,
      lookups: [
        {
          id: 'lookup6',
          sourceColumn: 'ProductCode',
          targetColumn: 'ProductName',
          sourceType: 'sheet',
          sheetLookup: {
            sheetName: 'Products',
            keyColumn: 'Code',
            valueColumn: 'Name',
          },
          defaultValue: null,
          caseSensitive: false,
          trimKeys: true,
        },
      ],
    };

    const context = buildContextFromSheets(sheets, 'Orders');
    const result = applyVLookups(mainSheet, lookupSet, context);

    expect(result.rows[3][3]).toBeNull(); // empty ProductCode
  });

  it('supports multiple VLOOKUPs from the same sheet', () => {
    const lookupSet: VLookupSet = {
      enabled: true,
      previewOnly: false,
      lookups: [
        {
          id: 'lookup7',
          sourceColumn: 'ProductCode',
          targetColumn: 'ProductName',
          sourceType: 'sheet',
          sheetLookup: {
            sheetName: 'Products',
            keyColumn: 'Code',
            valueColumn: 'Name',
          },
          defaultValue: null,
          caseSensitive: false,
          trimKeys: true,
        },
        {
          id: 'lookup8',
          sourceColumn: 'ProductCode',
          targetColumn: 'ProductName2',
          sourceType: 'sheet',
          sheetLookup: {
            sheetName: 'Products',
            keyColumn: 'Code',
            valueColumn: 'Name',
          },
          defaultValue: 'N/A',
          caseSensitive: false,
          trimKeys: true,
        },
      ],
    };

    const context = buildContextFromSheets(sheets, 'Orders');
    const result = applyVLookups(mainSheet, lookupSet, context);

    expect(result.headers).toContain('ProductName');
    expect(result.headers).toContain('ProductName2');
    expect(result.rows[0][3]).toBe('Widget');
    expect(result.rows[0][4]).toBe('Widget');
  });

  it('preview-only mode returns data without SQL involvement', () => {
    const lookupSet: VLookupSet = {
      enabled: true,
      previewOnly: true,
      lookups: [
        {
          id: 'lookup9',
          sourceColumn: 'ProductCode',
          targetColumn: 'ProductName',
          sourceType: 'sheet',
          sheetLookup: {
            sheetName: 'Products',
            keyColumn: 'Code',
            valueColumn: 'Name',
          },
          defaultValue: null,
          caseSensitive: false,
          trimKeys: true,
        },
      ],
    };

    const context = buildContextFromSheets(sheets, 'Orders');
    const result = applyVLookups(mainSheet, lookupSet, context);

    expect(result.rows[0][3]).toBe('Widget');
  });
});
