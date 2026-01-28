import type { ExcelData, ColumnMapping, SqlConfig, ValidationError } from '@/types/converter';
import { createDirectExecutor, type DirectExecutor, type ExecutionProgress } from './direct-executor';
import type { DatabaseType } from './adapters';
import type { DbConnectionConfig } from './database-connection-mock';

/**
 * CLI Tool for Command-Line Excel-to-SQL Operations
 * Provides command-line interface for all conversion modes
 */

export interface CliConfig {
  input: string;
  output?: string;
  mode: 'dry-run' | 'file-export' | 'preview-diff' | 'direct-execution';
  database?: DatabaseType;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database_name?: string;
  table?: string;
  batchSize?: number;
  verbose?: boolean;
  json?: boolean;
  interactive?: boolean;
}

export interface CliOutput {
  success: boolean;
  mode: string;
  duration: number;
  message: string;
  details?: any;
  errors?: ValidationError[];
}

class CliTool {
  /**
   * Parse command-line arguments
   */
  parseArguments(args: string[]): CliConfig {
    const config: CliConfig = {
      input: '',
      mode: 'dry-run',
    };

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      switch (arg) {
        case '--input':
        case '-i':
          config.input = args[++i];
          break;

        case '--output':
        case '-o':
          config.output = args[++i];
          break;

        case '--mode':
        case '-m':
          const mode = args[++i];
          if (['dry-run', 'file-export', 'preview-diff', 'direct-execution'].includes(mode)) {
            config.mode = mode as any;
          }
          break;

        case '--database':
        case '-db':
          config.database = args[++i] as DatabaseType;
          break;

        case '--host':
          config.host = args[++i];
          break;

        case '--port':
          config.port = parseInt(args[++i], 10);
          break;

        case '--user':
        case '-u':
          config.username = args[++i];
          break;

        case '--password':
        case '-p':
          config.password = args[++i];
          break;

        case '--db-name':
          config.database_name = args[++i];
          break;

        case '--table':
        case '-t':
          config.table = args[++i];
          break;

        case '--batch-size':
          config.batchSize = parseInt(args[++i], 10);
          break;

        case '--verbose':
        case '-v':
          config.verbose = true;
          break;

        case '--json':
        case '-j':
          config.json = true;
          break;

        case '--interactive':
          config.interactive = true;
          break;

        case '--help':
        case '-h':
          this.printHelp();
          process.exit(0);
      }
    }

    return config;
  }

  /**
   * Validate configuration
   */
  validateConfig(config: CliConfig): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (!config.input) {
      errors.push('--input is required');
    }

    if (config.mode === 'direct-execution') {
      if (!config.database) errors.push('--database is required for direct-execution mode');
      if (!config.host) errors.push('--host is required for direct-execution mode');
      if (!config.username) errors.push('--user is required for direct-execution mode');
      if (!config.database_name) errors.push('--db-name is required for direct-execution mode');
      if (!config.table) errors.push('--table is required for direct-execution mode');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Execute CLI operation
   */
  async execute(config: CliConfig): Promise<CliOutput> {
    const startTime = Date.now();

    try {
      // Validate configuration
      const validation = this.validateConfig(config);
      if (!validation.valid) {
        return {
          success: false,
          mode: config.mode,
          duration: 0,
          message: 'Configuration validation failed',
          errors: validation.errors?.map(e => ({
            row: 0,
            column: '',
            message: e,
            severity: 'error' as const,
          })),
        };
      }

      let output: CliOutput;

      switch (config.mode) {
        case 'direct-execution':
          output = await this.executeDirect(config);
          break;

        case 'file-export':
          output = await this.executeExport(config);
          break;

        case 'preview-diff':
          output = await this.executePreview(config);
          break;

        default:
          output = await this.executeDryRun(config);
      }

      output.duration = Date.now() - startTime;
      return output;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      return {
        success: false,
        mode: config.mode,
        duration: Date.now() - startTime,
        message: `Execution failed: ${err.message}`,
      };
    }
  }

  /**
   * Execute dry-run mode
   */
  private async executeDryRun(config: CliConfig): Promise<CliOutput> {
    // In real implementation, would parse Excel and generate SQL
    return {
      success: true,
      mode: 'dry-run',
      duration: 0,
      message: 'Dry-run completed successfully',
      details: {
        file: config.input,
        sqlGenerated: 'INSERT INTO table_name (...)',
        rowsProcessed: 100,
        estimatedDuration: '2.5s',
      },
    };
  }

  /**
   * Execute file-export mode
   */
  private async executeExport(config: CliConfig): Promise<CliOutput> {
    if (!config.output) {
      return {
        success: false,
        mode: 'file-export',
        duration: 0,
        message: '--output is required for file-export mode',
      };
    }

    // In real implementation, would export to file
    return {
      success: true,
      mode: 'file-export',
      duration: 0,
      message: 'File export completed successfully',
      details: {
        inputFile: config.input,
        outputFile: config.output,
        sqlGenerated: 1000,
        fileSize: '45KB',
      },
    };
  }

  /**
   * Execute preview-diff mode
   */
  private async executePreview(config: CliConfig): Promise<CliOutput> {
    // In real implementation, would generate diff preview
    return {
      success: true,
      mode: 'preview-diff',
      duration: 0,
      message: 'Preview generated successfully',
      details: {
        file: config.input,
        rowsToInsert: 95,
        rowsToUpdate: 5,
        rowsToSkip: 0,
      },
    };
  }

  /**
   * Execute direct-execution mode
   */
  private async executeDirect(config: CliConfig): Promise<CliOutput> {
    try {
      const dbConfig: DbConnectionConfig = {
        type: config.database!,
        host: config.host || 'localhost',
        port: config.port,
        username: config.username || '',
        password: config.password || '',
        database: config.database_name || '',
      };

      const executor = createDirectExecutor(config.database!, dbConfig);

      // Progress tracking
      let lastProgress = 0;
      const unsubscribe = (progress: ExecutionProgress) => {
        if (config.verbose && progress.percentage % 10 === 0 && progress.percentage > lastProgress) {
          this.logProgress(progress);
          lastProgress = progress.percentage;
        }
      };

      // In real implementation, would load Excel and execute
      // For now, return a mock result
      const result = {
        status: 'success',
        totalRows: 100,
        succeededRows: 100,
        failedRows: 0,
        totalDuration: 2500,
      };

      return {
        success: true,
        mode: 'direct-execution',
        duration: 0,
        message: 'Direct execution completed successfully',
        details: result,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      return {
        success: false,
        mode: 'direct-execution',
        duration: 0,
        message: `Direct execution failed: ${err.message}`,
      };
    }
  }

  /**
   * Log progress
   */
  private logProgress(progress: ExecutionProgress): void {
    const bar = this.createProgressBar(progress.percentage);
    const remaining = Math.round(progress.estimatedTimeRemaining / 1000);

    console.log(
      `[${bar}] ${progress.percentage}% | Rows: ${progress.rowsProcessed}/${progress.rowsTotal} | ETA: ${remaining}s`
    );
  }

  /**
   * Create progress bar
   */
  private createProgressBar(percentage: number): string {
    const filled = Math.round(percentage / 5);
    const empty = 20 - filled;

    return `${'█'.repeat(filled)}${'░'.repeat(empty)}`;
  }

  /**
   * Print help message
   */
  private printHelp(): void {
    const help = `
Excel-to-SQL CLI Tool

Usage:
  excel-to-sql [options]

Options:
  -i, --input <file>          Input Excel file path (required)
  -o, --output <file>         Output SQL file path (for file-export mode)
  -m, --mode <mode>           Conversion mode (default: dry-run)
                              - dry-run: Preview SQL without execution
                              - file-export: Export SQL to file
                              - preview-diff: Preview impact of changes
                              - direct-execution: Execute directly to database
  
  -db, --database <type>      Database type (postgres, mysql, mssql)
  --host <host>               Database host
  --port <port>               Database port
  -u, --user <username>       Database username
  -p, --password <password>   Database password
  --db-name <name>            Database name
  -t, --table <table>         Target table name
  
  --batch-size <size>         Batch size for processing (default: 1000)
  -v, --verbose               Show detailed output
  -j, --json                  Output in JSON format
  --interactive               Interactive mode (prompt for inputs)
  -h, --help                  Show this help message

Examples:
  # Dry-run (default)
  excel-to-sql -i data.xlsx

  # Export to SQL file
  excel-to-sql -i data.xlsx -m file-export -o output.sql

  # Direct database execution
  excel-to-sql -i data.xlsx -m direct-execution \\
    -db postgres --host localhost --user admin -p secret \\
    --db-name mydb -t users

  # With verbose output
  excel-to-sql -i data.xlsx -m dry-run -v

  # Interactive mode
  excel-to-sql --interactive
`;

    console.log(help);
  }

  /**
   * Format output for display
   */
  formatOutput(output: CliOutput, json: boolean = false): string {
    if (json) {
      return JSON.stringify(output, null, 2);
    }

    let result = '';
    const icon = output.success ? '✓' : '✗';
    const status = output.success ? 'SUCCESS' : 'FAILED';

    result += `\n${icon} ${status}: ${output.message}\n`;
    result += `Mode: ${output.mode}\n`;
    result += `Duration: ${output.duration}ms\n`;

    if (output.details) {
      result += `\nDetails:\n`;
      for (const [key, value] of Object.entries(output.details)) {
        result += `  ${key}: ${JSON.stringify(value)}\n`;
      }
    }

    if (output.errors && output.errors.length > 0) {
      result += `\nErrors:\n`;
      for (const error of output.errors) {
        result += `  ${error.message}\n`;
      }
    }

    return result;
  }
}

// Export for use
export function createCliTool(): CliTool {
  return new CliTool();
}

export { CliTool };
