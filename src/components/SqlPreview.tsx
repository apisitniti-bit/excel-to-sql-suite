import { useMemo, useState } from 'react';
import { Code, Copy, Download, Check, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ValidationError } from '@/types/converter';
import { downloadSQL, copyToClipboard } from '@/lib/sql-generator';

interface SqlPreviewProps {
  sql: string;
  errors: ValidationError[];
  fileName: string;
}

const LINES_PER_PAGE = 50;

export function SqlPreview({ sql, errors, fileName }: SqlPreviewProps) {
  const [copied, setCopied] = useState(false);
  const [page, setPage] = useState(0);
  
  const lines = useMemo(() => sql.split('\n'), [sql]);
  const totalPages = Math.ceil(lines.length / LINES_PER_PAGE);
  const startLine = page * LINES_PER_PAGE;
  const visibleLines = lines.slice(startLine, startLine + LINES_PER_PAGE);

  const handleCopy = async () => {
    await copyToClipboard(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const baseName = fileName.replace(/\.[^/.]+$/, '');
    downloadSQL(sql, `${baseName}_${timestamp}.sql`);
  };

  const highlightSQL = (line: string): JSX.Element => {
    const keywords = /\b(SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|ALTER|DROP|INDEX|ON|AND|OR|NOT|NULL|PRIMARY|KEY|FOREIGN|REFERENCES|UNIQUE|DEFAULT|CHECK|CONSTRAINT|BEGIN|COMMIT|ROLLBACK|TRANSACTION|AS|CASE|WHEN|THEN|ELSE|END|JOIN|LEFT|RIGHT|INNER|OUTER|CROSS|ORDER|BY|GROUP|HAVING|LIMIT|OFFSET|UNION|EXCEPT|INTERSECT|IN|EXISTS|BETWEEN|LIKE|IS|TRUE|FALSE|CONFLICT|DO|NOTHING|EXCLUDED)\b/gi;
    
    const parts: JSX.Element[] = [];
    let lastIndex = 0;
    let match;
    
    // Handle comments
    if (line.trimStart().startsWith('--')) {
      return <span className="text-muted-foreground italic">{line}</span>;
    }
    
    const keywordMatches: { index: number; text: string }[] = [];
    while ((match = keywords.exec(line)) !== null) {
      keywordMatches.push({ index: match.index, text: match[0] });
    }
    
    // Build highlighted line
    let processedLine = line;
    let offset = 0;
    
    return (
      <span>
        {line.split(/(\'[^\']*\'|\b(?:SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|BEGIN|COMMIT|ON|CONFLICT|DO|NOTHING|EXCLUDED|NULL|TRUE|FALSE)\b)/gi).map((part, i) => {
          if (/^\'.*\'$/.test(part)) {
            return <span key={i} className="text-success">{part}</span>;
          }
          if (/\b(SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|BEGIN|COMMIT|ON|CONFLICT|DO|NOTHING|EXCLUDED|NULL|TRUE|FALSE)\b/i.test(part)) {
            return <span key={i} className="text-primary font-medium">{part}</span>;
          }
          return <span key={i}>{part}</span>;
        })}
      </span>
    );
  };

  const errorCount = errors.filter(e => e.severity === 'error').length;
  const warningCount = errors.filter(e => e.severity === 'warning').length;

  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header justify-between">
        <div className="flex items-center gap-2">
          <Code className="w-4 h-4 text-primary" />
          <span>SQL Preview</span>
          <Badge variant="secondary" className="font-mono text-xs">
            {lines.length} lines
          </Badge>
        </div>
        
        <div className="flex items-center gap-2">
          {errorCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              {errorCount} errors
            </Badge>
          )}
          {warningCount > 0 && (
            <Badge className="bg-warning text-warning-foreground text-xs">
              {warningCount} warnings
            </Badge>
          )}
          
          <Button variant="ghost" size="sm" onClick={handleCopy}>
            {copied ? (
              <Check className="w-4 h-4 text-success" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </Button>
          <Button variant="default" size="sm" onClick={handleDownload}>
            <Download className="w-4 h-4 mr-1" />
            Download .sql
          </Button>
        </div>
      </div>
      
      {/* Errors Panel */}
      {errors.length > 0 && (
        <div className="border-b p-3 bg-destructive/5 max-h-32 overflow-auto">
          <div className="space-y-1">
            {errors.slice(0, 10).map((error, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <AlertTriangle className={`w-3 h-3 ${
                  error.severity === 'error' ? 'text-destructive' : 'text-warning'
                }`} />
                <span className="font-mono text-muted-foreground">Row {error.row}:</span>
                <span>{error.message}</span>
              </div>
            ))}
            {errors.length > 10 && (
              <p className="text-xs text-muted-foreground">
                ... and {errors.length - 10} more
              </p>
            )}
          </div>
        </div>
      )}
      
      <div className="flex-1 overflow-auto scrollbar-thin bg-muted/30">
        <pre className="p-4 font-mono text-xs leading-relaxed">
          {visibleLines.map((line, i) => (
            <div key={i} className="flex">
              <span className="w-12 text-right pr-4 text-muted-foreground/50 select-none">
                {startLine + i + 1}
              </span>
              <span className="flex-1">{highlightSQL(line)}</span>
            </div>
          ))}
        </pre>
      </div>
      
      {totalPages > 1 && (
        <div className="border-t p-2 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Lines {startLine + 1}-{Math.min(startLine + LINES_PER_PAGE, lines.length)}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs px-2">
              {page + 1} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => p + 1)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
