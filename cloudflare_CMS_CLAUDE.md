# Cloudflare CMS - Claude Code Guide

## Project Overview

This project implements a globally distributed Content Management System using Cloudflare's serverless infrastructure. It serves business directory and FAQ content with guaranteed bounded storage costs and sub-100ms response times worldwide.

### Core Architecture
- **HuggingFace Datasets**: Version-controlled source data (cold storage)
- **Cloudflare R2**: Processed page artifacts (warm storage) 
- **Cloudflare KV**: Hot cache for popular pages
- **Cloudflare D1**: Heat tracking and metadata
- **Cloudflare Workers**: Request handling and business logic

### Key Principle
**Storage grows with pages served, not dataset size.** Heat-based deletion ensures costs stay bounded regardless of how much data exists in HuggingFace.

## Architecture Components

### Data Flow
```
HuggingFace → Process → R2 → KV → Users
     ↑                              ↓
   (Rebuild)                    (Heat Tracking)
```

### Storage Hierarchy
- **KV**: 1-5ms response, frequently accessed pages
- **R2**: 10-50ms response, query-optimized artifacts  
- **HF**: 100ms+ response, source of truth (rebuild only)

### Heat-Based Retention
```
🔥 Hot    (0-7 days)   → Always in KV
🌡️ Warm  (7-30 days)  → Stored in R2
❄️ Cold   (30-90 days) → Deleted from R2  
🧊 Frozen (90+ days)   → Rebuild on demand
```

## Database Schema

### D1 Heat Tracking (`page_heat` table)
```sql
CREATE TABLE page_heat (
    page_key TEXT PRIMARY KEY,          -- "austin-tx/plumbing"
    location TEXT NOT NULL,             -- "austin-tx"
    service TEXT NOT NULL,              -- "plumbing"
    last_accessed INTEGER NOT NULL,     -- Unix timestamp
    access_count_30d INTEGER NOT NULL,  -- Rolling 30-day counter
    last_built INTEGER,                 -- When artifact was created
    artifact_exists INTEGER NOT NULL,   -- 0 or 1 (tracks R2 state)
    last_source_commit TEXT,           -- HF commit used for build
    schema_version INTEGER NOT NULL     -- Schema versioning
);
```

**Key Indexes:**
- `idx_last_accessed` - Powers cleanup queries
- `idx_artifact_exists` - Tracks R2 state

## File Structure

### R2 Object Keys
```
processed/{location}/{service}/complete.json.gz
```

**Example:**
- `processed/austin-tx/plumbing/complete.json.gz`
- `processed/dallas-tx/electrician/complete.json.gz`

### Artifact Format
```json
{
  "metadata": {
    "service": "plumbing",
    "location": "austin-tx", 
    "generated_at": "2024-12-29T10:00:00Z",
    "source_commit": "abc123def456",
    "business_count": 15,
    "faq_count": 8
  },
  "businesses": [...],
  "faqs": [...]
}
```

## Core Functions

### Request Handler Pattern
```javascript
export default {
  async fetch(request, env, ctx) {
    const { location, service } = parseRequest(request);
    const pageKey = `${location}/${service}`;
    
    // 1. Update heat (async, don't block response)
    ctx.waitUntil(updateHeat(env.DB, pageKey));
    
    // 2. Try KV cache (hot path)
    const cached = await env.KV.get(pageKey, "arrayBuffer");
    if (cached) return serveCompressed(cached);
    
    // 3. Try R2 (warm path)
    const r2Object = await env.R2.get(buildR2Key(location, service));
    if (r2Object) {
      const bytes = await r2Object.arrayBuffer();
      ctx.waitUntil(promoteToKV(env.KV, pageKey, bytes));
      return serveCompressed(bytes);
    }
    
    // 4. Rebuild from source (cold path)
    const rebuilt = await rebuildPage(env, location, service, pageKey);
    return serveCompressed(rebuilt);
  }
};
```

### Heat Tracking Pattern
```javascript
async function updateHeat(db, pageKey, location, service) {
  const now = Math.floor(Date.now() / 1000);
  
  await db.prepare(`
    INSERT INTO page_heat (
      page_key, location, service, last_accessed, 
      access_count_30d, artifact_exists, schema_version
    ) VALUES (?, ?, ?, ?, 1, 0, 1)
    ON CONFLICT(page_key) DO UPDATE SET
      last_accessed = excluded.last_accessed,
      access_count_30d = access_count_30d + 1
  `).bind(pageKey, location, service, now).run();
}
```

### Cleanup Job Pattern (Critical for Bounded Storage)
```javascript
async function runCleanup(env) {
  const cutoffTimestamp = Math.floor(Date.now() / 1000) - (90 * 24 * 3600);
  
  const { results } = await env.DB.prepare(`
    SELECT page_key, location, service FROM page_heat
    WHERE artifact_exists = 1 AND last_accessed < ?
  `).bind(cutoffTimestamp).all();
  
  for (const page of results) {
    const r2Key = `processed/${page.location}/${page.service}/complete.json.gz`;
    
    // Delete from R2
    await env.R2.delete(r2Key);
    
    // Update tracking
    await env.DB.prepare(`
      UPDATE page_heat SET artifact_exists = 0 WHERE page_key = ?
    `).bind(page.page_key).run();
  }
}
```

## Development Patterns

### Error Handling Strategy
```javascript
// Always degrade gracefully - never fail completely
try {
  const result = await primaryOperation();
  return result;
} catch (error) {
  console.error(`Primary failed: ${error.message}`);
  
  try {
    const fallback = await fallbackOperation();
    return fallback;
  } catch (fallbackError) {
    console.error(`Fallback failed: ${fallbackError.message}`);
    return emptyResponse();
  }
}
```

### Async Context Management
```javascript
// Use ctx.waitUntil for non-blocking operations
ctx.waitUntil(updateHeat(env.DB, pageKey));           // Don't block response
ctx.waitUntil(promoteToKV(env.KV, pageKey, data));    // Background cache warming
ctx.waitUntil(logAnalytics(pageKey, responseTime));   // Async logging
```

### Compression Handling
```javascript
// Always compress artifacts stored in R2
const compressed = gzipCompress(JSON.stringify(pageData));
await env.R2.put(r2Key, compressed, {
  httpMetadata: { 
    contentType: 'application/json',
    contentEncoding: 'gzip' 
  }
});

// Serve with proper headers
return new Response(compressed, {
  headers: {
    'Content-Type': 'application/json',
    'Content-Encoding': 'gzip',
    'Cache-Control': 'public, max-age=3600'
  }
});
```

## Configuration

### Environment Variables (`wrangler.toml`)
```toml
name = "cms-pages"
main = "src/worker.js"
compatibility_date = "2024-12-01"

[[d1_databases]]
binding = "DB"
database_name = "page-heat-tracker"

[[r2_buckets]]
binding = "R2" 
bucket_name = "page-artifacts"

[[kv_namespaces]]
binding = "KV"
id = "your-kv-namespace-id"

[triggers]
crons = ["0 3 * * *"]  # Daily cleanup at 3 AM UTC

[vars]
HOT_CACHE_TTL = "3600"      # 1 hour
WARM_CACHE_DAYS = "30"      # 30 days
COLD_THRESHOLD_DAYS = "90"  # 90 days
```

### Required Bindings
- `env.DB` - D1 database for heat tracking
- `env.R2` - Object storage for page artifacts
- `env.KV` - Hot cache for frequent pages

## Performance Optimization

### Cache Strategy
```javascript
// Three-tier caching with automatic promotion
// KV → R2 → HF (rebuild)

// Tier 1: KV (fastest)
const kvResult = await env.KV.get(pageKey, "arrayBuffer");

// Tier 2: R2 (fast, promote to KV)
if (!kvResult) {
  const r2Result = await env.R2.get(r2Key);
  if (r2Result) {
    ctx.waitUntil(env.KV.put(pageKey, r2Result, { expirationTtl: 3600 }));
  }
}

// Tier 3: Rebuild (slow, store in both R2 and KV)
```

### Avoid Common Pitfalls
```javascript
// ❌ Don't: Block requests on heat updates
await updateHeat(env.DB, pageKey);
return response;

// ✅ Do: Fire and forget with ctx.waitUntil
ctx.waitUntil(updateHeat(env.DB, pageKey));
return response;

// ❌ Don't: Store uncompressed data in R2
await env.R2.put(key, JSON.stringify(data));

// ✅ Do: Always compress large objects
await env.R2.put(key, gzipCompress(JSON.stringify(data)));
```

## Monitoring and Debugging

### Key Metrics to Track
```javascript
// Log these for monitoring
{
  pageKey: "austin-tx/plumbing",
  cacheHit: "kv|r2|rebuild",      // Which tier served the request
  responseTime: 45,                // Milliseconds
  artifactSize: 125440,           // Bytes
  timestamp: 1703851200
}
```

### Debug Logging Pattern
```javascript
async function debugLog(env, event, data) {
  if (env.DEBUG_MODE === "true") {
    console.log(`[${new Date().toISOString()}] ${event}:`, data);
  }
}

// Usage
await debugLog(env, "CACHE_MISS", { pageKey, tier: "kv" });
await debugLog(env, "REBUILD_STARTED", { pageKey, sourceCommit });
```

### Health Check Endpoint
```javascript
// GET /health - verify system components
if (url.pathname === "/health") {
  const checks = {
    db: await testDB(env.DB),
    r2: await testR2(env.R2), 
    kv: await testKV(env.KV)
  };
  
  return Response.json(checks);
}
```

## Deployment Workflow

### Initial Setup
```bash
# Create D1 database
wrangler d1 create page-heat-tracker

# Create R2 bucket  
wrangler r2 bucket create page-artifacts

# Create KV namespace
wrangler kv:namespace create "PAGE_CACHE"

# Deploy schema
wrangler d1 execute page-heat-tracker --file schema.sql

# Deploy worker
wrangler deploy
```

### Migration Strategy
```javascript
// Handle schema changes gracefully
const CURRENT_SCHEMA_VERSION = 2;

async function migrateIfNeeded(db) {
  const { results } = await db.prepare(
    "SELECT schema_version FROM page_heat LIMIT 1"
  ).all();
  
  if (results[0]?.schema_version < CURRENT_SCHEMA_VERSION) {
    await runMigration(db);
  }
}
```

## Cost Optimization

### Storage Bounds
```javascript
// These constants control costs directly
const HOT_CACHE_TTL = 3600;        // KV storage duration
const WARM_STORAGE_DAYS = 30;      // R2 retention period  
const COLD_THRESHOLD_DAYS = 90;    // Deletion threshold

// Estimated monthly costs for 250k active pages:
// R2 Storage: ~$0.90 (60GB at $0.015/GB)
// KV Reads: ~$5.00 (10M reads at $0.50/M)
// Workers: ~$1.50 (10M requests at $0.15/M)
// Total: ~$7.40/month
```

### Optimization Guidelines
1. **Compress all R2 objects** - saves 60-80% on storage
2. **Use appropriate KV TTL** - balance hit rate vs storage cost
3. **Monitor cold deletion rate** - too aggressive = more rebuilds
4. **Track cache hit ratios** - optimize tier balance

## Testing Strategy

### Unit Tests
```javascript
// Test heat tracking logic
test("updateHeat increases access count", async () => {
  const mockDB = createMockDB();
  await updateHeat(mockDB, "test-page", "austin-tx", "plumbing");
  
  const result = await mockDB.query("SELECT access_count_30d FROM page_heat WHERE page_key = ?", "test-page");
  expect(result.access_count_30d).toBe(1);
});
```

### Integration Tests
```javascript
// Test full request flow with Miniflare
test("request flow: KV miss → R2 hit → KV promotion", async () => {
  const env = await getMiniflareEnv();
  
  // Populate R2 with test data
  await env.R2.put("processed/austin-tx/plumbing/complete.json.gz", testData);
  
  // Make request
  const response = await worker.fetch(createRequest("/austin-tx/plumbing"), env);
  
  // Verify KV was populated
  const kvData = await env.KV.get("austin-tx/plumbing");
  expect(kvData).toBeTruthy();
});
```

## Troubleshooting

### Common Issues

**High R2 Storage Costs**
- Check cleanup job is running: `wrangler tail --compatibility-date 2024-12-01 --format pretty`
- Verify cold threshold settings
- Monitor page deletion rates

**Slow Response Times**
- Check cache hit ratios in logs
- Verify compression is enabled
- Monitor Worker CPU usage

**Failed Rebuilds**
- Check HuggingFace connectivity
- Verify source data exists
- Review error logs for rate limiting

**D1 Query Timeouts** 
- Add appropriate indexes
- Batch cleanup operations
- Monitor query execution times

This architecture provides a production-ready, cost-effective content management system that scales globally while maintaining predictable costs through intelligent heat-based storage management.
