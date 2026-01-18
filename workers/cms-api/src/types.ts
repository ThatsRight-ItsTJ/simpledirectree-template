// TypeScript types and interfaces for CMS API

// Cloudflare environment types
export interface Env {
  KV_CACHE: KVNamespace;
  R2_STORAGE: R2Bucket;
  DB: D1Database;
  ENVIRONMENT: string;
  HF_TOKEN: string;
  ADMIN_SECRET: string;
}

// Content types supported by the CMS
export type ContentType = 'page' | 'post' | 'product' | 'guide' | 'documentation' | 'directory' | 'faq';

// Supported locales
export type Locale = 'en' | 'zh';

// Request context
export interface RequestContext {
  locale: Locale;
  contentType: ContentType;
  slug: string;
}

// HuggingFace API response structure
export interface HuggingFaceResponse {
  id: string;
  label: string;
  score: number;
  metadata?: {
    title?: string;
    description?: string;
    content?: string;
    tags?: string[];
    published_at?: string;
    author?: string;
  };
}

// Business interface for directory pages
export interface Business {
  id: string;
  name: string;
  description?: string;
  address?: string;
  phone?: string;
  website?: string;
  rating?: number;
  reviewCount?: number;
  categories?: string[];
  hours?: string;
  latitude?: number;
  longitude?: number;
  images?: string[];
}

// FAQ interface for directory pages
export interface FAQ {
  id: string;
  question: string;
  answer: string;
  order?: number;
}

// Directory page structure
export interface DirectoryPage {
  slug: string;
  title: string;
  description?: string;
  businesses: Business[];
  faqs: FAQ[];
  businessCount: number;
  faqCount: number;
  createdAt: string;
  updatedAt: string;
}

// Denormalized content structure
export interface ContentItem {
  id: string;
  title: string;
  description?: string;
  content: string;
  slug: string;
  locale: Locale;
  contentType: ContentType;
  tags: string[];
  publishedAt?: string;
  author?: string;
  heatScore: number;
  accessCount: number;
  lastAccessed: string;
  compressedSize: number;
  originalSize: number;
}

// Cache layers response structure
export interface CacheResponse<T = ContentItem | DirectoryPage> {
  source: 'kv' | 'r2' | 'hf';
  data?: T;
  compressed?: boolean;
  cacheHit: boolean;
  responseTime: number;
}

// Error types
export class CMSAPIError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'CMSAPIError';
  }
}

export class CacheError extends CMSAPIError {
  constructor(message: string, public cacheType: string) {
    super(message, `CACHE_${cacheType.toUpperCase()}_ERROR`, 503);
    this.name = 'CacheError';
  }
}

export class ValidationError extends CMSAPIError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
  }
}

// Database types
export interface PageHeatRecord {
  id: number;
  locale: string;
  content_type: string;
  slug: string;
  heat_score: number;
  last_accessed: string;
  access_count: number;
  created_at: string;
  updated_at: string;
}

// Heat tracking options
export interface HeatTrackingOptions {
  increment: boolean;
  minHeatScore?: number;
  maxHeatScore?: number;
}

// Builder configuration
export interface BuilderConfig {
  hfModel: string;
  hfEndpoint: string;
  hfDataset: string; // HuggingFace dataset repo name
  compressionLevel: number;
  cacheTTL: {
    kv: number; // seconds
    r2: number; // seconds
  };
  maxRetries: number;
  timeout: number;
  hfToken?: string; // Added for direct token passing
}

// Environment variables
export interface Environment {
  ENVIRONMENT: 'development' | 'staging' | 'production';
  HF_TOKEN: string;
  ADMIN_SECRET: string;
}

// Request headers
export interface RequestHeaders {
  'accept-encoding'?: string;
  'accept-language'?: string;
  'user-agent'?: string;
  'authorization'?: string;
  'x-forwarded-for'?: string;
}

// Response headers
export interface ResponseHeaders {
  'content-type': string;
  'content-encoding': string;
  'cache-control': string;
  'x-cache-status': string;
  'x-response-time': string;
  'access-control-allow-origin': string;
  'access-control-allow-methods': string;
  'access-control-allow-headers': string;
}

// Analytics event
export interface AnalyticsEvent {
  type: 'page_view' | 'cache_hit' | 'cache_miss' | 'error';
  timestamp: string;
  locale: Locale;
  contentType: ContentType;
  slug: string;
  source: 'kv' | 'r2' | 'hf' | 'unknown';
  duration: number;
  userAgent?: string | null;
  ip?: string | null;
  error?: string;
}

// Configuration constants
export const CONFIG = {
  SUPPORTED_LOCALES: ['en', 'zh'] as Locale[],
  SUPPORTED_CONTENT_TYPES: ['page', 'post', 'product', 'guide', 'documentation', 'directory', 'faq'] as ContentType[],
  CACHE_TTL: {
    KV: 3600, // 1 hour
    R2: 86400, // 24 hours
  },
  COMPRESSION_LEVEL: 6,
  MAX_CONTENT_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_RETRIES: 3,
  TIMEOUT: 30000, // 30 seconds
} as const;