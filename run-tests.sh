#!/bin/bash

# Define colors for better readability
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Display a nice header
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Running Jest Unit and Integration Tests${NC}"
echo -e "${BLUE}========================================${NC}"

# Check if database is available
echo -e "${YELLOW}Checking database connection...${NC}"
if ! psql "$DATABASE_URL" -c '\q' &>/dev/null; then
  echo -e "${RED}Error: Cannot connect to PostgreSQL database. Please ensure the database is running.${NC}"
  exit 1
fi

# Setup test environment variables
export NODE_ENV=test

# Run the tests with proper output formatting
echo -e "${GREEN}Starting tests...${NC}"

if [ $# -eq 0 ]; then
  # Run all tests if no specific arguments provided
  npx jest --verbose
else
  # Run tests with provided arguments
  npx jest "$@"
fi

TEST_EXIT_CODE=$?

# Report status
if [ $TEST_EXIT_CODE -eq 0 ]; then
  echo -e "${GREEN}All tests passed!${NC}"
else
  echo -e "${RED}Tests failed with exit code $TEST_EXIT_CODE!${NC}"
fi

# Reset test data if needed
echo -e "${YELLOW}Cleaning up test data...${NC}"
npx tsx server/tests/clean-test-db.ts || echo -e "${RED}Failed to clean test database${NC}"

# Exit with the appropriate code
exit $TEST_EXIT_CODE