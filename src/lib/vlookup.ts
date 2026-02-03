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
