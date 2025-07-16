#!/bin/bash

# Simple wrapper to run commands with Doppler
# Usage: ./run-with-doppler.sh <config> <command>

set -e

DOPPLER_VERSION="3.75.1"
DOPPLER_URL="https://github.com/DopplerHQ/cli/releases/download/${DOPPLER_VERSION}/doppler_${DOPPLER_VERSION}_linux_amd64.tar.gz"
DOPPLER_LOCAL_PATH="./doppler"

# Download Doppler if not available
if [ ! -f "$DOPPLER_LOCAL_PATH" ]; then
    echo "Downloading Doppler CLI..."
    curl -L -o doppler.tar.gz "$DOPPLER_URL"
    tar -xzf doppler.tar.gz
    chmod +x doppler
    rm doppler.tar.gz
fi

# Run the command with Doppler
CONFIG=$1
shift
./doppler run --config $CONFIG -- "$@"