// Lookup Types

export interface LookupMapping {
    sourceColumn: string;       // Column in main data to transform
    targetColumn?: string;      // Output column name (default: same as source)
    lookupType: 'inline' | 'file';

    // For inline map
    inlineMap?: Record<string, string>;

    // For file lookup (Phase 2)
    lookupFile?: {
        keyColumn: string;
        valueColumn: string;
        data: Map<string, string>;
    };

    // Options
    fallbackValue: string;      // Value if key not found (default: '')
    caseSensitive: boolean;     // Case-sensitive matching
}

export interface LookupConfig {
    enabled: boolean;
    mappings: LookupMapping[];
}

export const DEFAULT_LOOKUP_CONFIG: LookupConfig = {
    enabled: false,
    mappings: [],
};

export function createInlineLookup(
    sourceColumn: string,
    map: Record<string, string>,
    options?: Partial<Pick<LookupMapping, 'targetColumn' | 'fallbackValue' | 'caseSensitive'>>
): LookupMapping {
    return {
        sourceColumn,
        targetColumn: options?.targetColumn,
        lookupType: 'inline',
        inlineMap: map,
        fallbackValue: options?.fallbackValue ?? '',
        caseSensitive: options?.caseSensitive ?? false,
    };
}
