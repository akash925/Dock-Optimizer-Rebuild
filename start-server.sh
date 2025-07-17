#!/bin/bash

# Start the Dock Optimizer server
export DATABASE_URL="postgres://localhost:5432/test"
export SENDGRID_API_KEY="SG.dummy_key"
export SESSION_SECRET="test-secret"
export JWT_SECRET="test-jwt-secret"
export JWT_PRIVATE_KEY="test-jwt-private-key"
export NODE_ENV="development"
export CHOKIDAR_USEPOLLING=1

echo "Starting Dock Optimizer server..."
echo "Environment: development"
echo "Port: 5001"

# Start the server
node_modules/.bin/tsx server/index.ts