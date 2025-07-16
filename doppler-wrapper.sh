#!/bin/bash

# Doppler CLI wrapper for Replit
# This script downloads and runs Doppler CLI if not available

DOPPLER_VERSION="3.75.1"
DOPPLER_URL="https://github.com/DopplerHQ/cli/releases/download/${DOPPLER_VERSION}/doppler_${DOPPLER_VERSION}_linux_amd64.tar.gz"
DOPPLER_LOCAL_PATH="./doppler"

# Check if doppler binary exists locally
if [ ! -f "$DOPPLER_LOCAL_PATH" ]; then
    echo "Downloading Doppler CLI..."
    curl -L -o doppler.tar.gz "$DOPPLER_URL"
    tar -xzf doppler.tar.gz
    chmod +x doppler
    rm doppler.tar.gz
fi

# Run doppler with passed arguments
./doppler "$@"