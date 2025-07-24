#!/usr/bin/env tsx
/**
 * Phase 4 Codemod: Fix Express Type Imports
 * 
 * Problem: Files using Request/Response types missing Express imports
 * Solution: Add "import type { Request, Response, NextFunction } from 'express'"
 */

import fs from 'fs';
import { glob } from 'glob';

interface ImportStats {
  filesProcessed: number;
  importsAdded: number;
}

class ExpressImportFixer {
  private stats: ImportStats = {
    filesProcessed: 0,
    importsAdded: 0
  };

  async run(pattern: string) {
    console.log('🔧 Starting Express Import Fix Codemod');
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

      // Skip if already has Express imports
      if (content.includes('from "express"') || content.includes("from 'express'")) {
        return;
      }

      // Check if file uses Request, Response, or NextFunction types
      const needsExpressImport = this.needsExpressImport(content);
      
      if (!needsExpressImport) {
        return;
      }

      // Add Express imports
      const transformedContent = this.addExpressImports(content);

      // Write back if changed
      if (transformedContent !== originalContent) {
        await fs.promises.writeFile(filePath, transformedContent);
        this.stats.filesProcessed++;
        this.stats.importsAdded++;
        console.log(`✅ Added Express imports: ${filePath}`);
      }
    } catch (error) {
      console.error(`❌ Error processing ${filePath}:`, error);
    }
  }

  private needsExpressImport(content: string): boolean {
    // Check for patterns that indicate Express usage
    const patterns = [
      /\breq\.params\b/,
      /\breq\.query\b/,
      /\breq\.body\b/,
      /\breq\.headers\b/,
      /\breq\.user\b/,
      /\breq\.logout\b/,
      /\breq\.isAuthenticated\b/,
      /\bres\.status\b/,
      /\bres\.json\b/,
      /\bres\.send\b/,
      /:\s*Request\b/,
      /:\s*Response\b/,
      /:\s*NextFunction\b/,
      /\(req:\s*Request/,
      /\(res:\s*Response/,
      /\(next:\s*NextFunction/
    ];

    return patterns.some(pattern => pattern.test(content));
  }

  private addExpressImports(content: string): string {
    // Find the best place to insert the import
    const lines = content.split('\n');
    let insertIndex = 0;

    // Find the last import statement
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('import ') && line.includes('from ')) {
        insertIndex = i + 1;
      } else if (line === '' && insertIndex > 0) {
        // Stop after imports and blank line
        break;
      } else if (!line.startsWith('import ') && !line.startsWith('//') && line !== '' && insertIndex > 0) {
        // Found first non-import, non-comment, non-blank line
        break;
      }
    }

    // Insert Express import
    const expressImport = "import type { Request, Response, NextFunction } from 'express';";
    lines.splice(insertIndex, 0, expressImport);

    return lines.join('\n');
  }

  private printStats() {
    console.log('\n📊 Express Import Fix Statistics:');
    console.log(`Files processed: ${this.stats.filesProcessed}`);
    console.log(`Express imports added: ${this.stats.importsAdded}`);
    console.log('\n✅ Express Import Fix Complete');
  }
}

// CLI execution
async function main() {
  const pattern = process.argv[2] || 'server/**/*.ts';
  const fixer = new ExpressImportFixer();
  await fixer.run(pattern);
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default ExpressImportFixer; 