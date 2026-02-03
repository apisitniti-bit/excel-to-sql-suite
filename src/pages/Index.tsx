import { useState, useCallback, useMemo, useEffect } from 'react';
import { Database, ArrowRight, ArrowLeft, FileSpreadsheet, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FileUpload } from '@/components/FileUpload';
import { DataPreview } from '@/components/DataPreview';
import { ColumnMappingPanel } from '@/components/ColumnMappingPanel';
import { SqlConfigPanel } from '@/components/SqlConfigPanel';
import { SqlPreview } from '@/components/SqlPreview';
import { IconThemeToggle } from '@/components/IconThemeToggle';
import { parseExcelFile, analyzeColumns } from '@/lib/excel-parser';
import { generateSQL } from '@/lib/sql-generator';
import { applyDefaults, getDefaultSqlConfig, updateConfigWithPrimaryKey } from '@/lib/defaults';
import { validateExcelData, hasValidationErrors } from '@/lib/validation';
import type { 
  ExcelData, 
  ExcelColumn, 
  ColumnMapping, 
  SqlConfig, 
  SqlMode,
  ValidationError 
} from '@/types/converter';
import { toast } from 'sonner';

const DEFAULT_CONFIG: SqlConfig = getDefaultSqlConfig('my_table');

export default function Index() {
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview'>('upload');
  const [isLoading, setIsLoading] = useState(false);
  const [excelData, setExcelData] = useState<ExcelData | null>(null);
  const [columns, setColumns] = useState<ExcelColumn[]>([]);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [config, setConfig] = useState<SqlConfig>(DEFAULT_CONFIG);
  const [sql, setSql] = useState<string>('');
  const [errors, setErrors] = useState<ValidationError[]>([]);

  const handleFileSelect = useCallback(async (file: File) => {
    console.log('[Index] File selected:', file.name, 'size:', file.size);
    setIsLoading(true);
    try {
      const data = await parseExcelFile(file);
      console.log('[Index] Parsed data:', {
        headers: data.headers.length,
        rows: data.rows.length,
        fileName: data.fileName
      });
      setExcelData(data);
      
      const analyzedColumns = analyzeColumns(data);
      console.log('[Index] Analyzed columns:', analyzedColumns.length);
      
      // Apply defaults: all columns TEXT, first column as PK
      const { columns: defaultedColumns, mappings: defaultMappings } = applyDefaults(data, analyzedColumns);
      console.log('[Index] Defaults applied:', {
        columns: defaultedColumns.length,
        mappings: defaultMappings.length
      });
      setColumns(defaultedColumns);
      setMappings(defaultMappings);
      
      // Validate data (check for duplicate PKs, etc)
      const validationErrors = validateExcelData(data, defaultMappings);
      setErrors(validationErrors);
      
      if (validationErrors.length > 0) {
        const errorCount = validationErrors.filter(e => e.severity === 'error').length;
        const hasDupError = validationErrors.some(e => e.message.includes('Duplicated Key'));
        
        if (hasDupError) {
          toast.error('Duplicated Key - Fix primary key conflicts before proceeding');
        } else {
          toast.error(`Found ${errorCount} validation error(s)`);
        }
      }
      
      setStep('mapping');
      toast.success(`Loaded ${data.totalRows.toLocaleString()} rows from ${data.fileName}`);
    } catch (error) {
      console.error('[Index] Failed to parse Excel file:', error);
      toast.error(`Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Auto-generate SQL when mappings or config change
  useEffect(() => {
    if (excelData && mappings.length > 0) {
      // Update config with primary keys from mappings
      const primaryKeys = mappings.filter(m => m.isPrimaryKey).map(m => m.pgColumn);
      setConfig(c => ({ ...c, primaryKey: primaryKeys, conflictKeys: primaryKeys }));
    }
  }, [mappings, excelData]);

  const handleGenerateSQL = useCallback(() => {
    if (!excelData) return;
    
    // Update config with primary key from mappings
    const updatedConfig = updateConfigWithPrimaryKey(config, mappings);
    setConfig(updatedConfig);
    
    // Validate data before generation
    const validationErrors = validateExcelData(excelData, mappings);
    
    // Check for blocking errors
    if (hasValidationErrors(validationErrors)) {
      setErrors(validationErrors);
      const duplicateKeyError = validationErrors.some(e => e.message.includes('Duplicated Key'));
      
      if (duplicateKeyError) {
        toast.error('Cannot generate SQL: Duplicated Key values detected. Please fix primary key conflicts first.');
      } else {
        toast.error(`Cannot generate SQL: ${validationErrors.filter(e => e.severity === 'error').length} validation error(s) found`);
      }
      return;
    }
    
    const result = generateSQL(excelData, mappings, updatedConfig);
    setSql(result.sql);
    setErrors(result.errors);
    setStep('preview');
    
    if (result.errors.length === 0) {
      toast.success('SQL generated successfully!');
    } else {
      toast.warning(`Generated with ${result.errors.length} validation issues`);
    }
  }, [excelData, mappings, config]);

  const handleModeChange = (mode: SqlMode) => {
    setConfig(c => ({ ...c, mode }));
  };

  const handleReset = () => {
    setStep('upload');
    setExcelData(null);
    setColumns([]);
    setMappings([]);
    setConfig(DEFAULT_CONFIG);
    setSql('');
    setErrors([]);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Database className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-semibold text-sm">Excel2SQL</h1>
              <p className="text-xs text-muted-foreground">PostgreSQL Converter</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {excelData && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs">
                  <FileSpreadsheet className="w-3 h-3 mr-1" />
                  {excelData.fileName}
                </Badge>
                <Select value={config.mode} onValueChange={handleModeChange}>
                  <SelectTrigger className="w-32 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INSERT">INSERT</SelectItem>
                    <SelectItem value="UPDATE">UPDATE</SelectItem>
                    <SelectItem value="UPSERT">UPSERT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {step !== 'upload' && (
              <Button variant="ghost" size="sm" onClick={handleReset}>
                New File
              </Button>
            )}

            {/* Theme Toggle */}
            <IconThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container px-4 py-6 overflow-auto">
        {step === 'upload' && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] animate-slide-in">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold mb-2">Convert Excel to PostgreSQL</h2>
              <p className="text-muted-foreground max-w-md">
                Upload your Excel or CSV file to generate INSERT, UPDATE, or UPSERT SQL statements
              </p>
            </div>
            <FileUpload onFileSelect={handleFileSelect} isLoading={isLoading} />
            
            <div className="mt-12 grid grid-cols-3 gap-8 max-w-2xl">
              {[
                { icon: '📤', title: 'Upload', desc: 'Drag & drop Excel/CSV' },
                { icon: '🔗', title: 'Map', desc: 'Match columns to schema' },
                { icon: '⚡', title: 'Export', desc: 'Download .sql file' },
              ].map((item, i) => (
                <div key={i} className="text-center">
                  <div className="text-2xl mb-2">{item.icon}</div>
                  <div className="font-medium text-sm">{item.title}</div>
                  <div className="text-xs text-muted-foreground">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 'mapping' && excelData && (
          <div className="space-y-4 animate-slide-in">
            {/* Step indicator */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Badge variant="default">Step 2</Badge>
                <span className="text-sm font-medium">Configure Column Mapping</span>
              </div>
              <Button onClick={handleGenerateSQL}>
                <Zap className="w-4 h-4 mr-2" />
                Generate SQL
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-280px)]">
              {/* Excel Preview */}
              <div className="lg:col-span-5 h-full">
                <DataPreview data={excelData} />
              </div>
              
              {/* Mapping Panel */}
              <div className="lg:col-span-4 h-full">
                <ColumnMappingPanel
                  columns={columns}
                  mappings={mappings}
                  onMappingsChange={setMappings}
                />
              </div>
              
              {/* Config Panel */}
              <div className="lg:col-span-3 h-full">
                <SqlConfigPanel
                  config={config}
                  mappings={mappings}
                  onConfigChange={setConfig}
                />
              </div>
            </div>
          </div>
        )}

        {step === 'preview' && excelData && (
          <div className="space-y-4 animate-slide-in">
            {/* Step indicator */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setStep('mapping')}>
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
                <Badge variant="default">Step 3</Badge>
                <span className="text-sm font-medium">Review & Export</span>
              </div>
              <Badge variant="secondary" className="font-mono">
                {config.mode} • {excelData.totalRows.toLocaleString()} rows
              </Badge>
            </div>

            <div className="h-[calc(100vh-280px)]">
              <SqlPreview 
                sql={sql} 
                errors={errors} 
                fileName={excelData.fileName}
              />
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t bg-card/50 backdrop-blur-sm py-4 text-center text-xs text-muted-foreground shrink-0">
        <p className="m-0">Excel-HelpMe Converter • SQL injection safe • UTF-8 encoded</p>
      </footer>
    </div>
  );
}
