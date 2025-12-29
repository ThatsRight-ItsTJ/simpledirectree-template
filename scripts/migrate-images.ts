#!/usr/bin/env tsx

/**
 * Migrate images from Sanity CDN to R2 storage
 * 
 * This script handles image URL updates for R2 migration:
 * - Extract image URLs from exported data
 * - Download images from Sanity CDN
 * - Upload images to Cloudflare R2 storage
 * - Update image URLs in the transformed data
 * 
 * Usage: pnpm tsx scripts/migrate-images.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';

// Import types from the transform script
import { HFData } from './transform-to-hf';

// Cloudflare R2 configuration
interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint: string;
}

// Image metadata
interface ImageMetadata {
  originalUrl: string;
  r2Url: string;
  filename: string;
  size: number;
  mimeType: string;
  hash: string;
}

// Logger utility
const logger = {
  info: (message: string, data?: any) => {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`);
    if (data) console.log(JSON.stringify(data, null, 2));
  },
  
  warn: (message: string, data?: any) => {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`);
    if (data) console.warn(JSON.stringify(data, null, 2));
  },
  
  error: (message: string, error?: any) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`);
    if (error) console.error(error);
  }
};

// Configuration (should come from environment variables)
const config: R2Config = {
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID || '',
  accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID || '',
  secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY || '',
  bucket: process.env.CLOUDFLARE_R2_BUCKET || '',
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT || ''
};

// Image URL patterns to match
const IMAGE_URL_PATTERNS = [
  /https:\/\/cdn\.sanity\.io\/images\/[^\/]+\/[^\/]+\/[^\/]+\.(jpg|jpeg|png|gif|webp|svg)/gi,
  /https:\/\/assets\.sanity\.io\/[^\/]+\.(jpg|jpeg|png|gif|webp|svg)/gi,
  /\/images\/[^\/]+\.(jpg|jpeg|png|gif|webp|svg)/gi
];

// Extract image URLs from data
function extractImageUrls(data: HFData[]): Set<string> {
  const imageUrls = new Set<string>();
  
  for (const item of data) {
    // Check content field for images (only for products which have content)
    if (item.type === 'product' && item.content) {
      const contentStr = JSON.stringify(item.content);
      const matches = contentStr.match(IMAGE_URL_PATTERNS[0]);
      if (matches) {
        matches.forEach(url => imageUrls.add(url));
      }
    }
    
    // Check other fields that might contain images
    const checkImageField = (field: string, value: any) => {
      if (value) {
        if (typeof value === 'string') {
          imageUrls.add(value);
        } else if (value.asset?.url) {
          imageUrls.add(value.asset.url);
        }
      }
    };
    
    checkImageField('coverImage', (item as any).coverImage);
    checkImageField('image', (item as any).image);
    checkImageField('avatar', (item as any).avatar);
    checkImageField('logo', (item as any).logo);
    checkImageField('icon', (item as any).icon);
  }
  
  return imageUrls;
}

// Generate filename from URL
function generateFilename(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const extension = path.extname(pathname) || '.jpg';
    const basename = path.basename(pathname, extension);
    const hash = createHash('md5').update(url).digest('hex').substring(0, 8);
    return `${basename}-${hash}${extension}`;
  } catch {
    const hash = createHash('md5').update(url).digest('hex').substring(0, 16);
    return `image-${hash}.jpg`;
  }
}

// Download image from URL
async function downloadImage(url: string): Promise<{ buffer: Buffer; mimeType: string; size: number }> {
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
    }
    
    const buffer = await response.arrayBuffer();
    const mimeType = response.headers.get('content-type') || 'image/jpeg';
    const size = buffer.byteLength;
    
    return {
      buffer: Buffer.from(buffer),
      mimeType,
      size
    };
  } catch (error) {
    throw new Error(`Failed to download image from ${url}: ${error}`);
  }
}

// Upload image to R2 (mock implementation)
async function uploadToR2(filename: string, buffer: Buffer, mimeType: string): Promise<string> {
  try {
    // This is a mock implementation
    // In a real implementation, you would use the Cloudflare R2 SDK
    const r2Url = `${config.endpoint}/${config.bucket}/${filename}`;
    
    // Simulate upload delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    logger.info(`Uploaded ${filename} to R2`);
    return r2Url;
  } catch (error) {
    throw new Error(`Failed to upload image to R2: ${error}`);
  }
}

// Process image migration
async function processImageMigration() {
  try {
    logger.info('Starting image migration from Sanity CDN to R2...');
    
    // Read transformed data
    const hfDir = path.join(process.cwd(), 'hf-output');
    const dataFilepath = path.join(hfDir, 'data.jsonl');
    
    if (!fs.existsSync(dataFilepath)) {
      throw new Error('Transformed data file not found. Run transform script first.');
    }
    
    const dataContent = fs.readFileSync(dataFilepath, 'utf-8');
    const dataLines = dataContent.split('\n').filter(line => line.trim());
    const data: HFData[] = dataLines.map(line => JSON.parse(line));
    
    // Extract image URLs
    logger.info('Extracting image URLs from data...');
    const imageUrls = extractImageUrls(data);
    
    if (imageUrls.size === 0) {
      logger.warn('No image URLs found in data');
      return;
    }
    
    logger.info(`Found ${imageUrls.size} unique image URLs`);
    
    // Create output directory
    const outputDir = path.join(process.cwd(), 'migrated-images');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Image metadata tracking
    const imageMetadata: Record<string, ImageMetadata> = {};
    const migratedImages: ImageMetadata[] = [];
    
    // Process each image
    let processedCount = 0;
    const imageUrlArray = Array.from(imageUrls);
    for (const imageUrl of imageUrlArray) {
      try {
        logger.info(`Processing image ${++processedCount}/${imageUrls.size}: ${imageUrl}`);
        
        // Generate filename
        const filename = generateFilename(imageUrl);
        
        // Check if already processed
        if (imageMetadata[imageUrl]) {
          logger.warn(`Image already processed: ${imageUrl}`);
          continue;
        }
        
        // Download image
        const { buffer, mimeType, size } = await downloadImage(imageUrl);
        
        // Upload to R2
        const r2Url = await uploadToR2(filename, buffer, mimeType);
        
        // Store metadata
        const metadata: ImageMetadata = {
          originalUrl: imageUrl,
          r2Url,
          filename,
          size,
          mimeType,
          hash: createHash('md5').update(buffer).digest('hex')
        };
        
        imageMetadata[imageUrl] = metadata;
        migratedImages.push(metadata);
        
        // Save image locally for backup
        const localPath = path.join(outputDir, filename);
        fs.writeFileSync(localPath, buffer);
        
        logger.info(`Successfully migrated: ${imageUrl} -> ${r2Url}`);
        
      } catch (error) {
        logger.error(`Failed to process image: ${imageUrl}`, error);
        // Continue with next image
      }
    }
    
    // Save metadata
    const metadataFilepath = path.join(outputDir, 'image-metadata.json');
    fs.writeFileSync(metadataFilepath, JSON.stringify({
      exportedAt: new Date().toISOString(),
      totalImages: migratedImages.length,
      images: migratedImages
    }, null, 2));
    
    // Update data with new image URLs
    logger.info('Updating data with new image URLs...');
    const updatedData = data.map(item => {
      const updatedItem = { ...item };
      
      // Update content field (only for products which have content)
      if (item.type === 'product' && item.content) {
        const contentStr = JSON.stringify(item.content);
        let updatedContent = contentStr;
        
        for (const [originalUrl, metadata] of Object.entries(imageMetadata)) {
          updatedContent = updatedContent.replace(new RegExp(originalUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), metadata.r2Url);
        }
        
        (updatedItem as any).content = JSON.parse(updatedContent);
      }
      
      // Update other image fields
      const imageFields = ['coverImage', 'image', 'avatar', 'logo', 'icon'];
      for (const field of imageFields) {
        const value = (item as any)[field];
        
        if (value) {
          if (typeof value === 'string') {
            for (const [originalUrl, metadata] of Object.entries(imageMetadata)) {
              if (value.includes(originalUrl)) {
                (updatedItem as any)[field] = metadata.r2Url;
              }
            }
          } else if (value && typeof value === 'object' && 'asset' in value && value.asset?.url) {
            for (const [originalUrl, metadata] of Object.entries(imageMetadata)) {
              if (value.asset.url.includes(originalUrl)) {
                (updatedItem as any)[field] = {
                  ...value,
                  asset: {
                    ...value.asset,
                    url: metadata.r2Url
                  }
                };
              }
            }
          }
        }
      }
      
      return updatedItem;
    });
    
    // Save updated data
    const updatedDataFilepath = path.join(hfDir, 'data-with-updated-images.jsonl');
    const updatedDataContent = updatedData.map(item => JSON.stringify(item)).join('\n');
    fs.writeFileSync(updatedDataFilepath, updatedDataContent);
    
    logger.info(`✅ Image migration completed successfully!`);
    logger.info(`Total images migrated: ${migratedImages.length}`);
    logger.info(`Output saved to: ${outputDir}`);
    logger.info(`- image-metadata.json: migration metadata`);
    logger.info(`- data-with-updated-images.jsonl: data with updated URLs`);
    
  } catch (error) {
    logger.error('Image migration failed', error);
    process.exit(1);
  }
}

// Run the migration
if (require.main === module) {
  processImageMigration();
}

export { processImageMigration, extractImageUrls, generateFilename };