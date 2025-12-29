import { env } from "@/env.mjs";
import { notFound } from "next/navigation";
import type { NextRequest } from "next/server";

import {
  type AppListQueryForSitemapResult,
  type AppTypeListQueryForSitemapResult,
  type CategoryListQueryForSitemapResult,
  type ProductListQueryForSitemapResult,
  type AppTypeQueryResult,
  type ApplicationQueryResult,
  type CategoryQueryResult,
  type GroupQueryResult,
  type IndexQueryResult,
  type ProductQueryResult,
  type ContentType,
  type SupportedLocale,
  type QueryParams,
  type CacheOptions,
  CMSFetchError,
  NotFoundError,
} from "./types";

// CMS API configuration
const CMS_API_URL = env.NEXT_PUBLIC_CMS_API_URL || "https://your-worker.your-subdomain.workers.dev";

/**
 * Generic fetch function for CMS API with error handling and caching
 */
export async function cmsFetch<T = any>({
  contentType,
  slug,
  locale = "en" as SupportedLocale,
  params = {},
  options = {},
}: {
  contentType: ContentType;
  slug: string;
  locale?: SupportedLocale;
  params?: QueryParams;
  options?: CacheOptions;
}): Promise<T> {
  const { useCache = true, ttl = 60 } = options;
  
  try {
    // Construct API URL
    const url = new URL(`${CMS_API_URL}/api/cms/${locale}/${contentType}/${encodeURIComponent(slug)}`);
    
    // Add query parameters
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value.toString());
      }
    });

    // Add cache control header
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (!useCache) {
      headers['Cache-Control'] = 'no-cache';
    }

    // Make API request
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers,
      cache: useCache ? 'force-cache' : 'no-store',
      next: {
        revalidate: useCache ? ttl : 0,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new NotFoundError(`Content not found: ${contentType}/${slug}`);
      }
      
      const errorData = await response.json().catch(() => ({}));
      throw new CMSFetchError(
        errorData.error || `HTTP error! status: ${response.status}`,
        `HTTP_ERROR_${response.status}`,
        response.status
      );
    }

    const data = await response.json();
    
    if (!data.success || !data.data) {
      throw new CMSFetchError(
        'Invalid response from CMS API',
        'INVALID_RESPONSE',
        500
      );
    }

    return data.data as T;
  } catch (error) {
    console.error(`CMS fetch error for ${contentType}/${slug}:`, error);
    
    if (error instanceof NotFoundError) {
      notFound();
    }
    
    if (error instanceof CMSFetchError) {
      throw error;
    }
    
    throw new CMSFetchError(
      `Failed to fetch ${contentType} content: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'FETCH_ERROR',
      500
    );
  }
}

/**
 * Product-specific fetch function
 */
export async function fetchProduct({
  slug,
  locale = "en",
  params = {},
  options = {},
}: {
  slug: string;
  locale?: SupportedLocale;
  params?: QueryParams;
  options?: CacheOptions;
}): Promise<ProductQueryResult> {
  return cmsFetch<ProductQueryResult>({
    contentType: 'product',
    slug,
    locale,
    params,
    options,
  });
}

/**
 * Category-specific fetch function
 */
export async function fetchCategory({
  slug,
  locale = "en",
  params = {},
  options = {},
}: {
  slug: string;
  locale?: SupportedLocale;
  params?: QueryParams;
  options?: CacheOptions;
}): Promise<CategoryQueryResult> {
  return cmsFetch<CategoryQueryResult>({
    contentType: 'category',
    slug,
    locale,
    params,
    options,
  });
}

/**
 * Application type-specific fetch function
 */
export async function fetchAppType({
  slug,
  locale = "en",
  params = {},
  options = {},
}: {
  slug: string;
  locale?: SupportedLocale;
  params?: QueryParams;
  options?: CacheOptions;
}): Promise<AppTypeQueryResult> {
  return cmsFetch<AppTypeQueryResult>({
    contentType: 'apptype',
    slug,
    locale,
    params,
    options,
  });
}

/**
 * Application-specific fetch function
 */
export async function fetchApplication({
  slug,
  locale = "en",
  params = {},
  options = {},
}: {
  slug: string;
  locale?: SupportedLocale;
  params?: QueryParams;
  options?: CacheOptions;
}): Promise<ApplicationQueryResult> {
  return cmsFetch<ApplicationQueryResult>({
    contentType: 'application',
    slug,
    locale,
    params,
    options,
  });
}

/**
 * Group-specific fetch function
 */
export async function fetchGroup({
  slug,
  locale = "en",
  params = {},
  options = {},
}: {
  slug: string;
  locale?: SupportedLocale;
  params?: QueryParams;
  options?: CacheOptions;
}): Promise<GroupQueryResult> {
  return cmsFetch<GroupQueryResult>({
    contentType: 'groups',
    slug,
    locale,
    params,
    options,
  });
}

/**
 * Index/homepage fetch function
 */
export async function fetchIndex({
  locale = "en",
  params = {},
  options = {},
}: {
  locale?: SupportedLocale;
  params?: QueryParams;
  options?: CacheOptions;
}): Promise<IndexQueryResult> {
  return cmsFetch<IndexQueryResult>({
    contentType: 'index',
    slug: 'homepage',
    locale,
    params,
    options,
  });
}

/**
 * Fetch multiple products by category
 */
export async function fetchProductsByCategory({
  categorySlug,
  locale = "en",
  params = {},
  options = {},
}: {
  categorySlug: string;
  locale?: SupportedLocale;
  params?: QueryParams;
  options?: CacheOptions;
}): Promise<ProductQueryResult[]> {
  // This would need to be implemented in the CMS API to support multiple results
  // For now, we'll use a single fetch approach
  const category = await fetchCategory({ slug: categorySlug, locale, options });
  return category.products || [];
}

/**
 * Fetch multiple applications by type
 */
export async function fetchApplicationsByType({
  typeSlug,
  locale = "en",
  params = {},
  options = {},
}: {
  typeSlug: string;
  locale?: SupportedLocale;
  params?: QueryParams;
  options?: CacheOptions;
}): Promise<ApplicationQueryResult[]> {
  // This would need to be implemented in the CMS API to support multiple results
  // For now, we'll use a single fetch approach
  const appType = await fetchAppType({ slug: typeSlug, locale, options });
  return appType.applications || [];
}

/**
 * Sitemap fetch functions
 */

export async function fetchAppListForSitemap({
  locale = "en",
  options = {},
}: {
  locale?: SupportedLocale;
  options?: CacheOptions;
}): Promise<AppListQueryForSitemapResult[]> {
  // This endpoint needs to be implemented in the CMS API
  // For now, we'll use a placeholder
  return cmsFetch<AppListQueryForSitemapResult[]>({
    contentType: 'application',
    slug: 'sitemap-apps',
    locale,
    options: { ...options, useCache: true },
  });
}

export async function fetchAppTypeListForSitemap({
  locale = "en",
  options = {},
}: {
  locale?: SupportedLocale;
  options?: CacheOptions;
}): Promise<AppTypeListQueryForSitemapResult[]> {
  // This endpoint needs to be implemented in the CMS API
  // For now, we'll use a placeholder
  return cmsFetch<AppTypeListQueryForSitemapResult[]>({
    contentType: 'apptype',
    slug: 'sitemap-apptypes',
    locale,
    options: { ...options, useCache: true },
  });
}

export async function fetchCategoryListForSitemap({
  locale = "en",
  options = {},
}: {
  locale?: SupportedLocale;
  options?: CacheOptions;
}): Promise<CategoryListQueryForSitemapResult[]> {
  // This endpoint needs to be implemented in the CMS API
  // For now, we'll use a placeholder
  return cmsFetch<CategoryListQueryForSitemapResult[]>({
    contentType: 'category',
    slug: 'sitemap-categories',
    locale,
    options: { ...options, useCache: true },
  });
}

export async function fetchProductListForSitemap({
  locale = "en",
  options = {},
}: {
  locale?: SupportedLocale;
  options?: CacheOptions;
}): Promise<ProductListQueryForSitemapResult[]> {
  // This endpoint needs to be implemented in the CMS API
  // For now, we'll use a placeholder
  return cmsFetch<ProductListQueryForSitemapResult[]>({
    contentType: 'product',
    slug: 'sitemap-products',
    locale,
    options: { ...options, useCache: true },
  });
}

/**
 * User-specific fetch function
 * This replaces the Sanity user query
 */
export async function fetchUser({
  userId,
  locale = "en",
  params = {},
  options = {},
}: {
  userId: string;
  locale?: SupportedLocale;
  params?: QueryParams;
  options?: CacheOptions;
}): Promise<UserQueryResult> {
  return cmsFetch<UserQueryResult>({
    contentType: 'user',
    slug: userId,
    locale,
    params,
    options,
  });
}

/**
 * Application list by user fetch function
 * This replaces the Sanity applicationListByUserQuery
 */
export async function fetchApplicationsByUser({
  userId,
  locale = "en",
  params = {},
  options = {},
}: {
  userId: string;
  locale?: SupportedLocale;
  params?: QueryParams;
  options?: CacheOptions;
}): Promise<ApplicationListByUserQueryResult> {
  return cmsFetch<ApplicationListByUserQueryResult>({
    contentType: 'applications-by-user',
    slug: userId,
    locale,
    params,
    options,
  });
}

/**
 * AppType list fetch function
 * This replaces the Sanity appTypeListQuery
 */
export async function fetchAppTypeList({
  locale = "en",
  params = {},
  options = {},
}: {
  locale?: SupportedLocale;
  params?: QueryParams;
  options?: CacheOptions;
}): Promise<AppTypeListQueryResult> {
  return cmsFetch<AppTypeListQueryResult>({
    contentType: 'apptype-list',
    slug: 'all',
    locale,
    params,
    options,
  });
}

/**
 * Group list with categories fetch function
 * This replaces the Sanity groupListWithCategoryQuery
 */
export async function fetchGroupListWithCategories({
  locale = "en",
  params = {},
  options = {},
}: {
  locale?: SupportedLocale;
  params?: QueryParams;
  options?: CacheOptions;
}): Promise<GroupListWithCategoryQueryResult> {
  return cmsFetch<GroupListWithCategoryQueryResult>({
    contentType: 'groups',
    slug: 'list-with-categories',
    locale,
    params,
    options,
  });
}

/**
 * Product list of featured fetch function
 * This replaces the Sanity productListOfFeaturedQuery
 */
export async function fetchProductListOfFeatured({
  locale = "en",
  params = {},
  options = {},
}: {
  locale?: SupportedLocale;
  params?: QueryParams;
  options?: CacheOptions;
}): Promise<ProductListOfFeaturedQueryResult> {
  return cmsFetch<ProductListOfFeaturedQueryResult>({
    contentType: 'product',
    slug: 'featured-list',
    locale,
    params,
    options,
  });
}

/**
 * Product list of recent fetch function
 * This replaces the Sanity productListOfRecentQuery
 */
export async function fetchProductListOfRecent({
  locale = "en",
  params = {},
  options = {},
}: {
  locale?: SupportedLocale;
  params?: QueryParams;
  options?: CacheOptions;
}): Promise<ProductListOfRecentQueryResult> {
  return cmsFetch<ProductListOfRecentQueryResult>({
    contentType: 'product',
    slug: 'recent-list',
    locale,
    params,
    options,
  });
}

/**
 * Image URL helper function
 * This replaces the Sanity image URL helper
 */
export function getCMSImageUrl(
  imageId?: string,
  width?: number,
  height?: number,
  quality: number = 75
): string | undefined {
  if (!imageId) return undefined;

  // Construct image URL based on your CMS's image serving endpoint
  const imageUrl = new URL(`${CMS_API_URL}/api/image/${imageId}`);

  if (width) imageUrl.searchParams.append('w', width.toString());
  if (height) imageUrl.searchParams.append('h', height.toString());
  imageUrl.searchParams.append('q', quality.toString());

  return imageUrl.toString();
}

/**
 * Health check function
 */
export async function checkCMSHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${CMS_API_URL}/health`, {
      method: 'GET',
      cache: 'no-store',
    });
    
    return response.ok;
  } catch (error) {
    console.error('CMS health check failed:', error);
    return false;
  }
}