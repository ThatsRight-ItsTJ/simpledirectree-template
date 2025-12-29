# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a free directory/listing boilerplate built for indie hackers to create product directories. It features a dual CMS system, multi-language support, and integrated authentication.

## Development Commands

```bash
# Development
pnpm dev              # Start development server
pnpm turbo            # Start dev server with Turbo mode

# Building
pnpm build            # Build for production
pnpm start            # Start production server
pnpm preview          # Build and start production server

# Code Quality
pnpm lint             # Run ESLint

# Database (Prisma)
pnpm prismainstall    # Generate Prisma client and push schema to database
prisma generate       # Generate Prisma client only
prisma db push        # Push schema changes to database
prisma studio         # Open Prisma Studio GUI

# Email Development
pnpm email            # Start email preview server on port 3333
```

## Tech Stack & Architecture

### Core Technologies
- **Next.js 14** (App Router) - React framework
- **NextAuth v5** (beta) - Authentication (GitHub/Google OAuth)
- **PostgreSQL** - User accounts and authentication data
- **Sanity CMS** - Product listings and user-submitted content
- **Prisma** - Database ORM
- **Contentlayer** - MDX-based docs, blog, and guides
- **Tailwind CSS + shadcn/ui** - Styling and UI components

### Dual CMS Architecture

This project uses two separate content management systems:

1. **Sanity CMS** (`/sanity`):
   - Product/tool listings
   - User submissions
   - Categories and tags
   - Accessed via separate Sanity Studio (see README for backend repo)
   - Client configured in [sanity/lib/client.ts](sanity/lib/client.ts)
   - Queries in [sanity/lib/queries.ts](sanity/lib/queries.ts)

2. **Contentlayer** (`/content`):
   - Documentation (`/docs`)
   - Blog posts (`/blog`)
   - Guides (`/guides`)
   - Static pages
   - Configuration in [contentlayer.config.ts](contentlayer.config.ts)

### Internationalization (i18n)

The app uses a custom i18n implementation with locale-based routing:

- Supported locales: `en` (default), `zh`
- Configuration: [i18n-config.ts](i18n-config.ts)
- Locale dictionaries: [dictionaries/en.json](dictionaries/en.json), [dictionaries/zh.json](dictionaries/zh.json)
- All routes are prefixed with locale (e.g., `/en/dashboard`, `/zh/dashboard`)
- [middleware.ts](middleware.ts) handles locale detection and route protection
- Config files in `/config` often have locale-specific exports (e.g., `enSiteConfig`, `zhSiteConfig`)

### Authentication Flow

- NextAuth v5 with JWT strategy
- Providers: GitHub (Google commented out in [auth.config.ts](auth.config.ts))
- User data stored in PostgreSQL ([prisma/schema.prisma](prisma/schema.prisma))
- On signup, users are synced to both PostgreSQL and Sanity CMS ([auth.ts](auth.ts):70-94)
- Prisma adapter handles database sessions
- Protected routes defined in [routes.ts](routes.ts)

### Middleware & Routing

The [middleware.ts](middleware.ts) performs multiple tasks in order:

1. Serves static files from `/public`
2. Detects and redirects to appropriate locale if missing
3. Strips locale from pathname for route matching
4. Checks if route is restricted (docs/blog/saas sections)
5. Handles authentication redirects based on public/protected routes

Route configuration in [routes.ts](routes.ts):
- `publicRoutes`: Accessible without auth
- `restrictedRoutes`: Hidden sections (docs, blog, saas)
- `apiAuthPrefix`: NextAuth API routes

### Environment Variables

Environment variables are validated using [@t3-oss/env-nextjs](env.mjs):

Required variables:
- `NEXT_PUBLIC_APP_URL`: Application URL
- `NEXTAUTH_SECRET`: NextAuth secret key
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`: GitHub OAuth
- `DATABASE_URL`: PostgreSQL connection string
- `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET`, `NEXT_PUBLIC_SANITY_API_WRITE_TOKEN`: Sanity CMS config

See [.env.example](.env.example) for the full list.

## Directory Structure

```
/actions              # Server actions (form submissions, data mutations)
/app/[lang]           # Next.js App Router with locale parameter
  /(main)             # Public pages
    /(product)        # Product/group listings from Sanity
    /(indieapp)       # App/tool listings from Sanity
    /(docs)           # Docs/blog/guides from Contentlayer
  /dashboard          # Protected user dashboard
  /saas               # Restricted SaaS demo pages
/components           # React components
/config               # Configuration files (site, navbar, footer, etc.)
/content              # MDX files for Contentlayer (docs, blog, guides)
/dictionaries         # i18n translation JSON files
/hooks                # Custom React hooks
/lib                  # Utilities, database client, validations
/prisma               # Database schema
/sanity               # Sanity CMS client and queries
/styles               # Global CSS
/types                # TypeScript type definitions
```

## Key Architectural Patterns

### Configuration System

Configuration files in `/config` provide structured data for different sections:
- [config/site.ts](config/site.ts): Site metadata (separate config per locale)
- [config/navbar.ts](config/navbar.ts): Navigation menu items
- [config/dashboard.ts](config/dashboard.ts): Dashboard sidebar navigation
- [config/landing.ts](config/landing.ts): Landing page sections
- [config/submit-app.ts](config/submit-app.ts): Form configuration for submissions

### Server Actions

Server actions in `/actions` handle form submissions and data mutations:
- [actions/submit-application.ts](actions/submit-application.ts): Submit new products to Sanity
- [actions/update-application.ts](actions/update-application.ts): Update existing submissions
- [actions/delete-application.ts](actions/delete-application.ts): Delete submissions
- All actions use form validation with Zod schemas from [lib/validations](lib/validations)

### Database Patterns

- Prisma client singleton in [lib/db.ts](lib/db.ts) with dev caching
- User model includes Stripe fields for potential payment integration
- NextAuth adapter syncs to Prisma automatically
- On user signup, data is also synced to Sanity CMS for unified user profiles

### Content Management

**For Sanity content (products/listings):**
- Data fetched via [sanity/lib/fetch.ts](sanity/lib/fetch.ts) with query helpers
- Queries defined in [sanity/lib/queries.ts](sanity/lib/queries.ts)
- Write operations use [sanity/lib/client.ts](sanity/lib/client.ts)

**For Contentlayer content (docs/blog):**
- MDX files processed automatically on build
- Import from `contentlayer/generated` in components
- Rehype/remark plugins configured in [contentlayer.config.ts](contentlayer.config.ts)

### Component Organization

- UI components use shadcn/ui pattern (in `/components/ui`)
- Larger feature components organized by domain
- Client components suffixed with `-client.tsx` for clarity
- Form components integrate react-hook-form + Zod validation

## Important Notes

- The project uses `pnpm` as package manager (version 9.5.0)
- Node version specified in [.nvmrc](.nvmrc)
- Husky git hooks configured for commit linting
- Images are unoptimized in Next.js config to avoid Vercel optimization costs
- SVG images are allowed from Sanity CDN
- Some features are commented out (Google auth, Stripe, email notifications) but scaffolding exists
