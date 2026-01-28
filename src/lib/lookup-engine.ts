// Lookup Engine
// Transforms data values using lookup mappings

import type { LookupMapping, LookupConfig } from '@/types/lookup';
import type { ExcelData } from '@/types/converter';

/**
 * Apply a single lookup mapping to a value
 */
export function lookupValue(
    value: any,
    mapping: LookupMapping
): string {
    if (value === null || value === undefined || value === '') {
        return mapping.fallbackValue;
    }

    const strValue = String(value);
    const searchKey = mapping.caseSensitive ? strValue : strValue.toLowerCase();

    if (mapping.lookupType === 'inline' && mapping.inlineMap) {
        // For inline map
        if (mapping.caseSensitive) {
            return mapping.inlineMap[searchKey] ?? mapping.fallbackValue;
        } else {
            // Case-insensitive: find matching key
            const matchingKey = Object.keys(mapping.inlineMap).find(
                k => k.toLowerCase() === searchKey
            );
            return matchingKey ? mapping.inlineMap[matchingKey] : mapping.fallbackValue;
        }
    }

    if (mapping.lookupType === 'file' && mapping.lookupFile) {
        // For file lookup (Phase 2)
        const result = mapping.lookupFile.data.get(searchKey);
        return result ?? mapping.fallbackValue;
    }

    return mapping.fallbackValue;
}

/**
 * Apply lookup transformations to entire Excel data
 */
export function applyLookups(
    data: ExcelData,
    config: LookupConfig
): ExcelData {
    if (!config.enabled || config.mappings.length === 0) {
        return data;
    }

    // Create a map of column index to lookup mapping
    const lookupsByColumn = new Map<number, LookupMapping>();

    for (const mapping of config.mappings) {
        const colIndex = data.headers.indexOf(mapping.sourceColumn);
        if (colIndex >= 0) {
            lookupsByColumn.set(colIndex, mapping);
        }
    }

    if (lookupsByColumn.size === 0) {
        return data;
    }

    // Transform rows
    const transformedRows = data.rows.map(row => {
        const newRow = [...row];

        for (const [colIndex, mapping] of lookupsByColumn) {
            newRow[colIndex] = lookupValue(row[colIndex], mapping);
        }

        return newRow;
    });

    return {
        ...data,
        rows: transformedRows,
    };
}

/**
 * Get lookup statistics
 */
export function getLookupStats(
    data: ExcelData,
    config: LookupConfig
): { column: string; matched: number; unmatched: number; total: number }[] {
    if (!config.enabled || config.mappings.length === 0) {
        return [];
    }

    const stats: { column: string; matched: number; unmatched: number; total: number }[] = [];

    for (const mapping of config.mappings) {
        const colIndex = data.headers.indexOf(mapping.sourceColumn);
        if (colIndex < 0) continue;

        let matched = 0;
        let unmatched = 0;

        for (const row of data.rows) {
            const value = row[colIndex];
            const result = lookupValue(value, mapping);

            if (result === mapping.fallbackValue && value !== null && value !== undefined && value !== '') {
                unmatched++;
            } else {
                matched++;
            }
        }

        stats.push({
            column: mapping.sourceColumn,
            matched,
            unmatched,
            total: data.rows.length,
        });
    }

    return stats;
}

/**
 * Parse inline map from text (key=value format, one per line)
 */
export function parseInlineMapText(text: string): Record<string, string> {
    const map: Record<string, string> = {};
    const lines = text.split('\n').filter(line => line.trim());

    for (const line of lines) {
        const separatorIndex = line.indexOf('=');
        if (separatorIndex > 0) {
            const key = line.substring(0, separatorIndex).trim();
            const value = line.substring(separatorIndex + 1).trim();
            if (key) {
                map[key] = value;
            }
        }
    }

    return map;
}

/**
 * Convert map to text format
 */
export function mapToText(map: Record<string, string>): string {
    return Object.entries(map)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
}
