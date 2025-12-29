# Cloudflare CMS Migration - Local Testing Guide

## Table of Contents
- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Running Cloudflare Worker Locally](#running-cloudflare-worker-locally)
- [Running Next.js Development Server](#running-nextjs-development-server)
- [Test Checklist](#test-checklist)
- [Troubleshooting](#troubleshooting)

## Prerequisites

Before starting local testing, ensure you have the following installed:

- Node.js v18+ (recommended: v20+)
- pnpm (package manager)
- Wrangler CLI (Cloudflare Workers)
- Docker (for local database testing)

```bash
# Install Wrangler CLI globally
npm install -g wrangler

# Install pnpm globally
npm install -g pnpm
```

## Environment Setup

### 1. Clone the Repository

```bash
git clone https://github.com/your-repo/simpledirectree-template.git
cd simpledirectree-template
```

### 2. Install Dependencies

```bash
# Install root dependencies
pnpm install

# Install Cloudflare Worker dependencies
cd workers/cms-api
pnpm install
cd ../..
```

### 3. Set Up Environment Variables

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit the `.env` file with your local configuration:

```env
# Next.js configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Cloudflare CMS configuration
NEXT_PUBLIC_CMS_API_URL=http://localhost:8787
CMS_API_SECRET=your-local-secret-key

# Database configuration (for local testing)
DATABASE_URL='postgres://localhost:5432/cms_test?user=postgres&password=postgres'
```

### 4. Set Up Cloudflare Worker Environment

Create a `wrangler.toml` file in the `workers/cms-api` directory if it doesn't exist, or configure the existing one:

```toml
name = "cms-api-dev"
main = "src/index.ts"
compatibility_date = "2023-12-21"

# Local development bindings
[[kv_namespaces]]
binding = "KV_CACHE"
id = "your-local-kv-id"
preview_id = "your-local-kv-preview-id"

[[r2_buckets]]
binding = "R2_STORAGE"
bucket_name = "cms-artifacts-dev"
preview_bucket_name = "cms-artifacts-dev-preview"

[[d1_databases]]
binding = "DB"
database_name = "cms-analytics-dev"
database_id = "your-local-d1-id"
preview_database_id = "your-local-d1-preview-id"

[env.dev.vars]
HF_TOKEN = "your-huggingface-token"
ADMIN_SECRET = "your-admin-secret-key"
ENVIRONMENT = "development"
```

## Running Cloudflare Worker Locally

### 1. Start the Worker in Development Mode

```bash
cd workers/cms-api
pnpm run dev
```

This will start the Cloudflare Worker on `http://localhost:8787` by default.

### 2. Worker Development Commands

```bash
# Start worker in development mode
pnpm run dev

# Deploy worker to Cloudflare (for testing)
pnpm run deploy

# Tail worker logs
pnpm run tail

# Generate TypeScript types
pnpm run types
```

### 3. Testing Worker Endpoints

You can test the worker endpoints using curl or Postman:

```bash
# Test health endpoint
curl http://localhost:8787/health

# Test CMS API endpoint
curl http://localhost:8787/api/cms/austin-tx/plumbing

# Test admin endpoint (requires secret)
curl -H "Authorization: Bearer your-admin-secret-key" \
  http://localhost:8787/api/admin/health
```

## Running Next.js Development Server

### 1. Start Next.js Development Server

```bash
# From the root directory
pnpm run dev
```

This will start the Next.js application on `http://localhost:3000`.

### 2. Next.js Development Commands

```bash
# Start development server
pnpm run dev

# Build for production
pnpm run build

# Start production server
pnpm run start

# Run linter
pnpm run lint

# Run type checking
pnpm run type-check
```

### 3. Testing Next.js Integration

Open your browser and navigate to:
- `http://localhost:3000` - Main application
- `http://localhost:3000/api/health` - API health check
- `http://localhost:3000/en` - English version
- `http://localhost:3000/zh` - Chinese version

## Test Checklist

### Cloudflare Worker Tests

- [ ] Health endpoint returns 200 OK
- [ ] CMS API endpoints return valid JSON responses
- [ ] Cache headers are properly set
- [ ] Compression is working (Content-Encoding: gzip)
- [ ] Error handling returns appropriate status codes
- [ ] Admin endpoints require authentication
- [ ] Heat tracking updates D1 database
- [ ] KV cache promotion works correctly
- [ ] R2 storage and retrieval works
- [ ] Fallback to HuggingFace when cache misses occur

### Next.js Application Tests

- [ ] Application loads without errors
- [ ] CMS content is displayed correctly
- [ ] Language switching works (en/zh)
- [ ] Navigation between pages works
- [ ] Search functionality works
- [ ] Mobile responsiveness is correct
- [ ] Authentication flows work (if applicable)
- [ ] API routes return correct data
- [ ] Error pages display properly
- [ ] Loading states work correctly

### Integration Tests

- [ ] Next.js can communicate with Cloudflare Worker
- [ ] CORS headers are properly configured
- [ ] Authentication tokens are passed correctly
- [ ] Content updates propagate correctly
- [ ] Cache invalidation works
- [ ] Error handling between services works
- [ ] Performance is acceptable (< 500ms response times)
- [ ] Internationalization works with CMS content
- [ ] SEO metadata is correct
- [ ] Sitemap generation works

### Performance Tests

- [ ] Page load times < 2s
- [ ] API response times < 300ms (cached), < 1s (uncached)
- [ ] Memory usage stays within limits
- [ ] No memory leaks detected
- [ ] Database queries execute quickly
- [ ] Cache hit ratio > 80%
- [ ] Compression reduces payload size by > 60%
- [ ] Concurrent request handling works
- [ ] Rate limiting works correctly
- [ ] Error rates < 1%

## Troubleshooting

### Common Issues and Solutions

#### 1. Worker Fails to Start

**Symptoms:**
- `wrangler dev` exits immediately
- Error: "Cannot find module '...'"

**Solutions:**
- Run `pnpm install` in the worker directory
- Check Node.js version (requires v18+)
- Delete `node_modules` and reinstall dependencies
- Check for syntax errors in TypeScript files

#### 2. Next.js Fails to Start

**Symptoms:**
- `pnpm run dev` shows compilation errors
- Browser shows blank page

**Solutions:**
- Run `pnpm run lint` to check for code issues
- Check environment variables in `.env` file
- Clear Next.js cache: `rm -rf .next/`
- Check for missing dependencies

#### 3. Worker and Next.js Communication Issues

**Symptoms:**
- API calls from Next.js fail
- CORS errors in browser console
- 404 or 500 errors from worker

**Solutions:**
- Verify `NEXT_PUBLIC_CMS_API_URL` is correct
- Check CORS headers in worker response
- Test worker endpoints directly with curl
- Check network connectivity between services
- Verify authentication tokens

#### 4. Database Connection Issues

**Symptoms:**
- D1 database queries fail
- Worker logs show database errors

**Solutions:**
- Check database bindings in `wrangler.toml`
- Verify database exists and is accessible
- Check database schema matches expectations
- Test with mock data first

#### 5. Cache Issues

**Symptoms:**
- Stale content being served
- Cache not updating
- High cache miss rate

**Solutions:**
- Check KV namespace configuration
- Verify cache TTL settings
- Test cache invalidation manually
- Monitor cache hit/miss ratios
- Check cache key generation logic

#### 6. Performance Issues

**Symptoms:**
- Slow response times
- High CPU usage
- Memory leaks

**Solutions:**
- Check for blocking operations
- Verify async operations use `ctx.waitUntil`
- Monitor database query performance
- Check compression is enabled
- Profile worker execution

### Debugging Tools

#### Worker Debugging

```bash
# Tail worker logs
cd workers/cms-api
pnpm run tail

# Run worker with debug logging
wrangler dev --log-level debug

# Test specific endpoints
curl -v http://localhost:8787/api/cms/test-page
```

#### Next.js Debugging

```bash
# Run Next.js with debug logging
DEBUG=nextjs:* pnpm run dev

# Check build output
pnpm run build

# Analyze bundle size
pnpm run analyze
```

#### Network Debugging

```bash
# Test connectivity between services
curl -v http://localhost:8787/health

# Check DNS resolution
nslookup localhost

# Test port availability
netstat -tuln | grep 8787
```

### Logging and Monitoring

Add debug logging to your worker:

```typescript
// In workers/cms-api/src/index.ts
async function debugLog(env: Env, event: string, data: any) {
  if (env.ENVIRONMENT === "development") {
    console.log(`[${new Date().toISOString()}] ${event}:`, JSON.stringify(data, null, 2));
  }
}

// Usage in your fetch handler
await debugLog(env, "REQUEST_STARTED", { 
  path: request.url, 
  method: request.method 
});
```

## Advanced Testing

### Load Testing

Use tools like `k6` or `artillery` to test performance under load:

```bash
# Install k6
npm install -g k6

# Create a test script (load-test.js)
import http from 'k6/http';
import { check } from 'k6';

export default function () {
  const res = http.get('http://localhost:8787/api/cms/austin-tx/plumbing');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500
  });
}

# Run load test
k6 run --vus 10 --duration 30s load-test.js
```

### End-to-End Testing

Use Playwright or Cypress for comprehensive E2E testing:

```bash
# Install Playwright
npm install -g @playwright/test

# Create a test file
test('CMS integration test', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.waitForSelector('.cms-content');
  
  const content = await page.textContent('.cms-content');
  expect(content).toContain('test content');
});

# Run tests
playwright test
```

## Best Practices for Local Testing

1. **Use consistent environment variables** across all services
2. **Test with realistic data volumes** to catch performance issues early
3. **Monitor resource usage** during testing
4. **Test error conditions** and edge cases
5. **Document test results** for future reference
6. **Automate repetitive tests** to save time
7. **Test on different devices** and browsers
8. **Validate security** configurations
9. **Test backup and restore** procedures
10. **Document all issues** and their resolutions