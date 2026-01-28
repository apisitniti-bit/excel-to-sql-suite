import { useState } from 'react';
import { Search, Settings, AlertCircle, CheckCircle } from 'lucide-react';
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
import type { ExcelColumn, ColumnMapping } from '@/types/converter';

interface VLookupHelperProps {
  columns: ExcelColumn[];
  mappings: ColumnMapping[];
  onMappingsChange: (mappings: ColumnMapping[]) => void;
}

export function VLookupHelper({ columns, mappings, onMappingsChange }: VLookupHelperProps) {
  const [selectedColumn, setSelectedColumn] = useState<number | null>(null);
  const [lookupData, setLookupData] = useState<Record<string, string>>({});

  const handleAddLookup = (index: number) => {
    const newMappings = [...mappings];
    if (!newMappings[index]) return;

    newMappings[index] = {
      ...newMappings[index],
      useLookup: true,
      lookupSourceColumn: columns[0]?.name,
      lookupTargetValue: 'value',
      lookupDefaultValue: 'N/A',
    };
    onMappingsChange(newMappings);
    setSelectedColumn(index);
  };

  const handleRemoveLookup = (index: number) => {
    const newMappings = [...mappings];
    if (!newMappings[index]) return;

    newMappings[index] = {
      ...newMappings[index],
      useLookup: false,
      lookupSourceColumn: undefined,
      lookupTargetValue: undefined,
      lookupDefaultValue: undefined,
    };
    onMappingsChange(newMappings);
  };

  const lookupMappings = mappings.filter(m => m.useLookup);

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-2 mb-4">
        <Search className="w-5 h-5 text-primary" />
        <h3 className="text-sm font-semibold">VLOOKUP Configuration</h3>
      </div>

      {lookupMappings.length === 0 ? (
        <Card className="p-4 bg-muted/50 border-dashed">
          <p className="text-xs text-muted-foreground">
            No lookup columns configured. Click the VLOOKUP checkbox in Column Mapping to add one.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {lookupMappings.map((mapping, idx) => {
            const originalIndex = mappings.indexOf(mapping);
            return (
              <Card key={`${mapping.excelColumn}-${idx}`} className="p-3">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="text-xs font-semibold">{mapping.excelColumn}</h4>
                    <p className="text-xs text-muted-foreground">→ {mapping.pgColumn}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRemoveLookup(originalIndex)}
                    className="text-xs h-7"
                  >
                    Remove
                  </Button>
                </div>

                <div className="space-y-2">
                  <div>
                    <Label className="text-xs">Source Column</Label>
                    <p className="text-xs font-mono text-muted-foreground">
                      {mapping.lookupSourceColumn}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs">Maps To</Label>
                    <p className="text-xs font-mono text-muted-foreground">
                      {mapping.lookupTargetValue}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs">Default</Label>
                    <p className="text-xs font-mono text-muted-foreground">
                      {mapping.lookupDefaultValue}
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
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
              <li>Click a column to enable it</li>
              <li>Check the <strong>Use VLOOKUP</strong> checkbox</li>
              <li>Select the lookup source column</li>
              <li>Specify the target value and defaults</li>
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
            <Select value={selectedColumn?.toString() || ''}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select column to test" />
              </SelectTrigger>
              <SelectContent>
                {lookupMappings.map((m, idx) => (
                  <SelectItem key={idx} value={idx.toString()} className="text-xs">
                    {m.pgColumn}
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

            <Button className="w-full h-8 text-xs">Test Lookup</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
