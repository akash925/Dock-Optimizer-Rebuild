#!/bin/bash

# Define colors for better readability
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Display a nice header
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Running Cypress End-to-End Tests${NC}"
echo -e "${BLUE}========================================${NC}"

# Ensure the application is running
if ! curl -s http://localhost:5000 > /dev/null; then
  echo -e "${YELLOW}Warning: Application doesn't seem to be running. Starting it now...${NC}"
  npm run dev & 
  APP_PID=$!
  echo -e "${YELLOW}Waiting for the application to start...${NC}"
  sleep 10
  
  # Check if app started successfully
  if ! curl -s http://localhost:5000 > /dev/null; then
    echo -e "${RED}Error: Failed to start application. Please run 'npm run dev' manually and try again.${NC}"
    kill $APP_PID 2>/dev/null
    exit 1
  fi
  
  # Flag that we started the app ourselves
  STARTED_APP=true
fi

# Run the tests
echo -e "${GREEN}Starting E2E tests...${NC}"
npx cypress run "$@"
TEST_EXIT_CODE=$?

# Report status
if [ $TEST_EXIT_CODE -eq 0 ]; then
  echo -e "${GREEN}All E2E tests passed!${NC}"
else
  echo -e "${RED}E2E tests failed with exit code $TEST_EXIT_CODE!${NC}"
fi

# Stop the application if we started it
if [ "$STARTED_APP" = true ]; then
  echo -e "${YELLOW}Stopping application...${NC}"
  kill $APP_PID 2>/dev/null
fi

# Exit with the appropriate code
exit $TEST_EXIT_CODE