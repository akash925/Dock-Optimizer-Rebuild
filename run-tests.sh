#!/bin/bash

# Colors for output formatting
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}===================================================${NC}"
echo -e "${BLUE}Running Tests for Dock Optimizer Platform${NC}"
echo -e "${BLUE}===================================================${NC}"

# Run Jest unit tests
echo -e "\n${BLUE}Running unit tests...${NC}"
npx jest --runInBand
UNIT_TEST_RESULT=$?

# Display unit test results
if [ $UNIT_TEST_RESULT -eq 0 ]; then
  echo -e "\n${GREEN}✓ Unit tests passed${NC}"
else
  echo -e "\n${RED}✗ Unit tests failed${NC}"
fi

# Run E2E tests if explicitly requested with --e2e flag
if [[ "$*" == *"--e2e"* ]]; then
  echo -e "\n${BLUE}Running E2E tests...${NC}"
  npx cypress run
  E2E_TEST_RESULT=$?
  
  # Display E2E test results
  if [ $E2E_TEST_RESULT -eq 0 ]; then
    echo -e "\n${GREEN}✓ E2E tests passed${NC}"
  else
    echo -e "\n${RED}✗ E2E tests failed${NC}"
  fi
  
  # Set overall test result based on both unit and E2E tests
  TEST_RESULT=$((UNIT_TEST_RESULT || E2E_TEST_RESULT))
else
  # Set overall test result based only on unit tests
  TEST_RESULT=$UNIT_TEST_RESULT
fi

echo -e "\n${BLUE}===================================================${NC}"
if [ $TEST_RESULT -eq 0 ]; then
  echo -e "${GREEN}All requested tests passed successfully!${NC}"
else
  echo -e "${RED}Some tests failed. Please check the output above.${NC}"
fi
echo -e "${BLUE}===================================================${NC}"

exit $TEST_RESULT