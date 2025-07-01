import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import { join } from 'path';

interface AssetStorageService {
  putObject(key: string, buffer: Buffer, mimeType: string): Promise<string>;
}

class LocalAssetStorage implements AssetStorageService {
  private readonly baseDir = 'uploads';
  private readonly cdnBase = process.env.PUBLIC_IMG_CDN || '';

  async putObject(key: string, buffer: Buffer, mimeType: string): Promise<string> {
    // Ensure uploads directory exists
    const filePath = join(this.baseDir, key);
    const dirPath = join(this.baseDir, key.split('/').slice(0, -1).join('/'));
    
    await mkdir(dirPath, { recursive: true });
    
    // Write buffer directly to file
    const writeStream = createWriteStream(filePath);
    
    return new Promise((resolve, reject) => {
      writeStream.on('error', reject);
      writeStream.on('finish', () => {
        // Return CDN URL if configured, otherwise relative path
        const url = this.cdnBase ? `${this.cdnBase}/${key}` : `/${key}`;
        resolve(url);
      });
      
      writeStream.write(buffer);
      writeStream.end();
    });
  }
}

// Export a singleton instance
export const assetStorage = new LocalAssetStorage(); 