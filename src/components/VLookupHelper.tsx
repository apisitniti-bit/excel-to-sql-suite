import { useState } from 'react';
import { Search, Settings, AlertCircle, CheckCircle, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import type { ExcelColumn } from '@/types/converter';
import type { VLookupSet, VLookupConfig } from '@/core/types/vlookup';

interface VLookupHelperProps {
  columns: ExcelColumn[];
  activeSheet: string;
  sheetNames: string[];
  sheetData?: {
    name: string;
    headers: string[];
  }[];
  lookupSet: VLookupSet;
  onLookupSetChange: (lookupSet: VLookupSet) => void;
}

export function VLookupHelper({ columns, activeSheet, sheetNames, sheetData, lookupSet, onLookupSetChange }: VLookupHelperProps) {
  const [selectedLookupId, setSelectedLookupId] = useState<string | null>(null);

  const updateLookupSet = (updates: Partial<VLookupSet>) => {
    onLookupSetChange({ ...lookupSet, ...updates });
  };

  const handleAddLookup = () => {
    if (!columns.length || !sheetNames.length) return;

    const defaultSheet = sheetNames[0];
    const defaultSheetHeaders = sheetData?.find(s => s.name === defaultSheet)?.headers || [];

    const newLookup: VLookupConfig = {
      id: `lookup_${Date.now()}`,
      sourceColumn: columns[0].name,
      targetSheet: activeSheet,
      targetColumn: `${columns[0].name}_lookup`,
      targetCell: undefined,
      allowOverwrite: false,
      sourceType: 'sheet',
      sheetLookup: {
        sheetName: defaultSheet,
        keyColumn: defaultSheetHeaders[0] || '',
        valueColumn: defaultSheetHeaders[1] || defaultSheetHeaders[0] || '',
      },
      defaultValue: null,
      caseSensitive: false,
      trimKeys: true,
    };

    updateLookupSet({
      enabled: true,
      lookups: [...lookupSet.lookups, newLookup],
    });
    setSelectedLookupId(newLookup.id);
  };

  const handleRemoveLookup = (lookupId: string) => {
    const remaining = lookupSet.lookups.filter(l => l.id !== lookupId);
    updateLookupSet({
      lookups: remaining,
      enabled: remaining.length > 0 && lookupSet.enabled,
    });
  };

  const updateLookup = (lookupId: string, updates: Partial<VLookupConfig>) => {
    const updated = lookupSet.lookups.map(lookup =>
      lookup.id === lookupId ? { ...lookup, ...updates } : lookup
    );
    updateLookupSet({ lookups: updated });
  };

  const lookupMappings = lookupSet.lookups;

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-2 mb-4">
        <Search className="w-5 h-5 text-primary" />
        <h3 className="text-sm font-semibold">VLOOKUP Configuration</h3>
      </div>

      {lookupMappings.length === 0 ? (
        <Card className="p-4 bg-muted/50 border-dashed">
          <p className="text-xs text-muted-foreground">
            No VLOOKUP rules configured. Add one to map across sheets.
          </p>
          <Button onClick={handleAddLookup} size="sm" className="mt-3">
            <Plus className="w-4 h-4 mr-2" />
            Add VLOOKUP
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {lookupMappings.map((lookup, idx) => {
            const sourceSheetHeaders = sheetData?.find(s => s.name === lookup.sheetLookup?.sheetName)?.headers || [];
            const targetSheetName = lookup.targetSheet || activeSheet;
            const targetSheetHeaders = sheetData?.find(s => s.name === targetSheetName)?.headers || [];
            const outputMode = lookup.targetCell ? 'cell' : 'column';
            const targetColumnExists = lookup.targetColumn
              ? targetSheetHeaders.some(h => h.toLowerCase().trim() === lookup.targetColumn?.toLowerCase().trim())
              : false;
            const targetColumnError = lookup.targetColumn && targetColumnExists && !lookup.allowOverwrite;
            return (
              <Card key={`${lookup.id}`} className="p-3">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="text-xs font-semibold">{lookup.sourceColumn}</h4>
                    <p className="text-xs text-muted-foreground">→ {lookup.targetColumn || lookup.sourceColumn}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRemoveLookup(lookup.id)}
                    className="text-xs h-7"
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Remove
                  </Button>
                </div>

                <div className="space-y-2">
                  <div>
                    <Label className="text-xs">Source Column</Label>
                    <Select
                      value={lookup.sourceColumn}
                      onValueChange={(value) => updateLookup(lookup.id, { sourceColumn: value })}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue placeholder="Select source column" />
                      </SelectTrigger>
                      <SelectContent>
                        {columns.map((c) => (
                          <SelectItem key={c.name} value={c.name} className="text-xs">
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Target Sheet</Label>
                    <Select
                      value={targetSheetName}
                      onValueChange={(value) => updateLookup(lookup.id, { targetSheet: value })}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue placeholder="Select target sheet" />
                      </SelectTrigger>
                      <SelectContent>
                        {sheetNames.map((sheet) => (
                          <SelectItem key={sheet} value={sheet} className="text-xs">
                            {sheet}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <Label className="text-xs">Output Location</Label>
                    <Button
                      size="sm"
                      variant={outputMode === 'column' ? 'default' : 'outline'}
                      className="h-7 px-2 text-xs"
                      onClick={() => updateLookup(lookup.id, { targetCell: undefined })}
                    >
                      Column
                    </Button>
                    <Button
                      size="sm"
                      variant={outputMode === 'cell' ? 'default' : 'outline'}
                      className="h-7 px-2 text-xs"
                      onClick={() => updateLookup(lookup.id, { targetCell: 'A2' })}
                    >
                      Cell
                    </Button>
                  </div>
                  {outputMode === 'column' ? (
                    <div className="space-y-1">
                      <Label className="text-xs">Target Column</Label>
                      <Select
                        value={lookup.targetColumn || ''}
                        onValueChange={(value) => updateLookup(lookup.id, { targetColumn: value })}
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue placeholder="Select column" />
                        </SelectTrigger>
                        <SelectContent>
                          {targetSheetHeaders.map((header) => (
                            <SelectItem key={header} value={header} className="text-xs">
                              {header}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        value={lookup.targetColumn || ''}
                        onChange={(e) => updateLookup(lookup.id, { targetColumn: e.target.value })}
                        placeholder="Custom column name"
                        className="h-7 text-xs font-mono"
                      />
                      {targetColumnError && (
                        <p className="text-[10px] text-destructive">Column already exists. Enable Allow Overwrite to write into it.</p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <Label className="text-xs">Target Cell</Label>
                      <Input
                        value={lookup.targetCell || ''}
                        onChange={(e) => updateLookup(lookup.id, { targetCell: e.target.value.trim().toUpperCase() || undefined })}
                        placeholder="G2"
                        className="h-7 text-xs font-mono"
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">Use A1 format (e.g. G2). Row must be &gt;= 2.</p>
                    </div>
                  )}
                  <div>
                    <Label className="text-xs">Lookup Sheet</Label>
                    <Select
                      value={lookup.sheetLookup?.sheetName || ''}
                      onValueChange={(value) =>
                        updateLookup(lookup.id, {
                          sheetLookup: {
                            sheetName: value,
                            keyColumn: sheetData?.find(s => s.name === value)?.headers?.[0] || '',
                            valueColumn: sheetData?.find(s => s.name === value)?.headers?.[1] || '',
                          },
                        })
                      }
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue placeholder="Select sheet" />
                      </SelectTrigger>
                      <SelectContent>
                        {sheetNames.map((sheet) => (
                          <SelectItem key={sheet} value={sheet} className="text-xs">
                            {sheet}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Key Column</Label>
                      <Select
                        value={lookup.sheetLookup?.keyColumn || ''}
                        onValueChange={(value) =>
                          updateLookup(lookup.id, {
                            sheetLookup: {
                              sheetName: lookup.sheetLookup?.sheetName || sheetNames[0] || '',
                              keyColumn: value,
                              valueColumn: lookup.sheetLookup?.valueColumn || '',
                            },
                          })
                        }
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue placeholder="Key column" />
                        </SelectTrigger>
                        <SelectContent>
                          {sourceSheetHeaders.map((header) => (
                            <SelectItem key={header} value={header} className="text-xs">
                              {header}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Value Column</Label>
                      <Select
                        value={lookup.sheetLookup?.valueColumn || ''}
                        onValueChange={(value) =>
                          updateLookup(lookup.id, {
                            sheetLookup: {
                              sheetName: lookup.sheetLookup?.sheetName || sheetNames[0] || '',
                              keyColumn: lookup.sheetLookup?.keyColumn || '',
                              valueColumn: value,
                            },
                          })
                        }
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue placeholder="Value column" />
                        </SelectTrigger>
                        <SelectContent>
                          {sourceSheetHeaders.map((header) => (
                            <SelectItem key={header} value={header} className="text-xs">
                              {header}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Default Value</Label>
                    <Input
                      value={lookup.defaultValue ?? ''}
                      onChange={(e) => updateLookup(lookup.id, { defaultValue: e.target.value || null })}
                      placeholder="default_value"
                      className="h-7 text-xs font-mono"
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <Label className="flex items-center gap-2 text-xs cursor-pointer">
                      <Checkbox
                        checked={lookup.caseSensitive}
                        onCheckedChange={(checked) => updateLookup(lookup.id, { caseSensitive: !!checked })}
                      />
                      Case Sensitive
                    </Label>
                    <Label className="flex items-center gap-2 text-xs cursor-pointer">
                      <Checkbox
                        checked={lookup.trimKeys}
                        onCheckedChange={(checked) => updateLookup(lookup.id, { trimKeys: !!checked })}
                      />
                      Trim Keys
                    </Label>
                    <Label className="flex items-center gap-2 text-xs cursor-pointer">
                      <Checkbox
                        checked={lookup.allowOverwrite}
                        onCheckedChange={(checked) => updateLookup(lookup.id, { allowOverwrite: !!checked })}
                      />
                      Allow Overwrite
                    </Label>
                  </div>
                </div>
              </Card>
            );
          })}
          <Button onClick={handleAddLookup} size="sm" variant="outline">
            <Plus className="w-4 h-4 mr-2" />
            Add VLOOKUP
          </Button>
        </div>
      )}

      {/* Add Lookup Instructions */}
      <Card className="p-3 bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
        <div className="flex gap-2">
          <Settings className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-semibold text-blue-900 dark:text-blue-300">How to Add a VLOOKUP:</p>
            <ol className="list-decimal list-inside space-y-0.5 text-blue-800 dark:text-blue-200">
              <li>Go to <strong>Column Mapping</strong></li>
              <li>Click <strong>Add VLOOKUP</strong></li>
              <li>Select the source column from your main sheet</li>
              <li>Choose the lookup sheet + key/value columns</li>
              <li>Set target column and defaults</li>
            </ol>
          </div>
        </div>
      </Card>

      {/* Examples */}
      <Card className="p-3 bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
        <div className="flex gap-2">
          <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-semibold text-green-900 dark:text-green-300">Examples:</p>
            <div className="space-y-2">
              <div>
                <p className="font-mono text-green-800 dark:text-green-200">Product Code → Product Name</p>
                <p className="text-green-700 dark:text-green-300">Source: product_codes, Target: product_names</p>
              </div>
              <div>
                <p className="font-mono text-green-800 dark:text-green-200">Country Code → Country Name</p>
                <p className="text-green-700 dark:text-green-300">Source: codes, Target: full_name</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Test VLOOKUP */}
      {lookupMappings.length > 0 && (
        <Card className="p-3 border-primary/20 bg-primary/5">
          <Label className="text-xs font-semibold mb-2 block">Test VLOOKUP</Label>
          <div className="space-y-2">
            <Select value={selectedLookupId || ''} onValueChange={setSelectedLookupId}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select column to test" />
              </SelectTrigger>
              <SelectContent>
                {lookupMappings.map((m) => (
                  <SelectItem key={m.id} value={m.id} className="text-xs">
                    {m.targetColumn || m.sourceColumn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div>
              <Label className="text-xs">Sample Value</Label>
              <Input
                placeholder="Enter a sample value to test"
                className="h-8 font-mono text-xs"
              />
            </div>

            <Button className="w-full h-8 text-xs" variant="outline">Test Lookup</Button>
          </div>
        </Card>
      )}

      <Card className="p-3 bg-muted/40">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold">Enable VLOOKUP</Label>
          <Checkbox
            checked={lookupSet.enabled}
            onCheckedChange={(checked) => updateLookupSet({ enabled: !!checked })}
          />
        </div>
        <div className="flex items-center justify-between mt-2">
          <Label className="text-xs text-muted-foreground">Preview-only mode</Label>
          <Checkbox
            checked={lookupSet.previewOnly}
            onCheckedChange={(checked) => updateLookupSet({ previewOnly: !!checked })}
          />
        </div>
      </Card>
    </div>
  );
}
