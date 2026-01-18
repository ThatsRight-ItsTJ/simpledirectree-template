import { HuggingFaceResponse, ContentItem, BuilderConfig, Locale, ContentType, DirectoryPage, Business, FAQ } from './types';
import { CONFIG } from './types';
import pako from 'pako';

export class ArtifactBuilder {
  private config: BuilderConfig;

  private hfToken: string;

  constructor(config?: Partial<BuilderConfig>, hfToken?: string) {
    this.config = {
      hfModel: 'sentence-transformers/all-MiniLM-L6-v2',
      hfEndpoint: 'https://api-inference.huggingface.co/models',
      hfDataset: 'Offren/directory-pages',
      compressionLevel: CONFIG.COMPRESSION_LEVEL,
      cacheTTL: {
        kv: CONFIG.CACHE_TTL.KV,
        r2: CONFIG.CACHE_TTL.R2,
      },
      maxRetries: CONFIG.MAX_RETRIES,
      timeout: CONFIG.TIMEOUT,
      ...config,
    };
    this.hfToken = hfToken || '';
  }

  /**
   * Fetch data from HuggingFace API
   */
  async fetchFromHuggingFace(locale: Locale, contentType: ContentType, slug: string): Promise<HuggingFaceResponse> {
    const startTime = Date.now();
    
    // For local development/testing, use mock data instead of actual HuggingFace API
    if (!this.hfToken || this.hfToken === 'your-huggingface-read-token') {
      console.log(`[Builder] Using mock data for local development`);
      return this.createMockHuggingFaceResponse(locale, contentType, slug);
    }
    
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
    if (!this.hfToken) {
      throw new Error('HuggingFace token not configured');
    }
    return this.hfToken;
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
   * Fetch directory page data for simplified content model
   */
  async fetchDirectoryPage(locale: Locale, slug: string): Promise<DirectoryPage> {
    const startTime = Date.now();

    try {
      console.log(`[Builder] Fetching directory page for ${locale}/${slug}`);

      // For local development/testing, use mock data
      if (!this.hfToken || this.hfToken === 'your-huggingface-token') {
        console.log(`[Builder] Using mock data for local development`);
        return this.createMockDirectoryPage(slug);
      }

      // Fetch business data from Directories folder
      const dirUrl = `https://huggingface.co/datasets/${this.config.hfDataset}/resolve/main/Directories/${slug}.json`;
      console.log(`[Builder] Fetching directory data: ${dirUrl}`);

      const dirResponse = await fetch(dirUrl, {
        headers: {
          'Authorization': `Bearer ${this.hfToken}`
        },
        signal: AbortSignal.timeout(this.config.timeout)
      });

      if (!dirResponse.ok) {
        throw new Error(`Failed to fetch directory data: ${dirResponse.status} ${dirResponse.statusText}`);
      }

      const businessData = await dirResponse.json();

      // Fetch FAQ data from FAQ folder (optional - may not exist for all pages)
      let faqData: { faqs?: FAQ[]; faqCount?: number } = { faqs: [], faqCount: 0 };

      try {
        const faqUrl = `https://huggingface.co/datasets/${this.config.hfDataset}/resolve/main/FAQ/${slug}.json`;
        console.log(`[Builder] Fetching FAQ data: ${faqUrl}`);

        const faqResponse = await fetch(faqUrl, {
          headers: {
            'Authorization': `Bearer ${this.hfToken}`
          },
          signal: AbortSignal.timeout(this.config.timeout)
        });

        if (faqResponse.ok) {
          faqData = await faqResponse.json();
          console.log(`[Builder] FAQ data found: ${faqData.faqCount || 0} FAQs`);
        } else {
          console.log(`[Builder] No FAQ data found for ${slug}, using empty array`);
        }
      } catch (faqError) {
        console.log(`[Builder] No FAQ data available for ${slug}`);
        // Gracefully handle missing FAQ files
      }

      // Combine both into DirectoryPage structure
      const directoryPage: DirectoryPage = {
        slug: slug,
        title: businessData.title || `Directory: ${slug}`,
        description: businessData.description || '',
        businesses: businessData.businesses || [],
        faqs: faqData.faqs || [],
        businessCount: businessData.businessCount || (businessData.businesses?.length || 0),
        faqCount: faqData.faqCount || (faqData.faqs?.length || 0),
        createdAt: businessData.createdAt || new Date().toISOString(),
        updatedAt: businessData.updatedAt || new Date().toISOString()
      };

      console.log(`[Builder] Directory page fetched successfully in ${Date.now() - startTime}ms`);
      console.log(`[Builder] ${directoryPage.businessCount} businesses, ${directoryPage.faqCount} FAQs`);

      return directoryPage;

    } catch (error) {
      console.error(`[Builder] Failed to fetch directory page: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Create mock directory page for local development
   */
  private createMockDirectoryPage(slug: string): DirectoryPage {
    return {
      slug: slug,
      title: `Directory: ${slug}`,
      description: 'Mock directory page for local development',
      businesses: [
        {
          id: 'mock-1',
          name: 'Test Business 1',
          address: '123 Test St',
          phone: '555-0100',
          rating: 4.5,
          reviewCount: 100,
          website: 'https://example.com',
          description: 'Test business description',
          hours: '9 AM - 5 PM'
        },
        {
          id: 'mock-2',
          name: 'Test Business 2',
          address: '456 Test Ave',
          phone: '555-0200',
          rating: 4.8,
          reviewCount: 150,
          website: 'https://example2.com',
          description: 'Another test business',
          hours: '10 AM - 6 PM'
        }
      ],
      faqs: [
        {
          id: 'faq-1',
          question: 'Test question 1?',
          answer: 'Test answer 1'
        },
        {
          id: 'faq-2',
          question: 'Test question 2?',
          answer: 'Test answer 2'
        }
      ],
      businessCount: 2,
      faqCount: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Create mock HuggingFace response for local development
   */
  private createMockHuggingFaceResponse(locale: Locale, contentType: ContentType, slug: string): HuggingFaceResponse {
    // Create mock data based on content type
    if (contentType === 'directory') {
      return {
        id: `${locale}-${contentType}-${slug}`,
        label: `${contentType}-${slug}`,
        score: 0.95,
        metadata: {
          title: `Directory: ${slug}`,
          description: `Test directory for ${slug}`,
          content: JSON.stringify({
            businesses: [
              {
                id: "1",
                name: "Test Business 1",
                description: "A test business",
                address: "123 Test St",
                rating: 4.5
              },
              {
                id: "2",
                name: "Test Business 2",
                description: "Another test business",
                address: "456 Test Ave",
                rating: 4.2
              }
            ]
          }),
          tags: [contentType, locale],
          published_at: new Date().toISOString(),
          author: 'CMS API',
        },
      };
    } else if (contentType === 'faq') {
      return {
        id: `${locale}-${contentType}-${slug}`,
        label: `${contentType}-${slug}`,
        score: 0.95,
        metadata: {
          title: `FAQ: ${slug}`,
          description: `Frequently asked questions about ${slug}`,
          content: JSON.stringify({
            faqs: [
              {
                question: "What are your hours?",
                answer: "We are open Monday-Friday 9am-5pm"
              },
              {
                question: "Do you offer delivery?",
                answer: "Yes, we offer delivery within 5 miles"
              }
            ]
          }),
          tags: [contentType, locale],
          published_at: new Date().toISOString(),
          author: 'CMS API',
        },
      };
    } else {
      // Generic mock response for other content types
      return {
        id: `${locale}-${contentType}-${slug}`,
        label: `${contentType}-${slug}`,
        score: 0.95,
        metadata: {
          title: `${contentType.charAt(0).toUpperCase() + contentType.slice(1)}: ${slug}`,
          description: `Content for ${slug} in ${locale}`,
          content: `This is mock content for ${contentType} "${slug}" in ${locale} language.`,
          tags: [contentType, locale],
          published_at: new Date().toISOString(),
          author: 'CMS API',
        },
      };
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