#!/bin/bash

# Build script for DJVU to PDF Converter Zotero plugin

set -e

PLUGIN_NAME="djvu-converter"
VERSION="1.5.1"
OUTPUT_DIR="build"
XPI_NAME="${PLUGIN_NAME}-${VERSION}.xpi"

echo "Building ${PLUGIN_NAME} v${VERSION}..."

# Create build directory
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

# Create XPI (it's just a zip file)
zip -r "$OUTPUT_DIR/$XPI_NAME" \
    manifest.json \
    bootstrap.js \
    src/ \
    icons/ \
    -x "*.DS_Store" \
    -x "*__MACOSX*"

echo ""
echo "Build complete: $OUTPUT_DIR/$XPI_NAME"
echo ""
echo "To install:"
echo "  1. Open Zotero"
echo "  2. Go to Tools > Add-ons"
echo "  3. Click the gear icon > Install Add-on From File"
echo "  4. Select $OUTPUT_DIR/$XPI_NAME"
