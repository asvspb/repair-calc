#!/bin/bash

# =============================================================================
# Quick Rebuild Script for repair-calc Project
# =============================================================================
# Use this script for quick frontend rebuilds during development.
# It rebuilds the frontend and updates the Docker container.
# =============================================================================
# For a FULL clean rebuild, use: ./scripts/rebuild.sh
# =============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_step() {
    echo -e "\n${YELLOW}▶ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ] || [ ! -f "package.json" ]; then
    print_error "Error: This script must be run from the project root directory"
    exit 1
fi

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}Quick Frontend Rebuild${NC}"
echo -e "${BLUE}============================================${NC}"

# Step 1: Build frontend
print_step "Building frontend application..."
if npm run build; then
    print_success "Frontend built successfully"
else
    print_error "Failed to build frontend"
    exit 1
fi

# Step 2: Rebuild Docker image
print_step "Rebuilding frontend Docker image..."
if docker-compose build frontend; then
    print_success "Docker image rebuilt"
else
    print_error "Failed to rebuild Docker image"
    exit 1
fi

# Step 3: Restart container
print_step "Restarting frontend container..."
if docker-compose up -d frontend; then
    print_success "Container restarted"
else
    print_error "Failed to restart container"
    exit 1
fi

# Step 4: Verify
print_step "Verifying deployment..."
sleep 2  # Wait for nginx to reload
BUNDLE_HASH=$(cat dist/index.html | grep -o 'index-[^"]*\.js' | head -1)
SERVER_HASH=$(curl -s http://localhost:3993/ | grep -o 'index-[^"]*\.js' | head -1)

if [ "$BUNDLE_HASH" = "$SERVER_HASH" ]; then
    print_success "Bundle verified: $BUNDLE_HASH"
else
    print_error "Bundle mismatch! Local: $BUNDLE_HASH, Server: $SERVER_HASH"
    exit 1
fi

echo ""
echo -e "${GREEN}✓ Quick rebuild complete!${NC}"
echo -e "  Frontend available at: ${YELLOW}http://localhost:3993/${NC}"
echo ""
echo -e "${BLUE}Tip: For a full clean rebuild, use: ./scripts/rebuild.sh${NC}"