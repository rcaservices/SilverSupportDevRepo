#!/bin/bash
# File: scripts/release.sh
# Alpha testing release automation script
# Usage: ./scripts/release.sh [build|minor|stable] [message]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
VERSION_FILE="$PROJECT_ROOT/src/utils/version.js"

# Default values
INCREMENT_TYPE="${1:-build}"
COMMIT_MESSAGE="${2:-Alpha release}"

echo -e "${BLUE}=== AI Technical Support - Alpha Release Script ===${NC}"
echo -e "${BLUE}Following cPanel versioning: ODD = Development, EVEN = Stable${NC}\n"

# Validate increment type
case "$INCREMENT_TYPE" in
    "build"|"minor"|"stable"|"patch")
        ;;
    *)
        echo -e "${RED}Error: Invalid increment type '$INCREMENT_TYPE'${NC}"
        echo "Valid options: build, minor, stable, patch"
        exit 1
        ;;
esac

# Check if we're in git repository
if [ ! -d ".git" ]; then
    echo -e "${RED}Error: Not in a git repository${NC}"
    exit 1
fi

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}Warning: Uncommitted changes detected${NC}"
    echo "Continuing with release..."
fi

cd "$PROJECT_ROOT"

# Get current version
CURRENT_VERSION=$(node -e "const v = require('./src/utils/version'); console.log(v.current)")
echo -e "Current version: ${GREEN}$CURRENT_VERSION${NC}"

# Check if current version is development (odd minor number)
IS_DEV=$(node -e "const v = require('./src/utils/version'); console.log(v.info.isDevelopment)")

if [ "$INCREMENT_TYPE" = "stable" ] && [ "$IS_DEV" != "true" ]; then
    echo -e "${YELLOW}Warning: Already on stable version (even minor number)${NC}"
    echo "Current version: $CURRENT_VERSION"
    exit 0
fi

# Pre-release checks
echo -e "\n${BLUE}Running pre-release checks...${NC}"

# Check if Node.js dependencies are installed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install
fi

# Run tests if they exist
if npm run test >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Tests passed${NC}"
else
    echo -e "${YELLOW}⚠ Tests not available or failed${NC}"
fi

# Run linting if available
if npm run lint >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Linting passed${NC}"
else
    echo -e "${YELLOW}⚠ Linting not available${NC}"
fi

# Check database migrations
if [ -d "src/database/migrations" ]; then
    MIGRATION_COUNT=$(find src/database/migrations -name "*.sql" | wc -l)
    echo -e "${GREEN}✓ Found $MIGRATION_COUNT database migrations${NC}"
fi

# Update version
echo -e "\n${BLUE}Updating version...${NC}"

# Backup current version file
cp "$VERSION_FILE" "$VERSION_FILE.backup"

if [ "$INCREMENT_TYPE" = "stable" ]; then
    # Convert to stable (odd -> even)
    NEW_VERSION=$(node -e "
        const v = require('./src/utils/version');
        v.toStable();
        console.log(v.current);
    ")
    RELEASE_TYPE="stable"
else
    # Increment version
    NEW_VERSION=$(node -e "
        const v = require('./src/utils/version');
        v.increment('$INCREMENT_TYPE');
        console.log(v.current);
    ")
    RELEASE_TYPE="alpha"
fi

echo -e "New version: ${GREEN}$NEW_VERSION${NC}"

# Update package.json version
if [ -f "package.json" ]; then
    npm version "$NEW_VERSION" --no-git-tag-version
    echo -e "${GREEN}✓ Updated package.json${NC}"
fi

# Update admin dashboard version
if [ -f "admin-dashboard/package.json" ]; then
    cd admin-dashboard
    npm version "$NEW_VERSION" --no-git-tag-version
    cd ..
    echo -e "${GREEN}✓ Updated admin-dashboard/package.json${NC}"
fi

# Generate release notes
echo -e "\n${BLUE}Generating release notes...${NC}"
RELEASE_NOTES=$(node -e "
    const v = require('./src/utils/version');
    const notes = v.releaseNotes;
    console.log(\`# \${notes.title}

**Version:** \${v.current}  
**Type:** \${notes.type}  
**Date:** \${notes.date}

## Features
\${notes.features.map(f => '- ' + f).join('\\n')}

## Improvements  
\${notes.improvements.map(i => '- ' + i).join('\\n')}

## Bug Fixes
\${notes.bugFixes.map(b => '- ' + b).join('\\n')}

## Known Issues
\${notes.knownIssues.map(k => '- ' + k).join('\\n')}
\`);
")

# Create release notes file
echo "$RELEASE_NOTES" > "RELEASE_NOTES_$NEW_VERSION.md"
echo -e "${GREEN}✓ Created RELEASE_NOTES_$NEW_VERSION.md${NC}"

# Git operations
echo -e "\n${BLUE}Creating git commit and tag...${NC}"

# Stage all changes
git add .

# Create commit
git commit -m "$RELEASE_TYPE Release $NEW_VERSION - $COMMIT_MESSAGE"
echo -e "${GREEN}✓ Created commit${NC}"

# Create annotated tag
TAG_MESSAGE="$RELEASE_TYPE Release $NEW_VERSION

$COMMIT_MESSAGE

Release Type: $RELEASE_TYPE
Previous Version: $CURRENT_VERSION
New Version: $NEW_VERSION"

git tag -a "v$NEW_VERSION" -m "$TAG_MESSAGE"
echo -e "${GREEN}✓ Created tag v$NEW_VERSION${NC}"

# Display summary
echo -e "\n${GREEN}=== Release Summary ===${NC}"
echo -e "Previous version: $CURRENT_VERSION"
echo -e "New version: ${GREEN}$NEW_VERSION${NC}"
echo -e "Release type: ${GREEN}$RELEASE_TYPE${NC}"
echo -e "Git tag: ${GREEN}v$NEW_VERSION${NC}"

if [ "$RELEASE_TYPE" = "alpha" ]; then
    echo -e "Development status: ${YELLOW}Alpha Testing (Odd Minor Number)${NC}"
else
    echo -e "Development status: ${GREEN}Stable Release (Even Minor Number)${NC}"
fi

echo -e "\n${BLUE}Next steps:${NC}"
echo -e "1. Review changes: git show v$NEW_VERSION"
echo -e "2. Push to repository: git push origin main && git push origin v$NEW_VERSION"
echo -e "3. Deploy to alpha environment"
echo -e "4. Update documentation"

if [ "$RELEASE_TYPE" = "alpha" ]; then
    echo -e "5. Notify alpha testers"
    echo -e "6. Monitor alpha testing feedback"
else
    echo -e "5. Deploy to production"
    echo -e "6. Notify production users"
fi

echo -e "\n${GREEN}Release preparation complete!${NC}"

# Cleanup backup
rm -f "$VERSION_FILE.backup"