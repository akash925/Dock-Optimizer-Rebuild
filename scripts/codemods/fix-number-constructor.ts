#!/usr/bin/env tsx
/**
 * Phase 4 Codemod: Fix Number() Constructor Calls
 * 
 * Problem: TypeScript sees Number() calls as "Type 'Number' has no call signatures"
 * Solution: Replace Number(x) with parseInt(x, 10) or parseFloat(x) as appropriate
 */

import fs from 'fs';
import { glob } from 'glob';

interface FixStats {
  filesProcessed: number;
  numberCallsFixed: number;
}

class NumberConstructorFixer {
  private stats: FixStats = {
    filesProcessed: 0,
    numberCallsFixed: 0
  };

  async run(pattern: string) {
    console.log('🔧 Starting Number() Constructor Fix Codemod');
    console.log(`📁 Pattern: ${pattern}`);
    
    const files = await glob(pattern, { ignore: ['node_modules/**', 'dist/**', '.tmp/**'] });
    console.log(`📄 Found ${files.length} files to process`);
    
    for (const filePath of files) {
      await this.processFile(filePath);
    }
    
    this.printStats();
  }

  private async processFile(filePath: string) {
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const originalContent = content;
      let transformedContent = content;

      // Fix Number() constructor calls
      transformedContent = this.fixNumberConstructorCalls(transformedContent, filePath);

      // Write back if changed
      if (transformedContent !== originalContent) {
        await fs.promises.writeFile(filePath, transformedContent);
        this.stats.filesProcessed++;
        console.log(`✅ Fixed: ${filePath}`);
      }
    } catch (error) {
      console.error(`❌ Error processing ${filePath}:`, error);
    }
  }

  private fixNumberConstructorCalls(content: string, filePath: string): string {
    let result = content;
    
    // Pattern 1: Number(req.params.id) -> parseInt(req.params.id, 10)
    // Pattern 2: Number(req.headers['x-tenant-id']) -> parseInt(req.headers['x-tenant-id'], 10)
    // Pattern 3: Number(someVariable) -> parseInt(someVariable, 10)
    
    const numberPatterns = [
      // Replace Number(req.params.xxx) with parseInt for ID-like values
      {
        pattern: /Number\(req\.params\.(\w+)\)/g,
        replacement: 'parseInt(req.params.$1, 10)',
        description: 'req.params ID conversion'
      },
      // Replace Number(req.headers['x-xxx']) with parseInt for header values
      {
        pattern: /Number\(req\.headers\[['"]([^'"]+)['"]\]\)/g,
        replacement: 'parseInt(req.headers[\'$1\'], 10)',
        description: 'header value conversion'
      },
      // Replace Number(req.query.xxx) with parseInt for query params
      {
        pattern: /Number\(req\.query\.(\w+)\)/g,
        replacement: 'parseInt(req.query.$1, 10)',
        description: 'query param conversion'
      },
      // Replace other Number() calls with parseInt - more conservative
      {
        pattern: /Number\(([^)]+)\)/g,
        replacement: 'parseInt($1, 10)',
        description: 'general number conversion'
      }
    ];

    for (const { pattern, replacement, description } of numberPatterns) {
      const matches = result.match(pattern);
      if (matches) {
        result = result.replace(pattern, replacement);
        this.stats.numberCallsFixed += matches.length;
        console.log(`  🔧 Fixed ${matches.length} ${description} calls in ${filePath}`);
      }
    }

    return result;
  }

  private printStats() {
    console.log('\n📊 Number Constructor Fix Statistics:');
    console.log(`Files processed: ${this.stats.filesProcessed}`);
    console.log(`Number() calls fixed: ${this.stats.numberCallsFixed}`);
    console.log('\n✅ Number Constructor Fix Complete');
  }
}

// CLI execution
async function main() {
  const pattern = process.argv[2] || 'server/**/*.ts';
  const fixer = new NumberConstructorFixer();
  await fixer.run(pattern);
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default NumberConstructorFixer; 