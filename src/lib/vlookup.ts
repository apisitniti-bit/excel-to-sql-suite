/**
 * VLOOKUP wrapper (legacy UI compatibility)
 * Separates VLOOKUP from SQL generation and mapping logic
 */

import { applyVLookups } from '@/core/vlookup/engine';
import { buildContextFromSheets } from '@/core/excel/multi-sheet';
import type { ExcelSheet } from '@/core/types';
import type {
  VLookupSet,
  VLookupResult,
  MultiSheetContext,
} from '@/core/types/vlookup';

export interface VLookupApplyOptions {
  /** Fail fast on missing sheet/column */
  failFast?: boolean;
  /** Disable lookups (preview-only) */
  disabled?: boolean;
}

/**
 * Apply VLOOKUPs to a single sheet (no multi-sheet context)
 */
export function applyVLookupToSheet(
  sheet: ExcelSheet,
  lookupSet: VLookupSet,
  options: VLookupApplyOptions = {}
): VLookupResult {
  return applyVLookups(sheet, lookupSet, undefined, {
    failFast: options.failFast,
    disabled: options.disabled,
  });
}

/**
 * Apply VLOOKUPs with multi-sheet context
 */
export function applyVLookupToMultiSheet(
  sheets: ExcelSheet[],
  activeSheet: string,
  lookupSet: VLookupSet,
  options: VLookupApplyOptions = {}
): { result: VLookupResult; context: MultiSheetContext } {
  const context = buildContextFromSheets(sheets, activeSheet);
  const sheet = context.getSheet(activeSheet);

  const result = applyVLookups(sheet, lookupSet, context, {
    failFast: options.failFast,
    disabled: options.disabled,
  });

  return { result, context };
}

/**
 * Apply VLOOKUPs to all target sheets (for preview/export).
 */
export function applyVLookupToSheets(
  sheets: ExcelSheet[],
  activeSheet: string,
  lookupSet: VLookupSet,
  options: VLookupApplyOptions = {}
): { sheets: ExcelSheet[]; errors: VLookupResult['errors']; context: MultiSheetContext } {
  const context = buildContextFromSheets(sheets, activeSheet);
  const errors: VLookupResult['errors'] = [];

  const updatedSheets = sheets.map(sheet => {
    const targetLookups = lookupSet.lookups.filter(lookup => {
      const targetSheet = lookup.targetSheet || activeSheet;
      return targetSheet === sheet.name;
    });

    if (targetLookups.length === 0) {
      return sheet;
    }

    const scopedSet: VLookupSet = {
      ...lookupSet,
      lookups: targetLookups,
    };

    const result = applyVLookups(sheet, scopedSet, context, {
      failFast: options.failFast,
      disabled: options.disabled,
    });

    errors.push(...result.errors);

    return {
      ...sheet,
      headers: result.headers,
      rows: result.rows,
      rowCount: result.rows.length,
    };
  });

  return { sheets: updatedSheets, errors, context };
}
