# DJVU to PDF Converter for Zotero

A Zotero 7/8 plugin that converts DJVU files to PDF with optional OCR and compression.

## Features

- **Automatic Detection**: Prompts to convert when DJVU files are added to your library
- **Manual Conversion**: Right-click context menu for converting DJVU files
- **OCR Support**: Add searchable text layer to PDFs (supports 12 languages)
- **PDF Compression**: Reduce file size using Ghostscript
- **Flexible Options**: Choose to replace original or keep both files
- **Progress Tracking**: Visual progress bar with cancel button
- **Size Reporting**: Shows file size at each conversion stage

## Requirements

### Zotero
- Zotero 7.0 or later

### External Dependencies (macOS)

Install via Homebrew:

```bash
# Required for DJVU conversion
brew install djvulibre

# Required for OCR
brew install ocrmypdf tesseract tesseract-lang

# Required for PDF compression
brew install ghostscript
```

## Installation

1. Download the latest `.xpi` file from [Releases](https://github.com/ievlevpn/zotero-djvu-converter/releases)
2. Open Zotero
3. Go to **Tools** → **Add-ons**
4. Click the gear icon → **Install Add-on From File**
5. Select the downloaded `.xpi` file
6. Restart Zotero

## Usage

### Automatic Conversion
When you add a DJVU file to Zotero, the plugin will automatically prompt you with conversion options.

### Manual Conversion (Context Menu)
Right-click on items in your library to access:

- **Convert DJVU to PDF...** - Convert selected DJVU files
- **Add OCR Layer to PDF...** - Add searchable text to existing PDFs
- **Compress PDF...** - Reduce PDF file size

### Conversion Options

| Option | Description |
|--------|-------------|
| Add OCR text layer | Makes the PDF searchable (requires ocrmypdf + tesseract) |
| OCR Languages | Select one or more languages for OCR |
| Compress PDF | Reduces file size (requires ghostscript) |
| Replace DJVU with PDF | Removes original DJVU after conversion |
| Keep both files | Adds PDF as sibling attachment |

### Supported OCR Languages

English, Russian, German, French, Spanish, Italian, Portuguese, Chinese (Simplified), Japanese, Korean, Arabic, Ukrainian

Additional language packs can be installed via `brew install tesseract-lang`.

## Building from Source

```bash
# Clone the repository
git clone https://github.com/ievlevpn/zotero-djvu-converter.git
cd zotero-djvu-converter

# Build the plugin
bash build.sh

# Output: build/djvu-converter-1.0.0.xpi
```

## Project Structure

```
zotero-djvu-converter/
├── manifest.json      # Plugin metadata
├── bootstrap.js       # Plugin lifecycle hooks
├── src/
│   └── djvu-converter.js  # Main plugin logic
├── icons/
│   ├── icon48.png
│   └── icon96.png
├── build.sh           # Build script
└── README.md
```

## Troubleshooting

### "ddjvu not found" error
Install djvulibre: `brew install djvulibre`

### "ocrmypdf not found" error
Install OCR dependencies: `brew install ocrmypdf tesseract tesseract-lang`

### "ghostscript not found" error
Install ghostscript: `brew install ghostscript`

### OCR is slow
OCR processing time depends on file size and page count. Large files may take several minutes. You can cancel the operation using the Cancel button.

### OCR fails with language error
Make sure the required language pack is installed. Install all language packs with: `brew install tesseract-lang`

## License

MIT License - see [LICENSE](LICENSE) file.

## Author

[ievlevpn](https://github.com/ievlevpn)

## Acknowledgments

- [DjVuLibre](http://djvu.sourceforge.net/) - DJVU tools
- [OCRmyPDF](https://ocrmypdf.readthedocs.io/) - OCR processing
- [Tesseract](https://github.com/tesseract-ocr/tesseract) - OCR engine
- [Ghostscript](https://www.ghostscript.com/) - PDF compression
