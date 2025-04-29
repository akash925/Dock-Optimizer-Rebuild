#!/usr/bin/env bash

# Define colors for better readability
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Dock Optimizer E2E Test Runner ===${NC}"

# Run Cypress tests
echo -e "${YELLOW}Running Cypress E2E tests...${NC}"
npx cypress run

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ All E2E tests passed${NC}"
  exit 0
else
  echo -e "${RED}✗ E2E tests failed${NC}"
  exit 1
fi