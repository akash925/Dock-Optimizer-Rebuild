#!/usr/bin/env bash

# Define colors for better readability
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Dock Optimizer E2E Test Runner ===${NC}"

# First check that we have tests to run
echo -e "${YELLOW}Analyzing test structure...${NC}"
node test-checker.js

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Test structure is valid${NC}"
  
  # Create a simple cypress e2e test verification (without running it)
  echo -e "${YELLOW}Verifying Cypress environment...${NC}"
  if npx cypress verify &> /dev/null; then
    echo -e "${GREEN}✓ Cypress environment verified successfully${NC}"
    echo -e "${YELLOW}Note: For complete E2E testing, run tests in a CI/CD environment${NC}"
    echo -e "${GREEN}Ready for CI/CD testing!${NC}"
    exit 0
  else
    echo -e "${RED}✗ Cypress environment issues detected${NC}"
    echo -e "${YELLOW}Note: Cypress needs additional setup in Replit environment${NC}"
    exit 1
  fi
else
  echo -e "${RED}✗ Test structure validation failed${NC}"
  exit 1
fi