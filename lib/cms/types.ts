import { Locale } from "@/i18n-config";

// Content types supported by the Cloudflare CMS
export type ContentType = 'product' | 'category' | 'apptype' | 'application' | 'groups' | 'index' | 'user' | 'applications-by-user' | 'apptype-list' | 'directory';

// Supported locales
export type SupportedLocale = 'en' | 'zh';

// Base interface for all content items
export interface BaseContentItem {
  id?: string;
  title?: string;
  description?: string;
  content?: string;
  slug?: string;
  locale?: SupportedLocale;
  contentType?: ContentType;
  tags?: string[];
  publishedAt?: string;
  author?: string;
  heatScore?: number;
  accessCount?: number;
  lastAccessed?: string;
  compressedSize?: number;
  originalSize?: number;
}

// Product data type
export interface ProductData extends BaseContentItem {
  _id?: string;
  _type?: string;
  _createdAt?: string;
  _updatedAt?: string;
  name: string;
  desc: string;
  coverImage?: string;
  logo?: string;
  website?: string;
  github?: string;
  price?: string;
  category?: string;
  group?: string;
  features?: string[];
  screenshots?: string[];
  submissionDate?: string;
  submitter?: string;
  free?: boolean;
  opensource?: boolean;
}

// Category data type
export interface CategoryData extends BaseContentItem {
  _id?: string;
  _type?: string;
  _createdAt?: string;
  _updatedAt?: string;
  name: string;
  group?: GroupData;
  products?: ProductData[];
}

// Application type data
export interface AppTypeData extends BaseContentItem {
  _id?: string;
  _type?: string;
  _createdAt?: string;
  _updatedAt?: string;
  name: string;
  description?: string;
  applications?: ApplicationData[];
}

// User data type
export interface UserData extends BaseContentItem {
  _id?: string;
  _type?: string;
  _createdAt?: string;
  _updatedAt?: string;
  _rev?: string;
  name?: string;
  id?: string;
  email?: string;
  avatar?: string;
  link?: string;
  date?: string;
}

// Application data type
export interface ApplicationData extends BaseContentItem {
  _id?: string;
  _type?: string;
  _createdAt?: string;
  _updatedAt?: string;
  _rev?: string;
  name: string;
  description?: string;
  website?: string;
  logo?: string;
  coverImage?: string;
  apptype?: AppTypeData;
  submissionDate?: string;
  submitter?: string;
  features?: string[];
  screenshots?: string[];
  types?: any[];
  user?: UserData;
  link?: string;
  date?: string;
}

// Group data type
export interface GroupData extends BaseContentItem {
  _id?: string;
  _type?: string;
  _createdAt?: string;
  _updatedAt?: string;
  name: string;
  description?: string;
  categories?: CategoryData[];
  products?: ProductData[];
}

// Directory page data type
export interface DirectoryPage extends BaseContentItem {
  _id?: string;
  _type?: string;
  _createdAt?: string;
  _updatedAt?: string;
  title: string;
  description?: string;
  slug: string;
  businesses?: {
    id: string;
    name: string;
    description?: string;
    address?: string;
    rating?: number;
    website?: string;
    phone?: string;
    hours?: string;
  }[];
  faqs?: {
    question: string;
    answer: string;
  }[];
  businessCount?: number;
  faqCount?: number;
}

// Index/homepage data type
export interface IndexData extends BaseContentItem {
  _id?: string;
  _type?: string;
  _createdAt?: string;
  _updatedAt?: string;
  heroTitle?: string;
  heroDescription?: string;
  heroImage?: string;
  featuredProducts?: ProductData[];
  featuredCategories?: CategoryData[];
  featuredApplications?: ApplicationData[];
}

// Query result types for different content types
export type ProductQueryResult = ProductData;
export type CategoryQueryResult = CategoryData;
export type AppTypeQueryResult = AppTypeData;
export type ApplicationQueryResult = ApplicationData;
export type GroupQueryResult = GroupData;
export type IndexQueryResult = IndexData;
export type UserQueryResult = UserData;
export type DirectoryQueryResult = DirectoryPage;
export type ApplicationListByUserQueryResult = ApplicationData[];
export type AppTypeListQueryResult = AppTypeData[];
export type GroupListWithCategoryQueryResult = GroupData[];
export type ProductListOfFeaturedQueryResult = ProductData[];
export type ProductListOfRecentQueryResult = ProductData[];

// Sitemap query result types
export interface AppListQueryForSitemapResult {
  id: string;
  name: string;
  slug: string;
}

export interface AppTypeListQueryForSitemapResult {
  id: string;
  slug: string;
}

export interface CategoryListQueryForSitemapResult {
  id: string;
  slug: string;
  group?: {
    slug: string;
  };
}

export interface ProductListQueryForSitemapResult {
  id: string;
  slug: string;
}

export interface DirectoryListQueryForSitemapResult {
  id: string;
  slug: string;
  title: string;
}

// Query parameters interface
export interface QueryParams {
  [key: string]: any;
}

// Cache options
export interface CacheOptions {
  useCache?: boolean;
  ttl?: number;
}

// Error types
export class CMSFetchError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'CMSFetchError';
  }
}

export class NotFoundError extends CMSFetchError {
  constructor(message: string = 'Content not found') {
    super(message, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

// Environment configuration
export interface CMSConfig {
  apiUrl: string;
  apiKey?: string;
  defaultLocale: SupportedLocale;
  cacheTTL: number;
}