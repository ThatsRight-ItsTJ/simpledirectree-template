# CMS API - Cloudflare Workers

A high-performance CMS API built with Cloudflare Workers featuring 3-tier caching, heat tracking, and HuggingFace integration.

## Architecture

### 3-Tier Caching Strategy
1. **KV Cache** (1-5ms) - Fast in-memory cache with 1-hour TTL
2. **R2 Storage** (10-50ms) - Persistent object storage with 24-hour TTL  
3. **HuggingFace Rebuild** (100ms+) - On-demand content generation

### Key Features
- **Multi-language support**: English (en) and Chinese (zh)
- **Content types**: Pages, posts, products, guides, documentation
- **Heat tracking**: D1 database analytics for popular content
- **Compression**: Gzip compression using Pako
- **Admin API**: Management endpoints for cache control and monitoring
- **Analytics**: Comprehensive logging and metrics

## Project Structure

```
workers/cms-api/
├── src/
│   ├── index.ts          # Main request handler
│   ├── builder.ts        # Artifact builder (HF integration)
│   ├── admin.ts          # Admin write API
│   ├── types.ts          # TypeScript types and interfaces
│   └── cloudflare-types.d.ts # Cloudflare type declarations
├── wrangler.toml       # Configuration
├── package.json
├── schema.sql          # D1 database schema
└── README.md
```

## API Endpoints

### Main CMS API
- `GET /api/cms/{locale}/{type}/{slug}` - Retrieve content
  - Example: `/api/cms/en/page/home`

### Admin API
- `GET /admin/health` - Health check
- `POST /admin/rebuild/{locale}/{type}/{slug}` - Trigger manual rebuild
- `GET /admin/cache/stats` - Get cache statistics
- `DELETE /admin/cache/{locale}/{type}/{slug}` - Clear cache
- `GET /admin/logs` - Get system logs
- `PUT /admin/config` - Update configuration

### Health Check
- `GET /health` - Basic health check

## Setup

### 1. Install Dependencies
```bash
cd workers/cms-api
npm install
```

### 2. Configure Wrangler
Update `wrangler.toml` with your Cloudflare credentials:
- KV namespace ID
- R2 bucket name
- D1 database ID
- HuggingFace API token

### 3. Set Environment Variables
```bash
wrangler secret put HF_TOKEN
wrangler secret put ADMIN_SECRET
```

### 4. Deploy
```bash
wrangler deploy
```

## Development

### Local Development
```bash
wrangler dev
```

### Type Checking
```bash
wrangler types
```

### Tail Logs
```bash
wrangler tail
```

## Database Schema

The D1 database includes:
- `page_heat` table for tracking access analytics
- Indexes for performance optimization
- Schema versioning for migrations

## Configuration

### Environment Variables
- `ENVIRONMENT`: 'development' | 'staging' | 'production'
- `HF_TOKEN`: HuggingFace API token
- `ADMIN_SECRET`: Admin authentication secret

### Cache Configuration
- **KV TTL**: 1 hour (3,600 seconds)
- **R2 TTL**: 24 hours (86,400 seconds)
- **Compression Level**: 6 (gzip)

## Performance

### Expected Response Times
- **Cache Hit (KV)**: 1-5ms
- **Cache Hit (R2)**: 10-50ms
- **Cache Miss (HF)**: 100ms+

### Compression
- Uses Pako for gzip compression
- Typical compression ratio: 70-90%
- Max content size: 10MB

## Error Handling

### Error Types
- `CMSAPIError`: Base error class
- `CacheError`: Cache-related errors
- `ValidationError`: Input validation errors

### Error Response Format
```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "timestamp": "2023-12-29T20:00:00.000Z"
}
```

## Analytics

### Tracked Events
- Page views
- Cache hits/misses
- Error events
- Response times
- User agent and IP tracking

### Database Tables
- `page_heat`: Access analytics
- `analytics_events`: Detailed event logging
- `schema_version`: Schema management

## Security

### Admin API Protection
- Bearer token authentication
- Request validation
- Input sanitization

### Rate Limiting
- Built-in Cloudflare rate limiting
- Request size limits
- Connection pooling

## Monitoring

### Logs
- Structured logging with timestamps
- Error tracking and debugging
- Performance metrics

### Metrics
- Cache hit rates
- Response times
- Error rates
- Database query performance

## Contributing

1. Follow TypeScript best practices
2. Add error handling for all operations
3. Include comprehensive logging
4. Test all changes thoroughly
5. Update documentation as needed

## License

This project is part of the SimpleDirectree template and follows the same license terms.