#!/bin/bash

# Colors for output formatting
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}===================================================${NC}"
echo -e "${BLUE}Running E2E Tests for Dock Optimizer Platform${NC}"
echo -e "${BLUE}===================================================${NC}"

# Run Cypress E2E tests
echo -e "\n${BLUE}Starting Cypress tests...${NC}"
npx cypress run
E2E_TEST_RESULT=$?

# Display E2E test results
if [ $E2E_TEST_RESULT -eq 0 ]; then
  echo -e "\n${GREEN}✓ E2E tests passed${NC}"
else
  echo -e "\n${RED}✗ E2E tests failed${NC}"
fi

echo -e "\n${BLUE}===================================================${NC}"
if [ $E2E_TEST_RESULT -eq 0 ]; then
  echo -e "${GREEN}All E2E tests completed successfully!${NC}"
else
  echo -e "${RED}Some E2E tests failed. Please check the output above.${NC}"
fi
echo -e "${BLUE}===================================================${NC}"

exit $E2E_TEST_RESULT