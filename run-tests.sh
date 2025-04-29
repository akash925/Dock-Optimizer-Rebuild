#!/usr/bin/env bash

# Define colors for better readability
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Dock Optimizer Unit Test Runner ===${NC}"

# Run Jest tests with focused server tests only, strict timeout
echo -e "${YELLOW}Running core server tests only...${NC}"
NODE_ENV=test npx jest server/tests/featureFlags.test.ts server/tests/organizationModules.test.ts --testTimeout=10000 --runInBand --no-cache --silent

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Server unit tests passed${NC}"
  exit 0
else
  echo -e "${RED}✗ Server unit tests failed${NC}"
  echo -e "${YELLOW}Note: Some failures might be temporary due to environment issues${NC}"
  exit 1
fi