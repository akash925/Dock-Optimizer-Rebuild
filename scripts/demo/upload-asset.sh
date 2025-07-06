#!/bin/bash

# Asset Upload Demo Script
# This script demonstrates the company asset upload functionality

echo "=== Company Asset Upload Demo ==="
echo ""

# Configuration
API_BASE_URL="http://localhost:3000"
ASSET_API_URL="$API_BASE_URL/api/company-assets"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if server is running
print_status "Checking if server is running..."
if ! curl -s "$API_BASE_URL/health" > /dev/null 2>&1; then
    print_error "Server is not running on $API_BASE_URL"
    print_warning "Please start the server first: npm run dev"
    exit 1
fi

print_status "Server is running ✓"
echo ""

# Test 1: Create a new company asset
print_status "Test 1: Creating a new company asset..."
ASSET_DATA='{
    "name": "Test Asset - Demo",
    "manufacturer": "Demo Manufacturer",
    "owner": "Demo Owner",
    "category": "EQUIPMENT",
    "description": "This is a test asset created by the demo script",
    "barcode": "DEMO-123456",
    "status": "ACTIVE",
    "location": "Demo Location",
    "department": "IT Department",
    "tags": "[\"demo\", \"test\", \"equipment\"]"
}'

# Note: This will need authentication in production
# For now, assuming auth middleware is mocked or disabled in dev
RESPONSE=$(curl -s -X POST "$ASSET_API_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer demo-token" \
  -d "$ASSET_DATA")

if [ $? -eq 0 ]; then
    print_status "Asset creation request sent successfully"
    echo "Response: $RESPONSE"
    
    # Extract asset ID for further tests
    ASSET_ID=$(echo "$RESPONSE" | grep -o '"id":[0-9]*' | grep -o '[0-9]*')
    if [ -n "$ASSET_ID" ]; then
        print_status "Asset created with ID: $ASSET_ID"
    else
        print_warning "Could not extract asset ID from response"
    fi
else
    print_error "Failed to create asset"
fi

echo ""

# Test 2: List all company assets
print_status "Test 2: Listing all company assets..."
RESPONSE=$(curl -s -X GET "$ASSET_API_URL" \
  -H "Authorization: Bearer demo-token")

if [ $? -eq 0 ]; then
    print_status "Asset list retrieved successfully"
    echo "Response: $RESPONSE"
else
    print_error "Failed to retrieve asset list"
fi

echo ""

# Test 3: Get specific asset by ID (if we have one)
if [ -n "$ASSET_ID" ]; then
    print_status "Test 3: Getting asset by ID ($ASSET_ID)..."
    RESPONSE=$(curl -s -X GET "$ASSET_API_URL/$ASSET_ID" \
      -H "Authorization: Bearer demo-token")

    if [ $? -eq 0 ]; then
        print_status "Asset retrieved successfully"
        echo "Response: $RESPONSE"
    else
        print_error "Failed to retrieve asset"
    fi
    echo ""
fi

# Test 4: Test photo upload presigning (if we have an asset ID)
if [ -n "$ASSET_ID" ]; then
    print_status "Test 4: Testing photo upload presigning..."
    PRESIGN_DATA='{"contentType": "image/jpeg"}'
    
    RESPONSE=$(curl -s -X POST "$ASSET_API_URL/$ASSET_ID/photo/presign" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer demo-token" \
      -d "$PRESIGN_DATA")

    if [ $? -eq 0 ]; then
        print_status "Photo presigning request sent successfully"
        echo "Response: $RESPONSE"
    else
        print_error "Failed to get presigned URL"
    fi
    echo ""
fi

# Test 5: Test legacy asset endpoints
print_status "Test 5: Testing legacy asset endpoints..."
RESPONSE=$(curl -s -X GET "$API_BASE_URL/api/assets" \
  -H "Authorization: Bearer demo-token")

if [ $? -eq 0 ]; then
    print_status "Legacy asset endpoint working"
    echo "Response: $RESPONSE"
else
    print_error "Legacy asset endpoint failed"
fi

echo ""
print_status "=== Demo Complete ==="
print_warning "Note: This script assumes authentication is handled. In production, you'll need valid JWT tokens."
print_warning "For BOL uploads, use the separate BOL upload endpoints at /api/bol-upload/*" 