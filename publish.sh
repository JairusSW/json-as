#!/bin/bash

set -e

PACKAGE_NAME="json-as"

echo -e "\n🔧 Building transform..."
if ! npm run build:transform; then
    echo "❌ Build failed. Exiting."
    exit 1
fi

read -r -p "✨ Do you want to format the code before publishing? [Y/n] " FORMAT_RESP
FORMAT_RESP=${FORMAT_RESP,,}

if [[ "$FORMAT_RESP" =~ ^(yes|y| ) || -z "$FORMAT_RESP" ]]; then
    echo "🧹 Formatting code..."
    npm run format
fi

echo -e "\n🧪 Running tests"
if ! npm run test; then
    echo "❌ Tests failed. Exiting."
    exit 1
fi

VERSION=$(node -p "require('./package.json').version")
echo -e "\n📦 Current version: $VERSION"

if [[ "$VERSION" == *"-preview."* ]]; then
    TAG="preview"
elif [[ "$VERSION" == *"-"* ]]; then
    echo "⚠️ Unknown pre-release format. Not publishing."
    exit 1
else
    TAG="latest"
fi

echo ""

read -r -p "✅ All checks passed. Ready to publish $PACKAGE_NAME@$VERSION with tag '$TAG'? [Y/n] " PUBLISH_RESP
PUBLISH_RESP=${PUBLISH_RESP,,}

if [[ "$PUBLISH_RESP" =~ ^(n|no)$ ]]; then
    echo "❌ Publish canceled by user. Exiting."
    exit 0
fi

echo -e "\n🚀 Publishing $PACKAGE_NAME@$VERSION with tag '$TAG'...\n"
npm publish --tag "$TAG"
echo -e "\n✅ Published successfully."

echo -e "\n🧹 Cleaning up old dist-tags..."
npm dist-tag rm "$PACKAGE_NAME" alpha 2>/dev/null || true
npm dist-tag rm "$PACKAGE_NAME" beta 2>/dev/null || true

echo -e "\n🎉 Done."
