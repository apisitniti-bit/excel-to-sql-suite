import { ArrowRight, Link2, Unlink, Key, Hash, Type } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ExcelColumn, ColumnMapping, PostgresDataType } from '@/types/converter';

interface ColumnMappingPanelProps {
  columns: ExcelColumn[];
  mappings: ColumnMapping[];
  onMappingsChange: (mappings: ColumnMapping[]) => void;
}

const DATA_TYPES: PostgresDataType[] = [
  'TEXT',
  'VARCHAR',
  'INTEGER',
  'BIGINT',
  'DECIMAL',
  'BOOLEAN',
  'DATE',
  'TIMESTAMP',
  'TIMESTAMPTZ',
  'JSON',
  'JSONB',
  'UUID',
];

const TYPE_ICONS: Record<string, typeof Type> = {
  TEXT: Type,
  VARCHAR: Type,
  INTEGER: Hash,
  BIGINT: Hash,
  DECIMAL: Hash,
  BOOLEAN: Type,
  DATE: Type,
  TIMESTAMP: Type,
  TIMESTAMPTZ: Type,
  JSON: Type,
  JSONB: Type,
  UUID: Key,
};

export function ColumnMappingPanel({ columns, mappings, onMappingsChange }: ColumnMappingPanelProps) {
  const updateMapping = (index: number, updates: Partial<ColumnMapping>) => {
    const newMappings = [...mappings];
    newMappings[index] = { ...newMappings[index], ...updates };
    onMappingsChange(newMappings);
  };

  const toggleMapping = (index: number) => {
    const newMappings = [...mappings];
    if (newMappings[index].pgColumn) {
      newMappings[index] = { ...newMappings[index], pgColumn: '' };
    } else {
      newMappings[index] = { 
        ...newMappings[index], 
        pgColumn: columns[index].name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
      };
    }
    onMappingsChange(newMappings);
  };

  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header justify-between">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-primary" />
          <span>Column Mapping</span>
        </div>
        <Badge variant="secondary" className="text-xs">
          {mappings.filter(m => m.pgColumn).length} / {columns.length} mapped
        </Badge>
      </div>
      
      <div className="flex-1 overflow-auto scrollbar-thin p-4 space-y-3">
        {columns.map((col, index) => {
          const mapping = mappings[index];
          const isEnabled = !!mapping?.pgColumn;
          const TypeIcon = TYPE_ICONS[mapping?.dataType || 'TEXT'] || Type;
          
          return (
            <div 
              key={index}
              className={`p-3 rounded-lg border transition-all ${
                isEnabled ? 'bg-accent/30 border-primary/20' : 'bg-muted/30 border-transparent opacity-60'
              }`}
            >
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => toggleMapping(index)}
                >
                  {isEnabled ? (
                    <Link2 className="w-4 h-4 text-primary" />
                  ) : (
                    <Unlink className="w-4 h-4" />
                  )}
                </Button>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm truncate" title={col.name}>
                      {col.name}
                    </span>
                    <Badge variant="outline" className="text-xs font-normal shrink-0">
                      {col.detectedType}
                    </Badge>
                  </div>
                  {col.sampleValues.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1 truncate font-mono">
                      e.g. {col.sampleValues.slice(0, 2).join(', ')}
                    </p>
                  )}
                </div>
                
                <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                
                <div className="flex-1 min-w-0">
                  <Input
                    value={mapping?.pgColumn || ''}
                    onChange={(e) => updateMapping(index, { pgColumn: e.target.value })}
                    placeholder="pg_column_name"
                    className="font-mono text-sm h-8"
                    disabled={!isEnabled}
                  />
                </div>
                
                <Select
                  value={mapping?.dataType || col.detectedType}
                  onValueChange={(value) => updateMapping(index, { dataType: value as PostgresDataType })}
                  disabled={!isEnabled}
                >
                  <SelectTrigger className="w-32 h-8 text-xs font-mono">
                    <TypeIcon className="w-3 h-3 mr-1" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DATA_TYPES.map(type => (
                      <SelectItem key={type} value={type} className="font-mono text-xs">
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {isEnabled && (
                <div className="mt-3 pt-3 border-t flex items-center gap-6">
                  <Label className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox
                      checked={mapping?.isPrimaryKey}
                      onCheckedChange={(checked) => updateMapping(index, { isPrimaryKey: !!checked })}
                    />
                    <Key className="w-3 h-3" />
                    Primary Key
                  </Label>
                  
                  <Label className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox
                      checked={mapping?.isNullable}
                      onCheckedChange={(checked) => updateMapping(index, { isNullable: !!checked })}
                    />
                    Nullable
                  </Label>
                  
                  <Label className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox
                      checked={mapping?.isUnique}
                      onCheckedChange={(checked) => updateMapping(index, { isUnique: !!checked })}
                    />
                    Unique
                  </Label>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
