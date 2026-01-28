import { Settings, Database, Key, Layers, Wrench, Server } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { SqlConfig, SqlMode, ColumnMapping } from '@/types/converter';
import type { DatabaseType } from '@/lib/adapters';

interface SqlConfigPanelProps {
  config: SqlConfig;
  mappings: ColumnMapping[];
  onConfigChange: (config: SqlConfig) => void;
}

export function SqlConfigPanel({ config, mappings, onConfigChange }: SqlConfigPanelProps) {
  const activeMappings = mappings.filter(m => m.pgColumn);
  const primaryKeys = activeMappings.filter(m => m.isPrimaryKey).map(m => m.pgColumn);

  const updateConfig = (updates: Partial<SqlConfig>) => {
    onConfigChange({ ...config, ...updates });
  };

  const updateOptions = (updates: Partial<SqlConfig['options']>) => {
    onConfigChange({ ...config, options: { ...config.options, ...updates } });
  };

  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header">
        <Settings className="w-4 h-4 text-primary" />
        <span>SQL Configuration</span>
      </div>

      <div className="flex-1 overflow-auto scrollbar-thin p-4 space-y-6">
        {/* Database Type */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-xs font-medium">
            <Server className="w-3 h-3" />
            Database Type
          </Label>
          <Select
            value={config.database || 'postgresql'}
            onValueChange={(value) => updateConfig({ database: value as DatabaseType })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="postgresql">PostgreSQL</SelectItem>
              <SelectItem value="mysql">MySQL</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table Name */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-xs font-medium">
            <Database className="w-3 h-3" />
            Target Table
          </Label>
          <Input
            value={config.tableName}
            onChange={(e) => updateConfig({ tableName: e.target.value })}
            placeholder="schema.table_name"
            className="font-mono text-sm"
          />
        </div>

        {/* Mode Selection */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-xs font-medium">
            <Layers className="w-3 h-3" />
            Operation Mode
          </Label>
          <Select
            value={config.mode}
            onValueChange={(value) => updateConfig({ mode: value as SqlMode })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="INSERT">INSERT - Add new rows</SelectItem>
              <SelectItem value="UPDATE">UPDATE - Modify existing rows</SelectItem>
              <SelectItem value="UPSERT">UPSERT - Insert or update</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Primary Key */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-xs font-medium">
            <Key className="w-3 h-3" />
            Primary Key Columns
          </Label>
          {primaryKeys.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {primaryKeys.map(pk => (
                <Badge key={pk} variant="secondary" className="font-mono text-xs">
                  {pk}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Mark columns as primary key in the mapping panel
            </p>
          )}
        </div>

        {/* Conflict Keys (for UPSERT) */}
        {config.mode === 'UPSERT' && (
          <div className="space-y-2">
            <Label className="text-xs font-medium">Conflict Keys</Label>
            <Select
              value={config.options.onConflictAction}
              onValueChange={(value) => updateOptions({
                onConflictAction: value as 'DO NOTHING' | 'DO UPDATE'
              })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DO UPDATE">DO UPDATE - Update on conflict</SelectItem>
                <SelectItem value="DO NOTHING">DO NOTHING - Skip on conflict</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Options */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2 text-xs font-medium">
            <Wrench className="w-3 h-3" />
            Options
          </Label>

          <div className="space-y-3 pl-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs cursor-pointer">Trim strings</Label>
              <Switch
                checked={config.options.trimStrings}
                onCheckedChange={(checked) => updateOptions({ trimStrings: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-xs cursor-pointer">Cast types</Label>
              <Switch
                checked={config.options.castTypes}
                onCheckedChange={(checked) => updateOptions({ castTypes: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-xs cursor-pointer">Wrap in transaction</Label>
              <Switch
                checked={config.options.wrapInTransaction}
                onCheckedChange={(checked) => updateOptions({ wrapInTransaction: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-xs cursor-pointer">Ignore null values</Label>
              <Switch
                checked={config.options.ignoreNullValues}
                onCheckedChange={(checked) => updateOptions({ ignoreNullValues: checked })}
              />
            </div>
          </div>
        </div>

        {/* Batch Size */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Batch Size</Label>
          <Input
            type="number"
            value={config.options.batchSize}
            onChange={(e) => updateOptions({ batchSize: parseInt(e.target.value) || 100 })}
            min={1}
            max={10000}
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">
            Number of rows per INSERT statement
          </p>
        </div>
      </div>
    </div>
  );
}
