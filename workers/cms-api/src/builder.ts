import { HuggingFaceResponse, ContentItem, BuilderConfig, Locale, ContentType } from './types';
import { CONFIG } from './types';
import pako from 'pako';

export class ArtifactBuilder {
  private config: BuilderConfig;

  constructor(config?: Partial<BuilderConfig>) {
    this.config = {
      hfModel: 'sentence-transformers/all-MiniLM-L6-v2',
      hfEndpoint: 'https://api-inference.huggingface.co/models',
      compressionLevel: CONFIG.COMPRESSION_LEVEL,
      cacheTTL: {
        kv: CONFIG.CACHE_TTL.KV,
        r2: CONFIG.CACHE_TTL.R2,
      },
      maxRetries: CONFIG.MAX_RETRIES,
      timeout: CONFIG.TIMEOUT,
      ...config,
    };
  }

  /**
   * Fetch data from HuggingFace API
   */
  async fetchFromHuggingFace(locale: Locale, contentType: ContentType, slug: string): Promise<HuggingFaceResponse> {
    const startTime = Date.now();
    const endpoint = `${this.config.hfEndpoint}/${this.config.hfModel}`;
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getHuggingFaceToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: `Retrieve content for ${contentType} "${slug}" in ${locale} language`,
          options: {
            wait_for_model: true,
            use_cache: false,
          },
        }),
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) {
        throw new Error(`HuggingFace API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Transform HF response to our expected format
      return this.transformHuggingFaceResponse(data, locale, contentType, slug);
    } catch (error) {
      throw new Error(`Failed to fetch from HuggingFace: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      const duration = Date.now() - startTime;
      console.log(`[Builder] HuggingFace fetch completed in ${duration}ms`);
    }
  }

  /**
   * Denormalize HuggingFace response into ContentItem structure
   */
  private transformHuggingFaceResponse(
    hfData: any,
    locale: Locale,
    contentType: ContentType,
    slug: string
  ): HuggingFaceResponse {
    // This is a simplified transformation - adjust based on actual HF response structure
    return {
      id: `${locale}-${contentType}-${slug}`,
      label: `${contentType}-${slug}`,
      score: 0.95, // Default confidence score
      metadata: {
        title: `${contentType.charAt(0).toUpperCase() + contentType.slice(1)}: ${slug}`,
        description: `Content for ${slug} in ${locale}`,
        content: JSON.stringify(hfData),
        tags: [contentType, locale],
        published_at: new Date().toISOString(),
        author: 'CMS API',
      },
    };
  }

  /**
   * Compress data using gzip
   */
  compressData(data: string): { compressed: Uint8Array; originalSize: number; compressedSize: number } {
    const originalSize = data.length;
    const compressed = pako.gzip(data, { level: this.config.compressionLevel });
    const compressedSize = compressed.length;
    
    console.log(`[Builder] Compression: ${originalSize} -> ${compressedSize} (${Math.round((1 - compressedSize / originalSize) * 100)}%)`);
    
    return { compressed, originalSize, compressedSize };
  }

  /**
   * Decompress gzipped data
   */
  decompressData(compressed: Uint8Array): string {
    try {
      const decompressed = pako.ungzip(compressed, { to: 'string' });
      return decompressed;
    } catch (error) {
      throw new Error(`Failed to decompress data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Build and store artifact in R2
   */
  async buildAndStoreArtifact(
    locale: Locale,
    contentType: ContentType,
    slug: string
  ): Promise<ContentItem> {
    const startTime = Date.now();
    
    try {
      // Step 1: Fetch from HuggingFace
      console.log(`[Builder] Building artifact for ${locale}/${contentType}/${slug}`);
      const hfResponse = await this.fetchFromHuggingFace(locale, contentType, slug);
      
      // Step 2: Create ContentItem structure
      const contentItem: ContentItem = {
        id: hfResponse.id,
        title: hfResponse.metadata?.title || `${contentType}: ${slug}`,
        description: hfResponse.metadata?.description,
        content: hfResponse.metadata?.content || JSON.stringify(hfResponse),
        slug,
        locale,
        contentType,
        tags: hfResponse.metadata?.tags || [contentType, locale],
        publishedAt: hfResponse.metadata?.published_at,
        author: hfResponse.metadata?.author,
        heatScore: 1,
        accessCount: 0,
        lastAccessed: new Date().toISOString(),
        compressedSize: 0,
        originalSize: 0,
      };

      // Step 3: Compress content
      const { compressed, originalSize, compressedSize } = this.compressData(contentItem.content);
      contentItem.compressedSize = compressedSize;
      contentItem.originalSize = originalSize;

      // Step 4: Store in R2 (this would be implemented in the main worker)
      // For now, we'll return the content item for storage
      console.log(`[Builder] Artifact built successfully in ${Date.now() - startTime}ms`);
      
      return contentItem;
    } catch (error) {
      console.error(`[Builder] Failed to build artifact: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Get HuggingFace token from environment
   */
  private getHuggingFaceToken(): string {
    const token = process.env.HF_TOKEN;
    if (!token) {
      throw new Error('HuggingFace token not configured');
    }
    return token;
  }

  /**
   * Validate content size
   */
  validateContentSize(size: number): void {
    if (size > CONFIG.MAX_CONTENT_SIZE) {
      throw new Error(`Content size ${size} exceeds maximum allowed size ${CONFIG.MAX_CONTENT_SIZE}`);
    }
  }

  /**
   * Get configuration
   */
  getConfig(): BuilderConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<BuilderConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}