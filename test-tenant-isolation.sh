#!/bin/bash

# Test script to verify tenant isolation for availability and confirmation code endpoints

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}===== Testing Tenant Isolation for Appointment Availability =====\n${NC}"

# Load cookies for each tenant to simulate authenticated requests
HANZO_COOKIES="$(cat hanzo_cookies.txt)"
FC_COOKIES="$(cat fccentral_cookies.txt)"

# Test 1: Availability endpoint with cross-tenant access (should fail)
# Fresh Connect user (tenant 5) trying to access Hanzo facility
echo -e "\n${YELLOW}Test 1: Fresh Connect user trying to access Hanzo facility availability${NC}"
echo "Request: GET /api/availability?date=2025-05-01&facilityId=3&typeId=3"

FC_RESPONSE=$(curl -s -b "$FC_COOKIES" -c "$FC_COOKIES" "http://localhost:5000/api/availability?date=2025-05-01&facilityId=3&typeId=3")

if echo "$FC_RESPONSE" | grep -q "Access denied"; then
  echo -e "${GREEN}✓ Test passed: Fresh Connect user correctly denied access to Hanzo facility${NC}"
  echo -e "Response: $FC_RESPONSE"
else
  echo -e "${RED}✗ Test failed: Fresh Connect user should not have access to Hanzo facility${NC}"
  echo -e "Response: $FC_RESPONSE"
fi

# Test 2: Availability rules endpoint with cross-tenant access (should fail)
# Fresh Connect user trying to access Hanzo appointment type availability rules
echo -e "\n${YELLOW}Test 2: Fresh Connect user trying to access Hanzo availability rules${NC}"
echo "Request: GET /api/appointment-master/availability-rules?facilityId=3&typeId=1"

FC_RESPONSE=$(curl -s -b "$FC_COOKIES" -c "$FC_COOKIES" "http://localhost:5000/api/appointment-master/availability-rules?facilityId=3&typeId=1")

if echo "$FC_RESPONSE" | grep -q "Access denied"; then
  echo -e "${GREEN}✓ Test passed: Fresh Connect user correctly denied access to Hanzo availability rules${NC}"
  echo -e "Response: $FC_RESPONSE"
else
  echo -e "${RED}✗ Test failed: Fresh Connect user should not have access to Hanzo availability rules${NC}"
  echo -e "Response: $FC_RESPONSE"
fi

# Test 3: Confirmation code endpoint with cross-tenant access (should fail)
# Fresh Connect user trying to access a Hanzo appointment confirmation
echo -e "\n${YELLOW}Test 3: Fresh Connect user trying to access Hanzo appointment confirmation${NC}"
echo "Request: GET /api/schedules/confirmation/ABC123"  # Use a real code from a Hanzo appointment

FC_RESPONSE=$(curl -s -b "$FC_COOKIES" -c "$FC_COOKIES" "http://localhost:5000/api/schedules/confirmation/ABC123")

if echo "$FC_RESPONSE" | grep -q "Access denied"; then
  echo -e "${GREEN}✓ Test passed: Fresh Connect user correctly denied access to Hanzo appointment confirmation${NC}"
  echo -e "Response: $FC_RESPONSE"
else
  echo -e "${RED}✗ Test failed: Fresh Connect user should not have access to Hanzo appointment confirmation${NC}"
  echo -e "Response: $FC_RESPONSE"
fi

# Test 4: Valid tenant access (should succeed)
# Hanzo user accessing their own facility
echo -e "\n${YELLOW}Test 4: Hanzo user accessing their own facility availability${NC}"
echo "Request: GET /api/availability?date=2025-05-01&facilityId=3&typeId=1"

HANZO_RESPONSE=$(curl -s -b "$HANZO_COOKIES" -c "$HANZO_COOKIES" "http://localhost:5000/api/availability?date=2025-05-01&facilityId=3&typeId=1")

if echo "$HANZO_RESPONSE" | grep -q "availableTimes"; then
  echo -e "${GREEN}✓ Test passed: Hanzo user successfully accessed their own facility availability${NC}"
  echo -e "Response contains availability data"
else
  echo -e "${RED}✗ Test failed: Hanzo user should be able to access their own facility${NC}"
  echo -e "Response: $HANZO_RESPONSE"
fi

echo -e "\n${YELLOW}===== Tenant Isolation Tests Complete =====\n${NC}"