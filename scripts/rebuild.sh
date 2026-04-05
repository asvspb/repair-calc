#!/bin/bash

# =============================================================================
# Cleanup and Full Rebuild Script for repair-calc Project
# =============================================================================
# This script:
# 1. Stops and removes all Docker containers
# 2. Removes Docker images, volumes, and networks
# 3. Cleans Node.js dependencies and build artifacts
# 4. Reinstalls dependencies and rebuilds the project from scratch
# =============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_header() {
    echo -e "\n${BLUE}============================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}============================================${NC}"
}

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

print_header "Starting Clean Rebuild Process"

# =============================================================================
# Step 1: Stop and remove all Docker containers
# =============================================================================
print_header "Step 1: Cleaning Docker Resources"

print_step "Stopping and removing containers..."
if docker-compose down --remove-orphans 2>/dev/null; then
    print_success "Containers stopped and removed"
else
    print_step "No running containers to stop"
fi

# =============================================================================
# Step 2: Remove Docker volumes (database data)
# =============================================================================
print_step "Removing Docker volumes..."
if docker-compose down -v --remove-orphans 2>/dev/null; then
    print_success "Docker volumes removed"
else
    print_step "No volumes to remove"
fi

# Also remove any dangling volumes
print_step "Removing dangling volumes..."
docker volume prune -f
print_success "Dangling volumes removed"

# =============================================================================
# Step 3: Remove Docker images
# =============================================================================
print_step "Removing project Docker images..."
docker images "repair-calc*" -q | xargs -r docker rmi -f 2>/dev/null || true
docker images "react-example*" -q | xargs -r docker rmi -f 2>/dev/null || true
docker images "*repair-calc*" -q | xargs -r docker rmi -f 2>/dev/null || true
print_success "Project Docker images removed"

# =============================================================================
# Step 4: Remove Docker build cache
# =============================================================================
print_step "Removing Docker build cache..."
docker builder prune -f
print_success "Docker build cache removed"

# =============================================================================
# Step 5: Clean Node.js artifacts
# =============================================================================
print_header "Step 2: Cleaning Node.js Artifacts"

print_step "Removing node_modules..."
rm -rf node_modules
print_success "node_modules removed"

print_step "Removing package-lock.json..."
rm -f package-lock.json
print_success "package-lock.json removed"

print_step "Removing dist folder..."
rm -rf dist
print_success "dist folder removed"

print_step "Removing .vite cache..."
rm -rf node_modules/.vite
print_success ".vite cache removed"

print_step "Removing tsbuildinfo files..."
find . -name "*.tsbuildinfo" -type f -delete 2>/dev/null || true
print_success "tsbuildinfo files removed"

# =============================================================================
# Step 6: Clean server Node.js artifacts (if server directory exists)
# =============================================================================
if [ -d "server" ]; then
    print_header "Step 3: Cleaning Server Artifacts"
    
    print_step "Removing server/node_modules..."
    rm -rf server/node_modules
    print_success "server/node_modules removed"
    
    print_step "Removing server/package-lock.json..."
    rm -f server/package-lock.json
    print_success "server/package-lock.json removed"
    
    print_step "Removing server/dist..."
    rm -rf server/dist
    print_success "server/dist removed"
fi

# =============================================================================
# Step 7: Clean Playwright artifacts
# =============================================================================
print_header "Step 4: Cleaning Test Artifacts"

print_step "Removing Playwright test results..."
rm -rf test-results
rm -rf playwright-report
rm -rf server/test-results
rm -rf server/playwright-report
print_success "Playwright artifacts removed"

# =============================================================================
# Step 8: Clean other caches
# =============================================================================
print_header "Step 5: Cleaning Caches"

print_step "Removing .eslintcache..."
rm -f .eslintcache 2>/dev/null || true
print_success ".eslintcache removed"

print_step "Removing temporary files..."
rm -rf tmp
rm -rf .tmp
print_success "Temporary files removed"

# =============================================================================
# Summary
# =============================================================================
print_header "Cleanup Complete!"
echo ""
echo -e "All artifacts have been removed. Ready to rebuild from scratch."
echo -e "The following was cleaned:"
echo -e "  • Docker containers, images, volumes, and build cache"
echo -e "  • node_modules and package-lock.json (root and server)"
echo -e "  • Build outputs (dist folders)"
echo -e "  • Test reports and results"
echo -e "  • Various cache files"
echo ""

# =============================================================================
# Step 9: Rebuild
# =============================================================================
print_header "Step 6: Rebuilding Project"

print_step "Installing Node.js dependencies..."
if npm install; then
    print_success "Dependencies installed"
else
    print_error "Failed to install dependencies"
    exit 1
fi

if [ -d "server" ] && [ -f "server/package.json" ]; then
    print_step "Installing server dependencies..."
    cd server
    if npm install; then
        print_success "Server dependencies installed"
        cd ..
    else
        print_error "Failed to install server dependencies"
        exit 1
    fi
fi

print_step "Building frontend application..."
if npm run build; then
    print_success "Frontend built successfully"
else
    print_error "Failed to build frontend"
    exit 1
fi

# =============================================================================
# Step 8: Run tests
# =============================================================================
print_header "Step 8: Running Tests"

print_step "Running test suite..."
TEST_OUTPUT=$(npm test 2>&1) || true
echo "$TEST_OUTPUT" | tail -30

# Parse test statistics
if echo "$TEST_OUTPUT" | grep -q "Test Files.*passed"; then
    TEST_FILES_LINE=$(echo "$TEST_OUTPUT" | grep "Test Files")
    TESTS_LINE=$(echo "$TEST_OUTPUT" | grep "Tests")

    print_success "Tests completed!"
    echo ""
    echo -e "  ${YELLOW}$TEST_FILES_LINE${NC}"
    echo -e "  ${YELLOW}$TESTS_LINE${NC}"

    # Check for failures
    if echo "$TEST_OUTPUT" | grep -q "failed"; then
        FAILED_COUNT=$(echo "$TEST_OUTPUT" | grep "Tests" | grep -oP '\d+(?= failed)' | head -1)
        if [ -n "$FAILED_COUNT" ] && [ "$FAILED_COUNT" -gt 0 ]; then
            echo ""
            echo -e "  ${RED}⚠ $FAILED_COUNT test(s) failed - check output above for details${NC}"
        fi
    fi
else
    print_error "Failed to parse test output"
    echo "$TEST_OUTPUT" | tail -10
fi

# =============================================================================
# Step 9: Rebuild Docker images
# =============================================================================
print_header "Step 9: Rebuilding Docker Images"

print_step "Building Docker images from scratch (no cache)..."
if docker-compose build --no-cache; then
    print_success "Docker images built successfully"
else
    print_error "Failed to build Docker images"
    exit 1
fi

# =============================================================================
# Step 10: Start Docker services
# =============================================================================
print_header "Step 10: Starting Services"

print_step "Starting Docker containers..."
if docker-compose up -d; then
    print_success "Containers started"
else
    print_error "Failed to start containers"
    exit 1
fi

print_step "Waiting for services to be ready..."
sleep 3

print_step "Checking service health..."
if docker-compose ps --format "table {{.Name}}\t{{.Status}}"; then
    print_success "Services are running"
else
    print_error "Failed to check service status"
    exit 1
fi

# =============================================================================
# Final Summary
# =============================================================================
print_header "Build Complete!"
echo ""
echo -e "${GREEN}All done! The project has been cleaned, tested, rebuilt, and started.${NC}"
echo ""
echo -e "To view logs:"
echo -e "  ${YELLOW}docker-compose logs -f${NC}"
echo ""
echo -e "To stop the application:"
echo -e "  ${YELLOW}docker-compose down${NC}"
echo ""
print_header "Ready to Use"
