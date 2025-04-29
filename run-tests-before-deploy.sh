#!/usr/bin/env bash

# Define colors for better readability
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Dock Optimizer Pre-Deploy Test Runner ===${NC}"

echo -e "${YELLOW}Running Jest unit tests...${NC}"
NODE_ENV=test npx jest --testPathIgnorePatterns=cypress --passWithNoTests

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Unit tests passed${NC}"
else
  echo -e "${RED}✗ Unit tests failed${NC}"
  exit 1
fi

echo -e "${YELLOW}Running Cypress E2E tests...${NC}"
if npx cypress run --headless; then
  echo -e "${GREEN}✓ E2E tests passed${NC}"
else
  echo -e "${RED}✗ E2E tests failed${NC}"
  echo -e "${YELLOW}Note: E2E test failures don't block deployment, but should be reviewed${NC}"
fi

echo -e "${GREEN}All tests completed.${NC}"
echo -e "${GREEN}Ready to deploy!${NC}"