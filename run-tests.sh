#!/usr/bin/env bash

# Define colors for better readability
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Dock Optimizer Unit Test Runner ===${NC}"

# Use the test checker for fast analysis in Replit
echo -e "${YELLOW}Analyzing test infrastructure...${NC}"
node test-checker.js

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Test analysis passed${NC}"
  
  # Optionally run the smoke test if we want to execute something
  echo -e "${YELLOW}Running quick smoke test...${NC}"
  NODE_ENV=test npx jest server/tests/smoke.test.ts --passWithNoTests
  
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Smoke test passed${NC}"
    exit 0
  else
    echo -e "${RED}✗ Smoke test failed${NC}"
    exit 1
  fi
else
  echo -e "${RED}✗ Test analysis failed${NC}"
  echo -e "${YELLOW}Note: Some failures might be temporary due to environment issues${NC}"
  exit 1
fi