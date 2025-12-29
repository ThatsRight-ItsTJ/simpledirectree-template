import {
  Environment,
  RequestContext,
  ContentItem,
  CacheResponse,
  ResponseHeaders,
  AnalyticsEvent,
  Locale,
  ContentType,
  HeatTrackingOptions,
  CONFIG,
} from './types';
import { ArtifactBuilder } from './builder';
import { AdminAPI } from './admin';
import pako from 'pako';

export interface Env {
  KV_CACHE: KVNamespace;
  R2_STORAGE: R2Bucket;
  DB: D1Database;
  ENVIRONMENT: string;
  HF_TOKEN: string;
  ADMIN_SECRET: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const startTime = Date.now();
    
    try {
      // Log request for analytics
      console.log(`[Worker] ${request.method} ${request.url} - ${new Date().toISOString()}`);
      
      // Handle different routes
      const url = new URL(request.url);
      const path = url.pathname;
      
      // Admin API routes
      if (path.startsWith('/admin/')) {
        return await handleAdminAPI(request, env, path);
      }
      
      // Main CMS API route
      if (path.startsWith('/api/cms/')) {
        return await handleCMSAPI(request, env, ctx, startTime);
      }
      
      // Health check
      if (path === '/health') {
        return new Response(JSON.stringify({
          status: 'ok',
          timestamp: new Date().toISOString(),
          environment: env.ENVIRONMENT,
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }
      
      // 404 for other routes
      return new Response('Not Found', { status: 404 });
      
    } catch (error) {
      console.error('[Worker] Unhandled error:', error);
      
      const analyticsEvent: AnalyticsEvent = {
        type: 'error',
        timestamp: new Date().toISOString(),
        locale: 'en',
        contentType: 'page',
        slug: 'error',
        source: 'unknown',
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      
      await logAnalytics(env.DB, analyticsEvent);
      
      return new Response(JSON.stringify({
        error: 'Internal server error',
        timestamp: new Date().toISOString(),
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
  },
};

/**
 * Handle Admin API routes
 */
async function handleAdminAPI(request: Request, env: Env, path: string): Promise<Response> {
  const adminAPI = new AdminAPI({
    ENVIRONMENT: env.ENVIRONMENT as 'development' | 'staging' | 'production',
    HF_TOKEN: env.HF_TOKEN,
    ADMIN_SECRET: env.ADMIN_SECRET,
  });

  try {
    await adminAPI.validateAdminRequest(request);
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Unauthorized',
      code: 'UNAUTHORIZED',
    }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  const url = new URL(request.url);
  const segments = path.split('/').filter(Boolean);
  
  switch (segments[1]) {
    case 'health':
      return await adminAPI.healthCheck();
    
    case 'rebuild':
      if (segments.length >= 4) {
        const locale = segments[2] as Locale;
        const contentType = segments[3] as ContentType;
        const slug = segments[4];
        return await adminAPI.triggerRebuild(locale, contentType, slug);
      }
      return new Response('Bad Request: Missing required parameters', { status: 400 });
    
    case 'cache':
      if (segments[2] === 'stats') {
        return await adminAPI.getCacheStats();
      } else if (segments.length >= 4) {
        const locale = segments[2];
        const contentType = segments[3];
        const slug = segments[4];
        return await adminAPI.clearCache(locale, contentType, slug);
      }
      return new Response('Bad Request: Invalid cache operation', { status: 400 });
    
    case 'logs':
      const limit = parseInt(url.searchParams.get('limit') || '100');
      return await adminAPI.getLogs(limit);
    
    case 'config':
      const config = await request.json();
      return await adminAPI.updateConfig(config);
    
    default:
      return new Response('Not Found', { status: 404 });
  }
}

/**
 * Handle main CMS API routes
 */
async function handleCMSAPI(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  startTime: number
): Promise<Response> {
  const url = new URL(request.url);
  const pathSegments = url.pathname.split('/').filter(Boolean);
  
  // Parse request: /api/cms/{locale}/{type}/{slug}
  if (pathSegments.length < 4 || pathSegments[0] !== 'api' || pathSegments[1] !== 'cms') {
    return new Response('Invalid API route format', { status: 400 });
  }
  
  const locale = pathSegments[2] as Locale;
  const contentType = pathSegments[3] as ContentType;
  const slug = pathSegments.slice(4).join('/');
  
  // Validate inputs
  if (!CONFIG.SUPPORTED_LOCALES.includes(locale)) {
    return new Response(`Unsupported locale: ${locale}`, { status: 400 });
  }
  
  if (!CONFIG.SUPPORTED_CONTENT_TYPES.includes(contentType)) {
    return new Response(`Unsupported content type: ${contentType}`, { status: 400 });
  }
  
  if (!slug || slug.trim() === '') {
    return new Response('Slug is required', { status: 400 });
  }
  
  const requestContext: RequestContext = { locale, contentType, slug };
  
  try {
    // Update heat tracking
    await updateHeat(env.DB, requestContext);
    
    // 3-tier caching strategy
    const cacheResponse = await getWithCacheStrategy(env, requestContext);
    
    // Log analytics
    const analyticsEvent: AnalyticsEvent = {
      type: cacheResponse.cacheHit ? 'cache_hit' : 'cache_miss',
      timestamp: new Date().toISOString(),
      locale,
      contentType,
      slug,
      source: cacheResponse.source,
      duration: Date.now() - startTime,
      userAgent: request.headers.get('user-agent'),
      ip: request.headers.get('x-forwarded-for'),
    };
    
    await logAnalytics(env.DB, analyticsEvent);
    
    // Return response
    return createResponse(cacheResponse, requestContext);
    
  } catch (error) {
    console.error(`[Worker] Error handling request for ${locale}/${contentType}/${slug}:`, error);
    
    const analyticsEvent: AnalyticsEvent = {
      type: 'error',
      timestamp: new Date().toISOString(),
      locale,
      contentType,
      slug,
      source: 'unknown',
      duration: Date.now() - startTime,
      userAgent: request.headers.get('user-agent'),
      ip: request.headers.get('x-forwarded-for'),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    
    await logAnalytics(env.DB, analyticsEvent);
    
    return new Response(JSON.stringify({
      error: 'Internal server error',
      timestamp: new Date().toISOString(),
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}

/**
 * 3-tier caching strategy: KV → R2 → HuggingFace
 */
async function getWithCacheStrategy(
  env: Env,
  context: RequestContext
): Promise<CacheResponse> {
  const startTime = Date.now();
  
  // Tier 1: KV Cache (1-5ms)
  try {
    const kvData = await env.KV_CACHE.get(context.slug, { type: 'json' });
    if (kvData) {
      console.log(`[Cache] KV hit for ${context.locale}/${context.contentType}/${context.slug}`);
      return {
        source: 'kv',
        data: kvData as ContentItem,
        cacheHit: true,
        responseTime: Date.now() - startTime,
      };
    }
  } catch (error) {
    console.warn(`[Cache] KV access error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  // Tier 2: R2 Storage (10-50ms)
  try {
    const r2Key = `${context.locale}/${context.contentType}/${context.slug}`;
    const r2Object = await env.R2_STORAGE.get(r2Key);
    
    if (r2Object) {
      const compressedData = await r2Object.arrayBuffer();
      const decompressed = pako.ungzip(new Uint8Array(compressedData), { to: 'string' });
      const data: ContentItem = JSON.parse(decompressed);
      
      console.log(`[Cache] R2 hit for ${context.locale}/${context.contentType}/${context.slug}`);
      
      // Promote to KV cache
      await promoteToKV(env.KV_CACHE, data);
      
      return {
        source: 'r2',
        data,
        cacheHit: true,
        responseTime: Date.now() - startTime,
      };
    }
  } catch (error) {
    console.warn(`[Cache] R2 access error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  // Tier 3: HuggingFace rebuild (100ms+)
  try {
    console.log(`[Cache] Rebuilding artifact for ${context.locale}/${context.contentType}/${context.slug}`);
    const builder = new ArtifactBuilder({
      hfToken: env.HF_TOKEN,
    });
    
    const contentItem = await builder.buildAndStoreArtifact(
      context.locale,
      context.contentType,
      context.slug
    );
    
    // Store in R2
    const r2Key = `${context.locale}/${context.contentType}/${context.slug}`;
    const compressed = builder.compressData(JSON.stringify(contentItem)).compressed;
    await env.R2_STORAGE.put(r2Key, compressed);
    
    // Promote to KV cache
    await promoteToKV(env.KV_CACHE, contentItem);
    
    return {
      source: 'hf',
      data: contentItem,
      cacheHit: false,
      responseTime: Date.now() - startTime,
    };
  } catch (error) {
    console.error(`[Cache] HuggingFace rebuild error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
}

/**
 * Update heat tracking in D1 database
 */
async function updateHeat(env: D1Database, context: RequestContext, options: HeatTrackingOptions = { increment: true }): Promise<void> {
  try {
    const query = `
      INSERT OR REPLACE INTO page_heat 
      (locale, content_type, slug, heat_score, access_count, last_accessed)
      VALUES (?, ?, ?, COALESCE(
        (SELECT heat_score FROM page_heat WHERE locale = ? AND content_type = ? AND slug = ?) + 1,
        1
      ), COALESCE(
        (SELECT access_count FROM page_heat WHERE locale = ? AND content_type = ? AND slug = ?) + 1,
        1
      ), CURRENT_TIMESTAMP)
      WHERE locale = ? AND content_type = ? AND slug = ?
    `;
    
    const params = [
      context.locale,
      context.contentType,
      context.slug,
      context.locale,
      context.contentType,
      context.slug,
      context.locale,
      context.contentType,
      context.slug,
      context.locale,
      context.contentType,
      context.slug,
    ];
    
    await env.prepare(query).bind(...params).run();
    
    console.log(`[Heat] Updated heat for ${context.locale}/${context.contentType}/${context.slug}`);
  } catch (error) {
    console.error(`[Heat] Database error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    // Don't fail the entire request if heat tracking fails
  }
}

/**
 * Promote content to KV cache
 */
async function promoteToKV(kv: KVNamespace, data: ContentItem): Promise<void> {
  try {
    await kv.put(data.slug, JSON.stringify(data), {
      expirationTtl: 3600, // 1 hour TTL
    });
    console.log(`[Cache] Promoted to KV: ${data.slug}`);
  } catch (error) {
    console.warn(`[Cache] KV promotion error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Log analytics event to D1
 */
async function logAnalytics(env: D1Database, event: AnalyticsEvent): Promise<void> {
  try {
    await env.prepare(`
      INSERT INTO analytics_events (type, timestamp, locale, content_type, slug, source, duration, user_agent, ip, error)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      event.type,
      event.timestamp,
      event.locale,
      event.contentType,
      event.slug,
      event.source,
      event.duration,
      event.userAgent || null,
      event.ip || null,
      event.error || null
    ).run();
  } catch (error) {
    console.warn(`[Analytics] Database error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Create HTTP response from cache data
 */
function createResponse(cacheResponse: CacheResponse, context: RequestContext): Response {
  const responseTime = cacheResponse.responseTime.toString();
  const cacheStatus = cacheResponse.cacheHit ? 'HIT' : 'MISS';
  
  const headers: ResponseHeaders = {
    'content-type': 'application/json',
    'content-encoding': 'gzip',
    'cache-control': `public, max-age=${cacheResponse.source === 'kv' ? 3600 : 86400}`,
    'x-cache-status': cacheStatus,
    'x-response-time': responseTime,
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'access-control-allow-headers': 'Content-Type, Authorization',
  };
  
  // Add content-encoding if response is compressed
  if (cacheResponse.data?.compressedSize && cacheResponse.data?.originalSize) {
    headers['content-encoding'] = 'gzip';
  }
  
  const responseHeaders = new Headers();
  Object.entries(headers).forEach(([key, value]) => {
    responseHeaders.set(key, value);
  });

  return new Response(JSON.stringify({
    success: true,
    data: cacheResponse.data,
    source: cacheResponse.source,
    cacheHit: cacheResponse.cacheHit,
    responseTime: cacheResponse.responseTime,
    timestamp: new Date().toISOString(),
  }), {
    status: 200,
    headers: responseHeaders,
  });
}