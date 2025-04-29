#!/bin/bash
echo "Running unit tests..."
NODE_OPTIONS="--experimental-vm-modules" npx jest --config jest.config.js --runInBand