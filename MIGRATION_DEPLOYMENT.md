# Cloudflare CMS Migration - Production Deployment Guide

## Table of Contents
- [Pre-deployment Checklist](#pre-deployment-checklist)
- [Cloudflare Worker Deployment](#cloudflare-worker-deployment)
- [Next.js Production Deployment](#nextjs-production-deployment)
- [Environment Variable Setup](#environment-variable-setup)
- [Monitoring and Logging Setup](#monitoring-and-logging-setup)
- [Post-deployment Verification](#post-deployment-verification)
- [Maintenance Procedures](#maintenance-procedures)

## Pre-deployment Checklist

Before deploying to production, ensure all items are completed:

- [ ] All local tests pass
- [ ] Code review completed
- [ ] Security audit performed
- [ ] Backup of existing systems
- [ ] Rollback plan documented
- [ ] Monitoring configured
- [ ] Alerting thresholds set
- [ ] Documentation updated
- [ ] Team notification sent
- [ ] Maintenance window scheduled

## Cloudflare Worker Deployment

### 1. Prepare Production Environment

Ensure your `wrangler.toml` is configured for production:

```toml
name = "cms-api-production"
main = "src/index.ts"
compatibility_date = "2023-12-21"

[env.production]
vars = { ENVIRONMENT = "production" }

# Production KV namespace
[[kv_namespaces]]
binding = "KV_CACHE"
id = "your-production-kv-id"
preview_id = "your-production-kv-preview-id"

# Production R2 bucket
[[r2_buckets]]
binding = "R2_STORAGE"
bucket_name = "cms-artifacts-production"
preview_bucket_name = "cms-artifacts-production-preview"

# Production D1 database
[[d1_databases]]
binding = "DB"
database_name = "cms-analytics-production"
database_id = "your-production-d1-id"
preview_database_id = "your-production-d1-preview-id"

[env.production.vars]
HF_TOKEN = "your-huggingface-production-token"
ADMIN_SECRET = "your-production-admin-secret"
CACHE_TTL = "3600"
MAX_REBUILD_ATTEMPTS = "3"
```

### 2. Set Up Cloudflare Resources

```bash
# Create production D1 database
wrangler d1 create cms-analytics-production

# Create production R2 bucket
wrangler r2 bucket create cms-artifacts-production

# Create production KV namespace
wrangler kv:namespace create "PAGE_CACHE_PRODUCTION"
```

### 3. Initialize Database Schema

```bash
# Deploy schema to production D1 database
cd workers/cms-api
wrangler d1 execute cms-analytics-production --file schema.sql --remote
```

### 4. Set Up Secrets

```bash
# Set HuggingFace token
wrangler secret put HF_TOKEN --env production

# Set admin secret
wrangler secret put ADMIN_SECRET --env production

# Set other sensitive variables
wrangler secret put CMS_API_SECRET --env production
```

### 5. Deploy Worker to Production

```bash
# Deploy to production environment
wrangler deploy --env production

# Verify deployment
wrangler deployments list --env production
```

### 6. Configure Worker Settings

```bash
# Set up cron triggers for cleanup
wrangler cron trigger create "0 3 * * *" --env production

# Configure custom domains (if needed)
wrangler domains add cms-api.yourdomain.com --env production

# Set up rate limiting
wrangler rate-limit create --limit 1000 --period 60 --env production
```

## Next.js Production Deployment

### 1. Build Production Bundle

```bash
# From root directory
pnpm run build
```

### 2. Set Up Production Environment Variables

Create a production `.env.production` file:

```env
# Production configuration
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NEXT_PUBLIC_CMS_API_URL=https://cms-api.yourdomain.com

# Database
DATABASE_URL='postgres://production-user:production-password@production-host/production-db?sslmode=require'

# Authentication
NEXTAUTH_SECRET=your-production-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Cloudflare CMS
CMS_API_SECRET=your-production-api-secret

# Analytics
NEXT_PUBLIC_ANALYTICS_ID=your-analytics-id
```

### 3. Deployment Options

#### Option A: Vercel Deployment

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy to Vercel
vercel --prod

# Configure project settings
vercel env pull .env.production
vercel deploy --prod
```

#### Option B: Docker Deployment

```bash
# Build Docker image
docker build -t cms-nextjs-production .

# Run container
docker run -d -p 3000:3000 \
  --env-file .env.production \
  --name cms-nextjs \
  cms-nextjs-production

# For Kubernetes deployment
kubectl apply -f k8s-production.yaml
```

#### Option C: Manual Server Deployment

```bash
# Copy build files to server
scp -r .next user@production-server:/var/www/cms/

# Install PM2 for process management
npm install -g pm2

# Start production server
pm2 start npm --name "cms-nextjs" -- run start

# Set up PM2 to start on boot
pm2 startup
pm2 save
```

### 4. Configure Web Server

**Nginx Configuration:**

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Static file caching
    location /_next/static {
        expires 365d;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
    
    # API routes
    location /api {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
    }
}
```

**SSL Configuration:**

```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal
sudo certbot renew --dry-run
```

## Environment Variable Setup

### Cloudflare Worker Environment Variables

```bash
# Set environment variables for production
wrangler secret put HF_TOKEN --env production
wrangler secret put ADMIN_SECRET --env production
wrangler secret put CMS_API_SECRET --env production

# Set non-secret variables
wrangler var set --env production CACHE_TTL 3600
wrangler var set --env production MAX_REBUILD_ATTEMPTS 3
wrangler var set --env production ENABLE_ANALYTICS true
```

### Next.js Environment Variables

```bash
# For Vercel deployment
vercel env add NEXT_PUBLIC_CMS_API_URL production
vercel env add CMS_API_SECRET production

# For Docker/Kubernetes
# Add to your .env.production file and mount as secret

# For manual deployment
export NEXT_PUBLIC_CMS_API_URL=https://cms-api.yourdomain.com
export CMS_API_SECRET=your-production-secret
```

### Environment Variable Best Practices

1. **Never commit secrets** to version control
2. **Use different secrets** for each environment
3. **Rotate secrets regularly** (every 90 days)
4. **Limit access** to production secrets
5. **Use secret management** tools (Vault, AWS Secrets Manager)
6. **Audit secret usage** regularly
7. **Monitor for secret leaks**
8. **Document all secrets** and their purposes

## Monitoring and Logging Setup

### Cloudflare Worker Monitoring

```bash
# Tail production logs
wrangler tail --env production

# View historical logs
wrangler logs --env production --since "1 hour ago"

# Set up log forwarding
wrangler logpush set --env production --url https://your-log-service.com
```

### Next.js Monitoring

```bash
# For Vercel deployment
vercel logs --since "1 hour ago"

# For PM2 deployment
pm2 logs
pm2 monit

# For Docker deployment
docker logs cms-nextjs
```

### Monitoring Tools Setup

**Cloudflare Analytics:**

```javascript
// Add to your worker
async function logRequest(env, request, response) {
  const logData = {
    timestamp: new Date().toISOString(),
    path: request.url,
    method: request.method,
    status: response.status,
    responseTime: performance.now(),
    cacheHit: response.headers.get('X-Cache-Hit') || 'miss'
  };
  
  await env.ANALYTICS.writeData(logData);
}
```

**Third-party Monitoring:**

```bash
# Datadog setup
npm install dd-trace

# New Relic setup  
npm install newrelic

# Sentry setup
npm install @sentry/nextjs
```

### Alerting Configuration

```yaml
# Example Cloudflare alert configuration
alerts:
  - name: "High Error Rate"
    condition: "error_rate > 5%"
    threshold: 5
    period: "5 minutes"
    notifications:
      - email: dev-team@yourdomain.com
      - slack: "#alerts-channel"
  
  - name: "Slow Response Times"
    condition: "response_time > 1000"
    threshold: 1000
    period: "1 minute"
    notifications:
      - pagerduty: "your-pagerduty-key"
```

## Post-deployment Verification

### Verification Checklist

- [ ] All services are running
- [ ] Health checks pass
- [ ] API endpoints respond correctly
- [ ] Content is displayed properly
- [ ] Caching is working
- [ ] Error rates are low
- [ ] Response times are acceptable
- [ ] Monitoring is collecting data
- [ ] Alerts are configured
- [ ] Backup systems are working

### Verification Commands

```bash
# Check Cloudflare Worker health
curl -I https://cms-api.yourdomain.com/health

# Check Next.js health
curl -I https://yourdomain.com/api/health

# Test CMS API endpoint
curl https://cms-api.yourdomain.com/api/cms/austin-tx/plumbing

# Test Next.js page
curl https://yourdomain.com/en

# Check cache headers
curl -I https://yourdomain.com/en
```

### Performance Testing

```bash
# Load test production
k6 cloud --vus 50 --duration 60s production-test.js

# Check response times
ab -n 1000 -c 100 https://yourdomain.com/

# Monitor during load test
wrangler tail --env production
```

## Maintenance Procedures

### Regular Maintenance Tasks

```bash
# Weekly tasks
wrangler d1 backup create cms-analytics-production --env production
wrangler r2 sync cms-artifacts-production backup-bucket --env production

# Monthly tasks
wrangler secret rotate HF_TOKEN --env production
wrangler secret rotate ADMIN_SECRET --env production

# Quarterly tasks
wrangler d1 optimize cms-analytics-production --env production
wrangler r2 cleanup cms-artifacts-production --older-than 90d --env production
```

### Update Procedures

```bash
# Minor updates (patch releases)
git checkout main
git pull origin main
pnpm install
pnpm run build
wrangler deploy --env production
vercel deploy --prod

# Major updates (feature releases)
# 1. Create release branch
git checkout -b release/v2.0.0

# 2. Update version numbers
# 3. Run full test suite
# 4. Deploy to staging first
wrangler deploy --env staging
vercel deploy --preview

# 5. Test thoroughly
# 6. Deploy to production
wrangler deploy --env production
vercel deploy --prod

# 7. Monitor closely for 24 hours
```

### Rollback Procedures

```bash
# Cloudflare Worker rollback
wrangler rollback --version v1.2.3 --env production

# Next.js rollback (Vercel)
vercel rollback deployment-id --to deployment-id

# Manual rollback
# 1. Stop current services
pm2 stop cms-nextjs

# 2. Restore from backup
docker run --rm \
  -v /var/www/cms-backup:/backup \
  -v /var/www/cms:/restore \
  alpine tar xzf /backup/cms-backup.tar.gz -C /restore

# 3. Start previous version
pm2 start cms-nextjs-v1.2.3
```

## Security Best Practices

### Production Security Checklist

- [ ] Use HTTPS for all communications
- [ ] Implement proper CORS headers
- [ ] Set secure cookies with HttpOnly and Secure flags
- [ ] Implement rate limiting
- [ ] Use CSRF protection
- [ ] Sanitize all user inputs
- [ ] Implement proper authentication
- [ ] Use content security policies
- [ ] Keep dependencies updated
- [ ] Regular security audits
- [ ] Monitor for vulnerabilities
- [ ] Implement DDoS protection

### Security Configuration

```nginx
# Security headers for Nginx
add_header X-Frame-Options "SAMEORIGIN";
add_header X-Content-Type-Options "nosniff";
add_header X-XSS-Protection "1; mode=block";
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' cdn.yourdomain.com;";
add_header Referrer-Policy "strict-origin-when-cross-origin";
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";
```

## Cost Optimization

### Cost Monitoring

```bash
# Monitor Cloudflare costs
wrangler billing usage --env production

# Set budget alerts
wrangler billing alert create --threshold 100 --currency USD --env production

# Monitor resource usage
wrangler analytics --env production
```

### Cost Optimization Strategies

1. **Cache aggressively** to reduce compute costs
2. **Compress all responses** to reduce bandwidth
3. **Set appropriate TTLs** to balance cache hit rate and freshness
4. **Monitor cold starts** and optimize worker initialization
5. **Use efficient data structures** to reduce memory usage
6. **Batch operations** where possible
7. **Monitor storage growth** and clean up unused data
8. **Use appropriate cache tiers** (KV for hot, R2 for warm)
9. **Optimize database queries** to reduce D1 costs
10. **Monitor and adjust** based on actual usage patterns

## Documentation and Knowledge Sharing

### Post-deployment Documentation

1. **Update runbooks** with new procedures
2. **Document new features** and changes
3. **Update architecture diagrams**
4. **Document troubleshooting** procedures
5. **Update monitoring** dashboards
6. **Document rollback** procedures
7. **Update on-call** documentation
8. **Conduct knowledge sharing** sessions
9. **Update API documentation**
10. **Document lessons learned**

### Team Communication

```markdown
# Production Deployment Notification

**Date:** 2024-12-29
**Version:** v2.0.0
**Environment:** Production
**Deployed by:** Your Name

## Changes
- Cloudflare CMS migration
- New caching strategy
- Improved error handling
- Performance optimizations

## Risks
- Potential cache invalidation issues
- Increased memory usage during transition
- Possible latency spikes during cutover

## Monitoring
- Watch error rates closely
- Monitor response times
- Check cache hit ratios
- Verify data consistency

## Rollback Plan
- Revert to v1.9.5 if error rate > 5%
- Use backup data if data corruption detected
- Monitor for 24 hours post-deployment
```

## Conclusion

This guide provides comprehensive instructions for deploying the Cloudflare CMS migration to production. Follow these steps carefully, monitor closely after deployment, and be prepared to rollback if any issues arise. Regular maintenance and monitoring will ensure the system continues to perform optimally.