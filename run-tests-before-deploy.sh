#!/usr/bin/env bash

# Define colors for better readability
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Dock Optimizer Pre-Deploy Test Runner ===${NC}"

# Run only the smoke test which should be fast and reliable
echo -e "${YELLOW}Running smoke tests...${NC}"
NODE_ENV=test npx jest server/tests/smoke.test.ts --passWithNoTests

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Smoke tests passed${NC}"
else
  echo -e "${RED}✗ Smoke tests failed${NC}"
  exit 1
fi

echo -e "${YELLOW}Note: Running a simplified test set for Replit environment${NC}"
echo -e "${YELLOW}For complete testing, run tests in a CI/CD environment${NC}"

echo -e "${GREEN}Pre-deployment checks completed.${NC}"
echo -e "${GREEN}Ready to deploy!${NC}"