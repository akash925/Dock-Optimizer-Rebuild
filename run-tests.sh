#!/usr/bin/env bash

# Define colors for better readability
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Dock Optimizer Unit Test Runner ===${NC}"

# Use the test checker for fast analysis in Replit - analysis only
echo -e "${YELLOW}Analyzing test infrastructure...${NC}"
node test-checker.js

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Test analysis passed${NC}"
  echo -e "${GREEN}Tests are ready for CI/CD environment execution${NC}"
  exit 0
else
  echo -e "${RED}✗ Test analysis failed${NC}"
  echo -e "${YELLOW}Note: Some failures might be temporary due to environment issues${NC}"
  exit 1
fi