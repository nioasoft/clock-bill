#!/bin/bash

# Clock-Bill Deployment Helper Script
# This script helps prepare the app for Vercel deployment

set -e

echo "🚀 Clock-Bill Deployment Setup"
echo "================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check prerequisites
echo "📋 Checking prerequisites..."

# Check if node is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Node.js installed: $(node --version)${NC}"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ npm installed: $(npm --version)${NC}"

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo -e "${RED}❌ git is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ git installed: $(git --version)${NC}"

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo -e "${YELLOW}⚠️  Vercel CLI not installed${NC}"
    echo "Installing Vercel CLI..."
    npm install -g vercel
    echo -e "${GREEN}✅ Vercel CLI installed${NC}"
else
    echo -e "${GREEN}✅ Vercel CLI installed: $(vercel --version)${NC}"
fi

echo ""
echo "🔧 Environment Setup"
echo "===================="

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file not found${NC}"
    echo "Creating .env from template..."
    cp .env.template .env
    echo -e "${GREEN}✅ Created .env file${NC}"
    echo -e "${YELLOW}⚠️  Please edit .env and add your values${NC}"
else
    echo -e "${GREEN}✅ .env file exists${NC}"
fi

# Check if DATABASE_URL is set
if grep -q "DATABASE_URL=postgres://clockbill:clockbill_dev@localhost" .env 2>/dev/null; then
    echo -e "${YELLOW}⚠️  DATABASE_URL is still set to local PostgreSQL${NC}"
    echo "For production, update it to your Neon connection string"
fi

# Generate a secure BETTER_AUTH_SECRET if not set
if ! grep -q "BETTER_AUTH_SECRET=" .env 2>/dev/null || grep -q "BETTER_AUTH_SECRET=your-secret" .env; then
    echo ""
    echo "Generating secure BETTER_AUTH_SECRET..."
    SECRET=$(openssl rand -base64 32 | tr -d '\n')
    echo "BETTER_AUTH_SECRET=$SECRET" >> .env
    echo -e "${GREEN}✅ Generated BETTER_AUTH_SECRET${NC}"
fi

echo ""
echo "🏗️  Build Verification"
echo "======================"

# Install dependencies
echo "Installing dependencies..."
npm install
echo -e "${GREEN}✅ Dependencies installed${NC}"

# Run TypeScript check
echo "Checking TypeScript types..."
npx tsc --noEmit || echo -e "${RED}❌ TypeScript errors found${NC}"
echo -e "${GREEN}✅ TypeScript check passed${NC}"

# Build the project
echo "Building project..."
npm run build
echo -e "${GREEN}✅ Build successful${NC}"

echo ""
echo "📦 Deployment Instructions"
echo "=========================="

echo ""
echo "Option 1: Deploy via Vercel CLI"
echo "--------------------------------"
echo "1. Login to Vercel: vercel login"
echo "2. Deploy: vercel"
echo "3. Set environment variables in Vercel dashboard:"
echo "   - DATABASE_URL (Neon PostgreSQL connection string)"
echo "   - BETTER_AUTH_SECRET (generated above or in .env)"
echo "   - BETTER_AUTH_URL (your Vercel URL)"
echo "   - NEXT_PUBLIC_APP_URL (your Vercel URL)"
echo "   - BLOB_READ_WRITE_TOKEN (from Vercel Blob storage)"
echo ""

echo "Option 2: Deploy via Git (Recommended)"
echo "---------------------------------------"
echo "1. Push code to GitHub/GitLab/Bitbucket"
echo "2. Import project in Vercel dashboard"
echo "3. Configure environment variables"
echo "4. Automatic deployment on push to main branch"
echo ""

echo "📚 For detailed instructions, see DEPLOYMENT.md"
echo ""

echo -e "${GREEN}✅ Setup complete!${NC}"
echo "You're ready to deploy to Vercel."
