#!/bin/bash

# Development Database Setup for Dock Optimizer
# This script sets up a local PostgreSQL database using Docker

echo "🚀 Setting up local PostgreSQL database for Dock Optimizer..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Database configuration
DB_NAME="dockoptimizer"
DB_USER="dockuser"
DB_PASS="dockpass"
DB_PORT="5432"
CONTAINER_NAME="dock-optimizer-db"

# Stop and remove existing container if it exists
echo "🧹 Cleaning up existing database container..."
docker stop $CONTAINER_NAME 2>/dev/null || true
docker rm $CONTAINER_NAME 2>/dev/null || true

# Start new PostgreSQL container
echo "🐘 Starting PostgreSQL container..."
docker run --name $CONTAINER_NAME \
  -e POSTGRES_DB=$DB_NAME \
  -e POSTGRES_USER=$DB_USER \
  -e POSTGRES_PASSWORD=$DB_PASS \
  -p $DB_PORT:5432 \
  -d postgres:15

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 10

# Test connection
echo "🔌 Testing database connection..."
if docker exec $CONTAINER_NAME pg_isready -U $DB_USER -d $DB_NAME > /dev/null 2>&1; then
    echo "✅ Database is ready!"
else
    echo "❌ Database connection failed. Check Docker logs:"
    docker logs $CONTAINER_NAME
    exit 1
fi

# Update .env file
echo "📝 Updating .env file..."
DATABASE_URL="postgresql://$DB_USER:$DB_PASS@localhost:$DB_PORT/$DB_NAME"

# Create or update .env file
cat > .env << EOF
# Database Configuration (Local Development)
DATABASE_URL=$DATABASE_URL

# Email Configuration (Development - replace for production)
SENDGRID_API_KEY=your-sendgrid-api-key
SENDGRID_FROM_EMAIL=noreply@localhost

# Application URL (Development)
HOST_URL=http://localhost:3000

# Environment
NODE_ENV=development
EOF

echo "✅ .env file updated with local database configuration"

# Run database migrations
echo "🗄️  Running database migrations..."
if npm run db:migrate 2>/dev/null || npx drizzle-kit migrate 2>/dev/null; then
    echo "✅ Database migrations completed!"
else
    echo "⚠️  Migration command not found. You may need to run migrations manually:"
    echo "   npx drizzle-kit migrate"
fi

echo ""
echo "🎉 Development database setup complete!"
echo ""
echo "Database Details:"
echo "  Host: localhost"
echo "  Port: $DB_PORT"
echo "  Database: $DB_NAME"
echo "  Username: $DB_USER"
echo "  Password: $DB_PASS"
echo ""
echo "Connection String:"
echo "  $DATABASE_URL"
echo ""
echo "To connect manually:"
echo "  docker exec -it $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME"
echo ""
echo "To stop the database:"
echo "  docker stop $CONTAINER_NAME"
echo ""
echo "To start the database again:"
echo "  docker start $CONTAINER_NAME"
echo ""
echo "Now run: npm run dev" 