# Deployment Features Documentation

This document describes the production deployment features implemented for the Clock-Bill application.

## Features #129 & #130: Production Database & Blob Storage

### Feature #129: Production Database (Neon)

**Status:** ✅ Implemented and Ready

The application is configured to work with Neon PostgreSQL in production.

#### Database Connection

The database connection is handled by `lib/db.ts`:

```typescript
import { Pool } from "pg";
import { getDatabaseUrl } from "./env";

const pool = new Pool({
  connectionString: getDatabaseUrl(),
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});
```

#### Environment Configuration

**Required Environment Variables:**

- `DATABASE_URL`: PostgreSQL connection string
  - **Development:** `postgresql://clockbill:clockbill_dev@localhost:5432/clockbill`
  - **Production:** `postgresql://user:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require`

#### Schema Initialization

The database schema is automatically initialized on startup via `initSchema()`:

- Creates all required tables
- Adds indexes for performance
- Handles migrations with `ALTER TABLE IF NOT EXISTS`
- Works with both local PostgreSQL and Neon

#### Testing Database Connection

To verify the database connection:

1. **Development:** Ensure Docker PostgreSQL container is running:
   ```bash
   docker start clockbill-db
   ```

2. **Production:** Set `DATABASE_URL` to your Neon connection string

3. **Verify:** Check the server logs for successful connection messages

---

### Feature #130: Vercel Blob Storage

**Status:** ✅ Implemented with Fallback

The application now supports Vercel Blob storage for file uploads (logos, signatures) in production.

#### Storage Abstraction Layer

A new `lib/storage.ts` module provides a storage abstraction:

```typescript
export interface StorageAdapter {
  upload(file: File, userId: string, prefix: string): Promise<string>;
  delete(url: string): Promise<void>;
  getUrl(filename: string, prefix: string): string;
}
```

Two storage adapters are implemented:

1. **LocalStorageAdapter** (Development)
   - Stores files in `public/uploads/`
   - Works without any external services
   - Used by default in development

2. **BlobStorageAdapter** (Production)
   - Stores files in Vercel Blob storage
   - Returns public URLs for uploaded files
   - Used in production when `BLOB_READ_WRITE_TOKEN` is set

#### Environment Configuration

**Required for Production:**

- `BLOB_READ_WRITE_TOKEN`: Vercel Blob read-write token
  - Format: `vercel_blob_rw_xxxxxxxxxxxxx`
  - Get this from Vercel Dashboard > Storage > Blob

**Optional in Development:**
- If not set, falls back to local filesystem storage
- No impact on development workflow

#### Setting Up Vercel Blob

1. **Enable Blob Storage:**
   - Go to Vercel project dashboard
   - Navigate to Storage tab
   - Create a new Blob store

2. **Get the Token:**
   - In Blob store settings, copy the "Read-Write Token"
   - Add to environment variables as `BLOB_READ_WRITE_TOKEN`

3. **Install @vercel/blob:**
   ```bash
   npm install @vercel/blob
   ```
   - Marked as `optionalDependency` in package.json
   - If installation fails in development, code falls back to local storage

#### File Upload Endpoints

The following endpoints use the storage abstraction:

1. **Logo Upload:** `POST /api/profile/logo`
2. **Logo Delete:** `DELETE /api/profile/logo`
3. **Signature Upload:** `POST /api/profile/signature`
4. **Signature Delete:** `DELETE /api/profile/signature`

All endpoints automatically use the appropriate storage adapter based on:
- Environment (development vs production)
- Availability of `BLOB_READ_WRITE_TOKEN`
- Installation of `@vercel/blob` package

#### Testing File Uploads

**Development:**
- Files are saved to `public/uploads/logos/` and `public/uploads/signatures/`
- No additional setup required

**Production:**
- Set `BLOB_READ_WRITE_TOKEN` environment variable
- Install `@vercel/blob` package
- Files are uploaded to Vercel Blob and return CDN URLs

---

## Verification Steps

### 1. Environment Variables

Check `.env.production.template` for required variables:

```bash
# Database
DATABASE_URL=postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require

# Auth
BETTER_AUTH_SECRET=your-secret-key
BETTER_AUTH_URL=https://your-app.vercel.app

# Storage
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxxxxxxxxxx
```

### 2. Database Connection

Verify the database connection works:

```bash
# In development
npm run dev
# Check logs for: "Environment variables validated successfully"

# Test database connection
psql $DATABASE_URL -c "SELECT NOW();"
```

### 3. Storage Configuration

Verify storage configuration:

```typescript
// In Node.js REPL
import { getStorageAdapter } from "./lib/storage.js";
import { isProduction } from "./lib/env.js";

const storage = getStorageAdapter();
console.log("Storage:", storage.constructor.name);
console.log("Is Production:", isProduction());
console.log("Blob Token Set:", !!process.env.BLOB_READ_WRITE_TOKEN);
```

### 4. File Upload Test

Test file upload functionality:

1. Start the dev server
2. Login to the application
3. Go to Settings > Profile
4. Upload a logo
5. Verify it appears in:
   - Development: `public/uploads/logos/`
   - Production: Vercel Blob dashboard

---

## Deployment Checklist

### Pre-Deployment

- [ ] Set `DATABASE_URL` to Neon connection string
- [ ] Set `BETTER_AUTH_SECRET` to a secure 32+ character string
- [ ] Set `BETTER_AUTH_URL` to production URL
- [ ] Set `NEXT_PUBLIC_APP_URL` to production URL
- [ ] (Optional) Set `BLOB_READ_WRITE_TOKEN` for file uploads

### Post-Deployment

- [ ] Verify app loads at production URL
- [ ] Test user registration
- [ ] Test user login
- [ ] Test data persistence (create client, refresh, verify)
- [ ] Test logo upload (if Blob enabled)
- [ ] Test PDF report generation
- [ ] Check server logs for errors

---

## Troubleshooting

### Database Connection Issues

**Problem:** `connection refused` or `ECONNREFUSED`

**Solution:**
- Verify `DATABASE_URL` is correct
- Check Neon database is active
- Ensure SSL mode is enabled (`?sslmode=require`)

### File Upload Issues

**Problem:** Logo upload fails in production

**Solution:**
- Verify `BLOB_READ_WRITE_TOKEN` is set
- Check Vercel Blob storage is enabled
- Verify `@vercel/blob` is installed
- Check browser console for errors

### Storage Fallback

**Problem:** Files not uploaded to Blob

**Solution:**
- If `@vercel/blob` is not installed, files use local storage
- This is acceptable in development
- For production, install `@vercel/blob` or files will be lost on redeploy

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      Application                             │
├─────────────────────────────────────────────────────────────┤
│  File Upload APIs                                           │
│  ├── /api/profile/logo                                     │
│  └── /api/profile/signature                                │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
        ┌────────────────┐
        │  Storage Layer  │
        │  lib/storage.ts │
        └────────┬────────┘
                 │
        ┌────────┴────────┐
        │                 │
        ▼                 ▼
┌──────────────┐  ┌────────────────┐
│   Local      │  │  Vercel Blob   │
│  Filesystem  │  │   Storage      │
│              │  │                │
│ Development  │  │  Production    │
└──────────────┘  └────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    Database Layer                            │
├─────────────────────────────────────────────────────────────┤
│  lib/db.ts + pg (PostgreSQL)                                │
│                                                              │
│  Development: localhost:5432 (Docker)                       │
│  Production:  neon.tech (Neon PostgreSQL)                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Summary

### Feature #129: Production Database (Neon) ✅

- [x] Database connection configured with `pg` and connection pooling
- [x] Environment variable validation for `DATABASE_URL`
- [x] Automatic schema initialization with `initSchema()`
- [x] Works with both local PostgreSQL and Neon
- [x] Connection retry and error handling

### Feature #130: Blob Storage ✅

- [x] Storage abstraction layer created (`lib/storage.ts`)
- [x] Local filesystem adapter for development
- [x] Vercel Blob adapter for production
- [x] Logo upload API updated to use abstraction
- [x] Signature upload API updated to use abstraction
- [x] Environment variable validation for `BLOB_READ_WRITE_TOKEN`
- [x] Graceful fallback when `@vercel/blob` is not installed
- [x] Updated `.env.production.template` with Blob documentation
- [x] Added `@vercel/blob` as optional dependency

Both features are fully implemented and ready for production deployment.
