#!/usr/bin/env tsx

/**
 * Migration script to move existing local files to S3
 * 
 * This script:
 * 1. Scans the local uploads/ directory for files
 * 2. Uploads them to S3 using the MediaService
 * 3. Updates database records with new S3 URLs
 * 4. Optionally removes local files after successful migration
 * 
 * Usage:
 *   npx tsx scripts/migrate-local-files-to-s3.ts [--dry-run] [--remove-local]
 */

import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { mediaService } from '../server/services/MediaService';
import { getStorage } from '../server/storage';
import mime from 'mime-types';

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const readFile = promisify(fs.readFile);
const unlink = promisify(fs.unlink);

interface MigrationOptions {
  dryRun: boolean;
  removeLocal: boolean;
  uploadsDir: string;
}

interface FileToMigrate {
  localPath: string;
  relativePath: string;
  stats: fs.Stats;
  mimeType: string;
  folder: string;
}

async function scanUploadsDirectory(uploadsDir: string): Promise<FileToMigrate[]> {
  const files: FileToMigrate[] = [];
  
  async function scanDir(dirPath: string, baseDir: string = ''): Promise<void> {
    const entries = await readdir(dirPath);
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry);
      const relativePath = path.join(baseDir, entry);
      const stats = await stat(fullPath);
      
      if (stats.isDirectory()) {
        // Recursively scan subdirectories
        await scanDir(fullPath, relativePath);
      } else if (stats.isFile()) {
        // Skip system files and temp files
        if (entry.startsWith('.') || entry.endsWith('.tmp')) {
          continue;
        }
        
        const mimeType = mime.lookup(fullPath) || 'application/octet-stream';
        const folder = baseDir || 'general';
        
        files.push({
          localPath: fullPath,
          relativePath,
          stats,
          mimeType,
          folder,
        });
      }
    }
  }
  
  if (fs.existsSync(uploadsDir)) {
    await scanDir(uploadsDir);
  }
  
  return files;
}

async function migrateFile(file: FileToMigrate, options: MigrationOptions): Promise<boolean> {
  try {
    console.log(`Migrating: ${file.relativePath} (${(file.stats.size / 1024 / 1024).toFixed(2)} MB)`);
    
    if (options.dryRun) {
      console.log(`  [DRY RUN] Would migrate to S3: tenants/1/${file.folder}/${path.basename(file.localPath)}`);
      return true;
    }
    
    // Read file content
    const buffer = await readFile(file.localPath);
    
    // Migrate to S3
    const fileRecord = await mediaService.migrateLocalFile(
      file.localPath,
      buffer,
      path.basename(file.localPath),
      file.mimeType,
      {
        tenantId: 1, // Default tenant ID - adjust as needed
        uploadedBy: 1, // Default user ID - adjust as needed  
        folder: file.folder,
      }
    );
    
    console.log(`  ✓ Migrated to S3: ${fileRecord.publicUrl}`);
    
    // Remove local file if requested
    if (options.removeLocal) {
      await unlink(file.localPath);
      console.log(`  ✓ Removed local file: ${file.localPath}`);
    }
    
    return true;
  } catch (error) {
    console.error(`  ✗ Failed to migrate ${file.relativePath}:`, error);
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const options: MigrationOptions = {
    dryRun: args.includes('--dry-run'),
    removeLocal: args.includes('--remove-local'),
    uploadsDir: path.join(process.cwd(), 'uploads'),
  };
  
  console.log('🚀 Local to S3 Migration Script');
  console.log('================================');
  console.log(`Uploads directory: ${options.uploadsDir}`);
  console.log(`Dry run: ${options.dryRun ? 'YES' : 'NO'}`);
  console.log(`Remove local files: ${options.removeLocal ? 'YES' : 'NO'}`);
  console.log('');
  
  // Validate S3 configuration
  if (!options.dryRun) {
    try {
      const isValid = await mediaService.validateConfiguration();
      if (!isValid) {
        console.error('❌ S3 configuration is invalid');
        process.exit(1);
      }
      console.log('✅ S3 configuration is valid');
    } catch (error) {
      console.error('❌ Error validating S3 configuration:', error);
      process.exit(1);
    }
    console.log('');
  }
  
  // Scan for files to migrate
  console.log('📁 Scanning uploads directory...');
  const filesToMigrate = await scanUploadsDirectory(options.uploadsDir);
  
  if (filesToMigrate.length === 0) {
    console.log('No files found to migrate.');
    return;
  }
  
  console.log(`Found ${filesToMigrate.length} files to migrate`);
  
  let successCount = 0;
  let errorCount = 0;
  
  // Migrate files
  for (const file of filesToMigrate) {
    const success = await migrateFile(file, options);
    if (success) {
      successCount++;
    } else {
      errorCount++;
    }
  }
  
  // Summary
  console.log('');
  console.log('✅ Migration Summary');
  console.log('===================');
  console.log(`Total files processed: ${filesToMigrate.length}`);
  console.log(`Successfully migrated: ${successCount}`);
  console.log(`Failed: ${errorCount}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
} 