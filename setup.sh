#!/bin/bash
set -e

echo "🚀 Setting up ClockBill project..."

# Start PostgreSQL
echo "📦 Starting PostgreSQL in Docker..."
docker compose up -d

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 5

# Copy env file if not exists
if [ ! -f .env ]; then
  echo "📝 Creating .env file..."
  cp .env.template .env
  # Generate a random secret
  SECRET=$(openssl rand -base64 32)
  sed -i.bak "s/your-secret-key-at-least-32-characters-long/$SECRET/" .env
  rm .env.bak
fi

# Initialize Next.js with shadcn/ui
echo "⚛️ Initializing Next.js with shadcn/ui..."
echo "my-app" | npx shadcn@latest init --yes --template next --base-color stone

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. cd my-app"
echo "2. npm install better-auth drizzle-orm postgres @react-pdf/renderer exceljs resend"
echo "3. npm install -D drizzle-kit"
echo "4. Copy .env to my-app/"
echo "5. npm run dev"
