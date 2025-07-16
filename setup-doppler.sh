#!/bin/bash

# Doppler setup script for Replit
# This script sets up Doppler CLI and handles authentication

set -e

DOPPLER_VERSION="3.75.1"
DOPPLER_URL="https://github.com/DopplerHQ/cli/releases/download/${DOPPLER_VERSION}/doppler_${DOPPLER_VERSION}_linux_amd64.tar.gz"
DOPPLER_LOCAL_PATH="./doppler"

# Download Doppler if not available
if [ ! -f "$DOPPLER_LOCAL_PATH" ]; then
    echo "🔐 Downloading Doppler CLI v${DOPPLER_VERSION}..."
    curl -L -o doppler.tar.gz "$DOPPLER_URL"
    tar -xzf doppler.tar.gz
    chmod +x doppler
    rm doppler.tar.gz
    echo "✅ Doppler CLI installed successfully"
fi

# Check if Doppler is configured
if [ ! -f ".doppler.yaml" ]; then
    echo "❌ Doppler configuration not found (.doppler.yaml)"
    echo "Please run: ./doppler configure"
    exit 1
fi

# Check if Doppler is authenticated
if ! ./doppler auth --check &>/dev/null; then
    echo "❌ Doppler authentication required"
    echo "Please run: ./doppler auth login"
    echo "Then visit: https://dashboard.doppler.com/workplace/auth/cli"
    exit 1
fi

echo "✅ Doppler is configured and authenticated"
echo "📋 Available configs:"
./doppler configs

# Test connection to each config
for config in dev stg prd; do
    echo "🔍 Testing connection to config: $config"
    if ./doppler secrets --config $config --silent &>/dev/null; then
        echo "✅ Config $config - Connected"
    else
        echo "❌ Config $config - Failed to connect"
    fi
done

echo "🚀 Doppler setup complete!"