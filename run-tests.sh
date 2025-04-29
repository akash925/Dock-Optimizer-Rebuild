#!/bin/bash
echo "Running server unit tests..."
NODE_OPTIONS="--experimental-vm-modules" npx jest --config jest.config.js --runInBand server/tests/