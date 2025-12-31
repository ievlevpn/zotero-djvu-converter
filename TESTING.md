# DJVU to PDF Converter - Testing Checklist

## Basic Conversion
- [ ] Add single DJVU file to Zotero → conversion dialog appears
- [ ] Convert DJVU to PDF without OCR → PDF created successfully
- [ ] Convert DJVU to PDF with OCR → PDF has searchable text
- [ ] Convert with "Replace original" → DJVU removed, only PDF remains
- [ ] Convert with "Keep both" → Both DJVU and PDF exist as siblings
- [ ] Cancel conversion mid-process → operation stops, no partial files left

## Batch Auto-convert
- [ ] Drag 3+ DJVU files into Zotero simultaneously → single dialog for all files
- [ ] Batch convert multiple files → progress shows [1/3], [2/3], [3/3]
- [ ] Cancel during batch → remaining files not processed

## Manual Context Menu
- [ ] Right-click DJVU → "Convert DJVU to PDF..." appears
- [ ] Right-click PDF → "Add OCR Layer..." and "Compress PDF..." appear
- [ ] Right-click non-DJVU/PDF → DJVU options hidden
- [ ] Select multiple DJVUs → batch conversion works
- [ ] Select multiple PDFs → batch OCR/compress works

## Queue System
- [ ] Start conversion, then right-click another file and start OCR → second operation queues
- [ ] Queue shows "X more in queue" message
- [ ] "Cancel All" button appears when queue has items
- [ ] "Cancel All" clears entire queue
- [ ] Operations process sequentially (not simultaneously)

## Progress Display
- [ ] Single file shows no [1/1] prefix
- [ ] Multiple files show [1/N], [2/N], etc.
- [ ] Progress updates as pages convert
- [ ] Cancel button works immediately (no extra click needed)
- [ ] Success shows "Done!" with green text
- [ ] Failure shows error with red text

## OCR Features
- [ ] OCR with default language (English) works
- [ ] OCR with multiple languages selected works
- [ ] OCR on PDF that already has text → force OCR option works
- [ ] Large PDF (50+ pages) → shows page progress

## Compression
- [ ] Compress PDF with "Light" → file size reduces
- [ ] Compress PDF with "Medium" → more reduction
- [ ] Compress PDF with "Aggressive" → maximum reduction
- [ ] Original file replaced after compression

## Edge Cases
- [ ] Convert file with special characters in name (spaces, quotes, unicode)
- [ ] Convert very large DJVU (100+ pages) → completes without timeout
- [ ] Close Zotero during conversion → no crash, clean shutdown
- [ ] Start same file twice rapidly → only processes once (no duplicates)
- [ ] Delete item from library during conversion → graceful error message

## Error Handling
- [ ] Convert without ddjvu installed → shows install instructions
- [ ] OCR without tesseract installed → shows install instructions
- [ ] Corrupt DJVU file → shows appropriate error
- [ ] Disk full during conversion → shows appropriate error

## Plugin Lifecycle
- [ ] Disable plugin → no errors in console
- [ ] Re-enable plugin → works normally
- [ ] Restart Zotero → orphaned temp files cleaned up
- [ ] Check Zotero temp folder → only `djvu_conv_*` files from this plugin

## Platform-Specific (if applicable)
- [ ] macOS: Homebrew-installed tools detected
- [ ] Linux: apt-installed tools detected
- [ ] Windows: Chocolatey/PATH tools detected
- [ ] Windows: Paths with spaces work correctly
