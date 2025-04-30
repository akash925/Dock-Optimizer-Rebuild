#!/bin/bash

# Test script to verify tenant isolation for facilities

echo "=== Testing Tenant Isolation for Facilities ==="
echo

# Fresh Connect login
echo "Step 1: Login as Fresh Connect Central user"
curl -s -X POST -H "Content-Type: application/json" -d '{"username":"akash@agarwalhome.com","password":"fccentral"}' http://localhost:5000/api/login -c fccentral_cookies.txt

# Get cookie
FC_COOKIE=$(grep -P 'connect\.sid\s' fccentral_cookies.txt | awk '{print $7}' | tr -d '\n\r')
echo
echo "Got Fresh Connect cookie: $FC_COOKIE"

echo
echo "Step 2: Get Fresh Connect Central facilities (should show only facilities 7,8,9)"
echo
curl -s -b "connect.sid=$FC_COOKIE" http://localhost:5000/api/facilities | jq '.' || echo "Failed to parse JSON response"

echo
echo "Step 3: Login as Hanzo Logistics user"
echo
curl -s -X POST -H "Content-Type: application/json" -d '{"username":"akash.agarwal@conmitto.io","password":"password123"}' http://localhost:5000/api/login -c hanzo_cookies.txt

# Get cookie
HANZO_COOKIE=$(grep -P 'connect\.sid\s' hanzo_cookies.txt | awk '{print $7}' | tr -d '\n\r')
echo
echo "Got Hanzo cookie: $HANZO_COOKIE"

echo
echo "Step 4: Get Hanzo Logistics facilities as super-admin (should show all facilities)"
echo
curl -s -b "connect.sid=$HANZO_COOKIE" http://localhost:5000/api/facilities | jq '.[].id' || echo "Failed to parse JSON response"

echo
echo "Step 5: Test as regular Hanzo user (not super-admin)"
echo
curl -s -X POST -H "Content-Type: application/json" -d '{"username":"testadmin","password":"testadmin@example.com"}' http://localhost:5000/api/login -c hanzo_user_cookies.txt

# Get cookie
HANZO_USER_COOKIE=$(grep -P 'connect\.sid\s' hanzo_user_cookies.txt | awk '{print $7}' | tr -d '\n\r')
echo
echo "Got Hanzo regular user cookie: $HANZO_USER_COOKIE"

echo
echo "Step 6: Get facilities as Hanzo regular user (should only show Hanzo facilities 1-6)"
echo
curl -s -b "connect.sid=$HANZO_USER_COOKIE" http://localhost:5000/api/facilities | jq '.[].id' || echo "Failed to parse JSON response"

echo
echo "=== Test Complete ==="