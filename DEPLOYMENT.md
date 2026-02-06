# Vercel Deployment Guide - Clock-Bill

## Prerequisites

1. **Neon PostgreSQL Database** (Production)
   - Create account at https://neon.tech
   - Create a new project/database
   - Copy the connection string

2. **Vercel Account**
   - Create account at https://vercel.com
   - Install Vercel CLI: `npm i -g vercel`

3. **Vercel Blob Storage** (for logo uploads)
   - Enable in Vercel project settings
   - Generate read-write token

## Environment Variables

### Required for Production

```bash
# Database (Neon PostgreSQL)
DATABASE_URL=postgresql://user:password@ep-cool-name.us-east-2.aws.neon.tech/neondb?sslmode=require

# Authentication
BETTER_AUTH_SECRET=generate-a-random-32-character-secret
BETTER_AUTH_URL=https://your-app.vercel.app

# App URL
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app

# File Storage (Vercel Blob)
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxxxxxxxxxx
```

### Optional (for future features)

```bash
# Email (Resend)
RESEND_API_KEY=re_xxxxxxxxxxxxx

# OAuth Providers
GITHUB_CLIENT_ID=github_client_id
GITHUB_CLIENT_SECRET=github_client_secret
GOOGLE_CLIENT_ID=google_client_id
GOOGLE_CLIENT_SECRET=google_client_secret

# Cloudflare R2 (alternative to Vercel Blob)
R2_BUCKET_NAME=clock-bill-logos
R2_ACCOUNT_ID=account_id
R2_ACCESS_KEY_ID=access_key
R2_SECRET_ACCESS_KEY=secret_key
R2_PUBLIC_URL=https://pub-xxxxxxxxxxxxxxxx.r2.dev
```

## Deployment Steps

### 1. Prepare Environment Variables

Generate a secure auth secret:

```bash
openssl rand -base64 32
```

### 2. Deploy via Vercel CLI

```bash
# Login to Vercel
vercel login

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

### 3. Deploy via Git (Recommended)

1. Push code to GitHub/GitLab/Bitbucket
2. Import project in Vercel dashboard
3. Configure environment variables in Vercel dashboard
4. Deploy automatically on push to main branch

### 4. Configure Environment Variables in Vercel Dashboard

1. Go to project Settings > Environment Variables
2. Add each variable with appropriate value:
   - `DATABASE_URL` - Your Neon connection string
   - `BETTER_AUTH_SECRET` - Generated secret key
   - `BETTER_AUTH_URL` - Your Vercel deployment URL
   - `NEXT_PUBLIC_APP_URL` - Same as above
   - `BLOB_READ_WRITE_TOKEN` - From Vercel Blob storage

### 5. Set Up Database Migrations

The app uses Drizzle ORM with automatic schema initialization. On first deployment:

1. The `lib/db.ts` file calls `initSchema()` on startup
2. This automatically creates all required tables
3. No manual migration needed for initial deployment

For future schema changes:

```bash
# Generate migration locally
npm run db:generate

# Apply migration in production
# (This will be handled by the app's initSchema function)
```

### 6. Enable Vercel Blob Storage

1. In Vercel dashboard, go to Storage
2. Create a new Blob store
3. Copy the read-write token
4. Add to environment variables as `BLOB_READ_WRITE_TOKEN`

## Post-Deployment Checklist

- [ ] App loads at deployment URL
- [ ] Can register new account
- [ ] Can login with existing account
- [ ] Database persists data (create client, refresh, verify it exists)
- [ ] Can upload logo (Vercel Blob working)
- [ ] Can generate PDF reports
- [ ] All pages accessible and working
- [ ] No console errors
- [ ] RTL layout working correctly

## Production Build Verification

```bash
# Test production build locally
npm run build
npm run start

# Open http://localhost:3000
# Verify all functionality works
```

## Troubleshooting

### Build Fails

1. Check build logs in Vercel dashboard
2. Verify all dependencies installed
3. Check TypeScript errors: `npm run lint`

### Database Connection Issues

1. Verify `DATABASE_URL` is correct
2. Check Neon database is active
3. Ensure SSL mode enabled in connection string

### Auth Issues

1. Verify `BETTER_AUTH_SECRET` is set
2. Check `BETTER_AUTH_URL` matches deployment URL
3. Clear cookies and retry

### File Upload Issues

1. Verify `BLOB_READ_WRITE_TOKEN` is set
2. Check Vercel Blob storage is enabled
3. Check browser console for errors

## Monitoring

Vercel provides built-in monitoring:

- **Analytics**: Page views, visitors
- **Logs**: Real-time logs from deployments
- **Error Tracking**: Automatic error tracking
- **Performance**: Response times, Web Vitals

## Scaling

Vercel automatically scales:

- **Hobby Plan**: Free, good for development
- **Pro Plan**: $20/month, production-ready
  - Unlimited bandwidth
  - Faster builds
  - Team collaboration
- **Enterprise**: Custom, for large teams

## Backup Strategy

- **Database**: Neon provides automatic backups
- **Export**: Users can export JSON backup from settings
- **Version Control**: All code in Git

## Security Best Practices

1. Never commit `.env` files
2. Rotate secrets regularly
3. Use HTTPS only (automatic on Vercel)
4. Enable Vercel's security headers
5. Monitor logs for suspicious activity
6. Keep dependencies updated

## Continuous Deployment

With Git integration, deployments are automatic:

1. Push to `main` branch → Production deployment
2. Push to other branches → Preview deployments
3. Pull requests create preview URLs

## Cost Estimation

**Vercel (Hobby):** $0/month
- 100GB bandwidth
- 6,000 minutes of execution time
- Unlimited deployments

**Neon (Free Tier):** $0/month
- 0.5GB storage
- 300 hours of compute time
- 3 projects

**Vercel Blob:** $0.15/GB stored + $0.15/GB transferred

**Estimated Monthly Cost:** $0-5 for small usage

## Additional Resources

- [Next.js Deployment Docs](https://nextjs.org/docs/deployment)
- [Vercel Docs](https://vercel.com/docs)
- [Neon Docs](https://neon.tech/docs)
- [Drizzle Deployment](https://orm.drizzle.team/docs/deploy)
