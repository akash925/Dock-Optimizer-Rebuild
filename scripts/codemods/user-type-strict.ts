#!/usr/bin/env tsx
/**
 * Phase 3 Codemod: User Type Strictness
 * 
 * Goals:
 * 1. Augment global User interface (id, role, username, tenantId)
 * 2. Add declare global augmentation for Express.Request['user']
 * 3. Insert explicit type guards where we assume req.user!
 * 4. Fix property access issues on User objects
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

interface TransformStats {
  filesProcessed: number;
  userPropertyFixes: number;
  typeGuardAdditions: number;
  interfaceAugmentations: number;
}

class UserTypeStrictCodemod {
  private stats: TransformStats = {
    filesProcessed: 0,
    userPropertyFixes: 0,
    typeGuardAdditions: 0,
    interfaceAugmentations: 0
  };

  async run(pattern: string) {
    console.log('🚀 Starting Phase 3: User Type Strictness Codemod');
    console.log(`📁 Pattern: ${pattern}`);
    
    // First, update the main express.d.ts with comprehensive User type
    await this.updateExpressTypes();
    
    // Find all TypeScript files matching the pattern
    const files = await glob(pattern, { ignore: ['node_modules/**', 'dist/**', '.tmp/**'] });
    
    console.log(`📄 Found ${files.length} files to process`);
    
    for (const filePath of files) {
      await this.processFile(filePath);
    }
    
    this.printStats();
  }

  private async updateExpressTypes() {
    const expressTypesPath = 'server/types/express.d.ts';
    
    const updatedContent = `declare module "express-serve-static-core" {
  interface Request {
    user?: {
      id: number;
      role: string;
      username: string;
      tenantId: number | null;
      email?: string;
      firstName?: string;
      lastName?: string;
    };
    isAuthenticated?: () => boolean;
  }
}

export interface AuthenticatedRequest extends Request {
  user: NonNullable<Request['user']>;
}

// Type guard helper
export function isAuthenticated(req: Request): req is AuthenticatedRequest {
  return req.isAuthenticated?.() === true && req.user != null;
}`;

    await fs.promises.writeFile(expressTypesPath, updatedContent);
    this.stats.interfaceAugmentations++;
    console.log('✅ Updated express.d.ts with strict User interface');
  }

  private async processFile(filePath: string) {
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const originalContent = content;
      let transformedContent = content;

      // Apply transformations
      transformedContent = this.fixUserPropertyAccess(transformedContent, filePath);
      transformedContent = this.addTypeGuards(transformedContent, filePath);
      transformedContent = this.fixImplicitAnyTypes(transformedContent, filePath);
      transformedContent = this.addRequiredImports(transformedContent, filePath);

      // Write back if changed
      if (transformedContent !== originalContent) {
        await fs.promises.writeFile(filePath, transformedContent);
        this.stats.filesProcessed++;
        console.log(`✅ Transformed: ${filePath}`);
      }
    } catch (error) {
      console.error(`❌ Error processing ${filePath}:`, error);
    }
  }

  private fixUserPropertyAccess(content: string, filePath: string): string {
    let result = content;
    
    // Fix req.user?.role patterns to use proper typing
    const userAccessPatterns = [
      // Fix req.user?.role patterns
      {
        pattern: /req\.user\?\.(role|id|username|tenantId)/g,
        replacement: 'req.user?.$1'
      },
      // Fix req.user!.role patterns with type assertions
      {
        pattern: /req\.user!\.(role|id|username|tenantId)/g,
        replacement: '(req.user as NonNullable<typeof req.user>).$1'
      },
      // Fix direct req.user.role without null checks
      {
        pattern: /(?<!req\.user\?\.|\(req\.user as [^)]+\)\.)req\.user\.(role|id|username|tenantId)/g,
        replacement: 'req.user?.$1'
      }
    ];

    for (const { pattern, replacement } of userAccessPatterns) {
      const matches = result.match(pattern);
      if (matches) {
        result = result.replace(pattern, replacement);
        this.stats.userPropertyFixes += matches.length;
      }
    }

    return result;
  }

  private addTypeGuards(content: string, filePath: string): string {
    let result = content;

    // Add authentication check at the start of route handlers
    const routeHandlerPattern = /app\.(get|post|put|delete|patch)\([^,]+,\s*async\s*\(\s*req:\s*Request,\s*res:\s*Response\s*\)\s*=>\s*\{/g;
    
    result = result.replace(routeHandlerPattern, (match) => {
      this.stats.typeGuardAdditions++;
      return match + '\n    if (!isAuthenticated(req)) {\n      return res.status(401).json({ error: "Authentication required" });\n    }';
    });

    // Add type guards for middleware functions
    const middlewarePattern = /export\s+const\s+\w+\s*=\s*\(\s*req:\s*Request,\s*res:\s*Response,\s*next:\s*NextFunction\s*\)\s*=>\s*\{/g;
    
    result = result.replace(middlewarePattern, (match) => {
      if (content.includes('req.user')) {
        this.stats.typeGuardAdditions++;
        return match + '\n  if (!req.isAuthenticated?.()) {\n    return res.status(401).json({ error: "Authentication required" });\n  }';
      }
      return match;
    });

    return result;
  }

  private fixImplicitAnyTypes(content: string, filePath: string): string {
    let result = content;

    // Fix common implicit any patterns in route handlers
    const parameterTypeFixes = [
      // Fix req: any, res: any patterns
      {
        pattern: /\(\s*req:\s*any\s*,\s*res:\s*any\s*\)/g,
        replacement: '(req: Request, res: Response)'
      },
      {
        pattern: /\(\s*req,\s*res\s*\)/g,
        replacement: '(req: Request, res: Response)'
      },
      // Fix next: any patterns
      {
        pattern: /,\s*next:\s*any\s*\)/g,
        replacement: ', next: NextFunction)'
      }
    ];

    for (const { pattern, replacement } of parameterTypeFixes) {
      if (pattern.test(result)) {
        result = result.replace(pattern, replacement);
      }
    }

    return result;
  }

  private addRequiredImports(content: string, filePath: string): string {
    let result = content;

    // Check if we need to add isAuthenticated import
    if (result.includes('isAuthenticated(req)') && !result.includes('import') && !result.includes('isAuthenticated')) {
      const importStatement = 'import type { Request, Response, NextFunction } from \'express\';\nimport { isAuthenticated } from \'../types/express\';\n';
      result = importStatement + result;
    }

    return result;
  }

  private printStats() {
    console.log('\n📊 Transformation Statistics:');
    console.log(`Files processed: ${this.stats.filesProcessed}`);
    console.log(`User property fixes: ${this.stats.userPropertyFixes}`);
    console.log(`Type guard additions: ${this.stats.typeGuardAdditions}`);
    console.log(`Interface augmentations: ${this.stats.interfaceAugmentations}`);
    console.log('\n✅ Phase 3 User Type Strictness Codemod Complete');
  }
}

// CLI execution
async function main() {
  const pattern = process.argv[2] || 'server/**/*.ts';
  const codemod = new UserTypeStrictCodemod();
  await codemod.run(pattern);
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default UserTypeStrictCodemod; 