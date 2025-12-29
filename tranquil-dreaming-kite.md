# Migration Plan: Sanity CMS → Cloudflare CMS

## Executive Summary

Migrate from Sanity CMS ($100-150/month) to Cloudflare-based architecture ($0-5/month) while maintaining full functionality, i18n support, and SEO.

**Key Decisions:**
- ✅ Disable user submissions (admin-only content)
- ✅ Use HuggingFace datasets as source of truth
- ✅ Extend Cloudflare CMS with admin write API
- ✅ Implement 3-tier caching: KV → R2 → HuggingFace rebuild

**Expected Savings:** $1,200-1,800/year

---

## Architecture Overview

### Data Flow
```
HuggingFace Datasets (source)
    ↓
Cloudflare Worker (build artifacts)
    ↓
R2 Storage (processed pages)
    ↓
KV Cache (hot pages)
    ↓
Next.js App (users)
```

### Content Types to Migrate
- Products (admin-managed, localized)
- Categories (admin-managed, localized, references Groups)
- Groups (admin-managed, localized)
- AppTypes (admin-managed, localized)
- Applications (formerly user-submitted, now admin-only)
- Tags, Guides, Settings

**Remove:** User, Submission types (submissions disabled)

---

### 1.2 Transform to HuggingFace Format

**Create script:** `scripts/transform-to-hf.ts`

**Target format:** JSONL (one JSON object per line)

**Localization strategy:** Flat locale-suffixed fields
```json
{
  "id": "prod-001",
  "name": "Next.js",
  "slug": "nextjs",
  "desc_en": "The React Framework for Production",
  "desc_zh": "用于生产的React框架",
  "category_id": "cat-001",
  "tag_ids": ["tag-001", "tag-002"]
}
```

**Key transformations:**
- Convert Sanity `_id` → clean `id` (e.g., "prod-001")
- Flatten localized fields: `desc.en` → `desc_en`
- Convert references: `category._ref` → `category_id`
- Transform Portable Text to simplified JSON

### 1.3 Migrate Images to R2

**Create script:** `scripts/migrate-images.ts`

```bash
# Create R2 bucket
wrangler r2 bucket create directory-assets

# Run migration
pnpm tsx scripts/migrate-images.ts
# Downloads from Sanity CDN → uploads to R2
# Updates all image URLs in transformed data
```

**Custom domain:** Configure `assets.yourdomain.com` in Cloudflare dashboard

### 1.4 Upload to HuggingFace

**Structure:** Separate dataset per content type
```
your-org/directory-products      → data.jsonl
your-org/directory-categories    → data.jsonl
your-org/directory-groups        → data.jsonl
your-org/directory-apptypes      → data.jsonl
your-org/directory-applications  → data.jsonl
your-org/directory-tags          → data.jsonl
your-org/directory-guides        → data.jsonl
your-org/directory-settings      → data.jsonl
```

**Upload:**
```bash
pip install huggingface_hub
huggingface-cli login
cd migration/hf-datasets/products
huggingface-cli upload your-org/directory-products . --repo-type dataset
# Repeat for all content types
```

---

## Phase 2: Cloudflare Infrastructure (Week 2)

### 2.1 Create Cloudflare Workers Project

**File structure:**
```
workers/cms-api/
  src/
    index.ts          # Main request handler
    builder.ts        # Artifact builder
    admin.ts          # Admin write API (future)
  wrangler.toml       # Configuration
  package.json
  schema.sql          # D1 schema
```

### 2.2 D1 Database Setup

**Create database:**
```bash
wrangler d1 create directory-heat-tracker
```

**Schema** (`schema.sql`):
```sql
CREATE TABLE page_heat (
    page_key TEXT PRIMARY KEY,           -- "en:product:nextjs"
    locale TEXT NOT NULL,                -- "en"
    content_type TEXT NOT NULL,          -- "product", "category", etc.
    slug TEXT NOT NULL,                  -- "nextjs"
    last_accessed INTEGER NOT NULL,      -- Unix timestamp
    access_count_30d INTEGER NOT NULL,   -- Rolling 30-day counter
    last_built INTEGER,                  -- When artifact was created
    artifact_exists INTEGER NOT NULL,    -- 0 or 1
    last_source_commit TEXT,
    schema_version INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_last_accessed ON page_heat(last_accessed);
CREATE INDEX idx_artifact_exists ON page_heat(artifact_exists);
CREATE INDEX idx_content_type ON page_heat(content_type);
CREATE INDEX idx_locale ON page_heat(locale);
```

**Deploy schema:**
```bash
wrangler d1 execute directory-heat-tracker --file schema.sql
```

### 2.3 R2 + KV Setup

```bash
# Create R2 bucket for artifacts
wrangler r2 bucket create directory-artifacts

# Create KV namespace for hot cache
wrangler kv:namespace create "DIRECTORY_CACHE"
# Copy namespace ID to wrangler.toml
```

### 2.4 Configure wrangler.toml

```toml
name = "cms-api"
main = "src/index.ts"
compatibility_date = "2024-12-01"

[[d1_databases]]
binding = "DB"
database_name = "directory-heat-tracker"
database_id = "<from-step-2.2>"

[[r2_buckets]]
binding = "R2"
bucket_name = "directory-artifacts"

[[kv_namespaces]]
binding = "KV"
id = "<from-step-2.3>"

[vars]
HF_TOKEN = "<your-hf-read-token>"

[triggers]
crons = ["0 3 * * *"]  # Daily cleanup at 3 AM UTC
```

### 2.5 Implement Worker (`workers/cms-api/src/index.ts`)

**Core logic:**
```typescript
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Parse: /api/cms/{locale}/{type}/{slug}
    const { locale, type, slug } = parseRequest(request);
    const pageKey = `${locale}:${type}:${slug}`;

    // 1. Update heat (non-blocking)
    ctx.waitUntil(updateHeat(env.DB, pageKey, locale, type, slug));

    // 2. Try KV cache (1-5ms)
    const cached = await env.KV.get(pageKey, 'arrayBuffer');
    if (cached) return serveCompressed(cached);

    // 3. Try R2 (10-50ms)
    const r2Key = `artifacts/${locale}/${type}/${slug}/complete.json.gz`;
    const r2Object = await env.R2.get(r2Key);
    if (r2Object) {
      const bytes = await r2Object.arrayBuffer();
      ctx.waitUntil(promoteToKV(env.KV, pageKey, bytes));
      return serveCompressed(bytes);
    }

    // 4. Rebuild from HuggingFace (100ms+)
    const rebuilt = await rebuildArtifact(env, locale, type, slug);
    return serveCompressed(rebuilt);
  }
};
```

**Key functions:**
- `updateHeat()`: Track page access in D1
- `promoteToKV()`: Cache R2 data in KV with 1h TTL
- `rebuildArtifact()`: Fetch from HF, denormalize, compress, store in R2

### 2.6 Implement Builder (`workers/cms-api/src/builder.ts`)

**Artifact structure:**
```
artifacts/{locale}/{type}/{slug}/complete.json.gz

Examples:
artifacts/en/product/nextjs/complete.json.gz
artifacts/zh/category/web-dev/complete.json.gz
artifacts/en/apptype/saas/complete.json.gz
```

**Artifact format:**
```json
{
  "metadata": {
    "type": "product",
    "locale": "en",
    "slug": "nextjs",
    "generated_at": "2024-12-29T10:00:00Z"
  },
  "product": {
    "id": "prod-001",
    "name": "Next.js",
    "desc": "The React Framework...",
    "category": {
      "id": "cat-001",
      "name": "Web Development",
      "group": { "id": "grp-001", "name": "Development" }
    },
    "tags": [...],
    "guides": [...]
  }
}
```

**Builder logic:**
1. Fetch all datasets from HuggingFace (parallel)
2. Find target entity by slug
3. Resolve references (denormalize)
4. Select locale-specific fields (`desc_${locale}`)
5. Compress with gzip
6. Store in R2
7. Update D1 tracking

### 2.7 Deploy Worker

```bash
cd workers/cms-api
pnpm install pako # for gzip compression
pnpm install
wrangler deploy
```

**Worker URL:** `https://cms-api.yourdomain.workers.dev`

---

## Phase 3: Next.js Integration (Week 3)

### 3.1 Create CMS Fetch Utility

**New file:** `lib/cms/fetch.ts`

```typescript
const CMS_API_URL = process.env.NEXT_PUBLIC_CMS_API_URL || 'http://localhost:8787/api/cms';

export async function cmsFetch<T>(
  locale: string,
  type: 'product' | 'category' | 'apptype' | 'application' | 'groups' | 'index',
  slug: string,
  options?: { useCache?: boolean }
): Promise<T | null> {
  const url = `${CMS_API_URL}/${locale}/${type}/${slug}`;

  const response = await fetch(url, {
    next: { revalidate: options?.useCache !== false ? 3600 : 0 },
  });

  if (!response.ok) return null;

  return await response.json();
}
```

### 3.2 Update Product Page

**File:** `app/[lang]/(main)/(product)/product/[product]/page.tsx`

**Before:**
```typescript
const productQueryResult = await sanityFetch<ProductQueryResult>({
  query: productQuery,
  params: { ...queryParams, slug: product },
});
```

**After:**
```typescript
import { cmsFetch } from '@/lib/cms/fetch';

const productData = await cmsFetch<{ product: any }>(
  lang,
  'product',
  product
);

if (!productData) return notFound();
const productQueryResult = productData.product;
```

### 3.3 Update Sitemap

**File:** `app/sitemap.ts`

**Before:**
```typescript
const [appListQueryResult, appTypeListQueryResult, ...] = await Promise.all([
  sanityFetch({ query: appListQueryForSitemap }),
  // ...
]);
```

**After:**
```typescript
const sitemapData = await cmsFetch<{
  products: Array<{ slug: string }>,
  categories: Array<{ slug: string, group_slug: string }>,
  applications: Array<{ name: string }>,
  apptypes: Array<{ slug: string }>
}>('en', 'sitemap', 'all');

// Build sitemap URLs from flat data
```

**Create sitemap artifact:** `artifacts/sitemap/all/complete.json.gz`

### 3.4 Update All Page Components

**Files to modify:**
- `app/[lang]/(main)/(product)/product/[product]/page.tsx` ✓
- `app/[lang]/(main)/(product)/group/[group]/category/[category]/page.tsx`
- `app/[lang]/(main)/(product)/group/[group]/page.tsx`
- `app/[lang]/(main)/(indieapp)/app/[app]/page.tsx`
- `app/[lang]/(main)/(indieapp)/apptype/[type]/page.tsx`
- `app/[lang]/(main)/page.tsx` (homepage)
- `app/sitemap.ts` ✓

**Pattern:** Replace all `sanityFetch()` calls with `cmsFetch()`

### 3.5 Create Type Definitions

**New file:** `lib/cms/types.ts`

```typescript
export interface ProductData {
  id: string;
  name: string;
  slug: string;
  desc: string;
  price?: string;
  website?: string;
  github?: string;
  logo_url: string;
  cover_url?: string;
  content: any[];
  category: {
    id: string;
    name: string;
    slug: string;
    group: {
      id: string;
      name: string;
      slug: string;
    }
  };
  tags: Array<{ id: string; name: string; slug: string }>;
  guides: Array<{ id: string; name: string; slug: string; link: string }>;
}

export interface ProductArtifact {
  metadata: {
    type: 'product';
    locale: string;
    slug: string;
    generated_at: string;
  };
  product: ProductData;
}

// Similar interfaces for Category, AppType, Application, etc.
```

### 3.6 Replace Portable Text Renderer

**Before:** Uses `@portabletext/react`

**After:** Create custom renderer

**New file:** `components/content-renderer.tsx`

```typescript
export function ContentRenderer({ content }: { content: any[] }) {
  return (
    <div className="prose">
      {content.map((block, i) => {
        if (block.type === 'paragraph') {
          return <p key={i}>{renderChildren(block.children)}</p>;
        }
        if (block.type === 'image') {
          return <img key={i} src={block.asset_url} alt="" />;
        }
        // ... handle other block types
      })}
    </div>
  );
}
```

### 3.7 Environment Variables

**Update `.env`:**
```diff
- NEXT_PUBLIC_SANITY_PROJECT_ID=xxx
- NEXT_PUBLIC_SANITY_DATASET=production
- NEXT_PUBLIC_SANITY_API_WRITE_TOKEN=xxx
+ NEXT_PUBLIC_CMS_API_URL=https://cms-api.yourdomain.workers.dev/api/cms
```

### 3.8 Remove Sanity Dependencies

**Delete directories:**
```
/sanity/*
/actions/submit-application.ts
/actions/update-application.ts
/actions/delete-application.ts
/actions/share-resource.ts
```

**Update `package.json`:**
```diff
- "next-sanity": "^9.0.13",
- "@sanity/image-url": "^1.0.2",
- "@portabletext/react": "^3.0.18",
- "@sanity/block-content-to-markdown": "^0.0.5",
```

**Delete files:**
```
sanity.types.ts
```

---

## Phase 4: Testing & Deployment (Week 4)

### 4.1 Local Testing

```bash
# Terminal 1: Run Cloudflare Worker locally
cd workers/cms-api
wrangler dev --port 8787

# Terminal 2: Run Next.js dev server
cd ../..
pnpm dev
```

**Test checklist:**
- [ ] Product detail pages load
- [ ] Category pages load
- [ ] Application pages load
- [ ] Homepage loads
- [ ] Sitemap generates
- [ ] Images display correctly
- [ ] Locale switching works (en ↔ zh)
- [ ] 404 pages work for invalid slugs

### 4.2 Deploy to Production

**Deploy Worker:**
```bash
cd workers/cms-api
wrangler deploy
```

**Deploy Next.js:**
```bash
# Update NEXT_PUBLIC_CMS_API_URL to production Worker URL
vercel --prod
```

### 4.3 Gradual Rollout with Feature Flag

**Optional safety measure:**

```typescript
const USE_CLOUDFLARE_CMS = process.env.USE_CLOUDFLARE_CMS === 'true';

export async function fetchContent(...) {
  if (USE_CLOUDFLARE_CMS) {
    return await cmsFetch(...);
  } else {
    return await sanityFetch(...);  // Fallback
  }
}
```

**Rollout:**
1. Deploy with flag=false (uses Sanity)
2. Set flag=true, test with traffic
3. Monitor for errors
4. Remove flag + Sanity code once stable

### 4.4 Monitoring

**Worker logs:**
```bash
wrangler tail
```

**Key metrics to track:**
- Cache hit ratio (KV vs R2 vs rebuild)
- Average response time
- Error rate
- D1 query performance

---

## Phase 5: Admin Content Management

Since user submissions are disabled, choose one approach:

### Option A: Direct HuggingFace Editing (Recommended for MVP)

**Workflow:**
1. Admin edits `.jsonl` files in HuggingFace web interface
2. Commit changes
3. Manually trigger cache invalidation:
   ```bash
   curl -X POST https://cms-api.yourdomain.workers.dev/admin/invalidate/product/nextjs \
     -H "Authorization: Bearer $ADMIN_KEY"
   ```

**Pros:** Zero dev time, version controlled
**Cons:** Manual JSONL editing

### Option B: Admin API (Future Enhancement)

Build REST API for content management:

```typescript
// POST /admin/products
{
  "name": "New Tool",
  "slug": "new-tool",
  "desc_en": "Description",
  "desc_zh": "描述",
  ...
}
```

**Implementation:** Store in D1, manual sync to HuggingFace

---

## Critical Files Summary

### Files to Create

1. **`workers/cms-api/src/index.ts`** - Main Worker (KV→R2→rebuild logic)
2. **`workers/cms-api/src/builder.ts`** - Artifact builder (fetch HF, denormalize, compress)
3. **`lib/cms/fetch.ts`** - Next.js fetch utility (replaces sanityFetch)
4. **`lib/cms/types.ts`** - TypeScript types for artifacts
5. **`components/content-renderer.tsx`** - Portable Text replacement
6. **`scripts/export-from-sanity.ts`** - One-time export
7. **`scripts/transform-to-hf.ts`** - Transform to JSONL
8. **`scripts/migrate-images.ts`** - R2 image migration

### Files to Modify

1. **`app/[lang]/(main)/(product)/product/[product]/page.tsx`** - Replace sanityFetch
2. **`app/[lang]/(main)/(product)/group/[group]/category/[category]/page.tsx`** - Replace sanityFetch
3. **`app/[lang]/(main)/(product)/group/[group]/page.tsx`** - Replace sanityFetch
4. **`app/[lang]/(main)/(indieapp)/app/[app]/page.tsx`** - Replace sanityFetch
5. **`app/[lang]/(main)/(indieapp)/apptype/[type]/page.tsx`** - Replace sanityFetch
6. **`app/[lang]/(main)/page.tsx`** - Replace sanityFetch
7. **`app/sitemap.ts`** - Replace sanityFetch, use sitemap artifact

### Files to Delete

1. **`/sanity/*`** - Entire directory
2. **`/actions/submit-application.ts`** - User submissions disabled
3. **`/actions/update-application.ts`** - User submissions disabled
4. **`/actions/delete-application.ts`** - User submissions disabled
5. **`/actions/share-resource.ts`** - User submissions disabled
6. **`sanity.types.ts`** - No longer needed

---

## Cost Breakdown

**Cloudflare (Free Tier):**
- Workers: 100,000 requests/day (est. 10k/day) = **$0**
- R2: 10GB storage (est. 600MB) = **$0**
- KV: 100,000 reads/day (est. 5k/day) = **$0**
- D1: 5M reads/month (est. 300k/month) = **$0**

**Total: $0-5/month** (staying within free tiers)

**Sanity Costs:** $100-150/month

**Savings:** $1,200-1,800/year

---

## Rollback Strategy

If issues arise, immediate rollback is possible:

1. **Keep Sanity active during migration** (1-2 weeks overlap)
2. **Use feature flag** to switch between systems
3. **Instant rollback:** Set `USE_CLOUDFLARE_CMS=false`, redeploy
4. **Data backups:** All exports saved in `migration/sanity-export/`

**Cost of overlap:** ~$100 (1 month Sanity subscription)

---

## Success Criteria

- [ ] All URLs work (SEO preserved)
- [ ] Both locales work (en, zh)
- [ ] Images load from R2
- [ ] Response times < 100ms (KV cache hits)
- [ ] Sitemap generates correctly
- [ ] No Sanity dependencies in package.json
- [ ] Monthly cost < $10
- [ ] Admin can update content via HuggingFace

---

## Timeline Summary

- **Week 1:** Export data, transform to JSONL, migrate images, upload to HuggingFace
- **Week 2:** Create Cloudflare infrastructure (Worker, D1, R2, KV)
- **Week 3:** Update Next.js integration, replace sanityFetch, test locally
- **Week 4:** Deploy to production, gradual rollout, monitoring
- **Week 5:** Optimize, remove Sanity code, cancel subscription

**Total effort:** ~40 hours
**Cost savings:** $1,200-1,800/year
