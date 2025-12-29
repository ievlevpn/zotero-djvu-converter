class ZoteroDJVUConverter {
  constructor() {
    this.notifierID = null;
    this.ddjvuPath = "/opt/homebrew/bin/ddjvu";
    this.ocrmypdfPath = "/opt/homebrew/bin/ocrmypdf";
    this.gsPath = "/opt/homebrew/bin/gs";
    this._menuPopupHandler = null;
    this._isProcessing = false; // Prevent concurrent conversions
  }

  log(msg) {
    Zotero.debug(`[DJVU Converter] ${msg}`);
    dump(`[DJVU Converter] ${msg}\n`);
  }

  // Truncate long filenames for display in dialogs
  truncateFilename(filename, maxLength = 50) {
    if (!filename || filename.length <= maxLength) return filename;
    const ext = filename.lastIndexOf('.') > 0 ? filename.slice(filename.lastIndexOf('.')) : '';
    const nameWithoutExt = filename.slice(0, filename.length - ext.length);
    const available = maxLength - ext.length - 3; // 3 for "..."
    if (available <= 0) {
      // Not enough space for name + ext, just truncate the whole thing
      return filename.slice(0, maxLength - 3) + '...';
    }
    const truncatedName = nameWithoutExt.slice(0, available) + '...';
    return truncatedName + ext;
  }

  // Escape path for use in shell commands (inside double quotes)
  escapeShellPath(path) {
    // Escape characters that are special inside double quotes: $ ` \ " !
    // Also remove any newlines/carriage returns for safety
    return path
      .replace(/[\r\n]/g, '') // Remove newlines (shouldn't exist in filenames)
      .replace(/([\\$`"!])/g, '\\$1');
  }

  async init() {
    this.log("Initializing...");

    // Find tools using `which` command
    this.ddjvuPath = await this.findExecutable("ddjvu");
    this.ddjvuFound = !!this.ddjvuPath;
    if (this.ddjvuFound) this.log(`Found ddjvu at: ${this.ddjvuPath}`);

    this.ocrmypdfPath = await this.findExecutable("ocrmypdf");
    this.ocrmypdfFound = !!this.ocrmypdfPath;
    if (this.ocrmypdfFound) this.log(`Found ocrmypdf at: ${this.ocrmypdfPath}`);

    const tesseractPath = await this.findExecutable("tesseract");
    this.tesseractFound = !!tesseractPath;
    if (this.tesseractFound) this.log(`Found tesseract at: ${tesseractPath}`);

    this.gsPath = await this.findExecutable("gs");
    this.gsFound = !!this.gsPath;
    if (this.gsFound) this.log(`Found ghostscript at: ${this.gsPath}`);

    // Also check for pdftotext (used for checking existing OCR)
    this.pdftotextPath = await this.findExecutable("pdftotext");
    if (this.pdftotextPath) this.log(`Found pdftotext at: ${this.pdftotextPath}`);

    // Also check for pdfinfo (used for page count)
    this.pdfinfoPath = await this.findExecutable("pdfinfo");
    if (this.pdfinfoPath) this.log(`Found pdfinfo at: ${this.pdfinfoPath}`);

    // Show dependency check popup
    this.showDependencyCheck();
  }

  // Get page count from PDF using pdfinfo
  async getPdfPageCount(pdfPath) {
    try {
      if (!this.pdfinfoPath) return null;

      const tempFile = pdfPath + ".pagecount";
      const escapedPdf = this.escapeShellPath(pdfPath);
      const escapedTemp = this.escapeShellPath(tempFile);

      await Zotero.Utilities.Internal.exec("/bin/sh", ["-c",
        `"${this.pdfinfoPath}" "${escapedPdf}" 2>/dev/null | grep -i "^Pages:" > "${escapedTemp}"`
      ]);

      await Zotero.Promise.delay(100);

      let pageCount = null;
      try {
        const content = await Zotero.File.getContentsAsync(tempFile);
        const match = content.match(/Pages:\s*(\d+)/i);
        if (match) {
          pageCount = parseInt(match[1], 10);
        }
      } catch (e) {}

      try { await IOUtils.remove(tempFile); } catch (e) {}

      return pageCount;
    } catch (e) {
      this.log(`Error getting page count: ${e.message}`);
      return null;
    }
  }

  // Find executable on PATH using `which`
  async findExecutable(name) {
    try {
      // Write which output to a temp file since exec doesn't return stdout
      const tempDir = Zotero.getTempDirectory().path;
      const tempFile = PathUtils.join(tempDir, `which_${name}_${Date.now()}.txt`);
      const escapedTempFile = this.escapeShellPath(tempFile);

      // Run which with expanded PATH and write result to temp file
      const cmd = `export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:$PATH"; which ${name} > "${escapedTempFile}" 2>/dev/null`;

      await Zotero.Utilities.Internal.exec("/bin/sh", ["-c", cmd]);

      // Small delay to ensure file is written
      await Zotero.Promise.delay(100);

      // Read the result
      let foundPath = null;
      try {
        const content = await Zotero.File.getContentsAsync(tempFile);
        const trimmed = content?.trim();
        if (trimmed && trimmed.length > 0 && trimmed.startsWith("/")) {
          foundPath = trimmed;
        }
      } catch (e) {
        // File might not exist if which failed
      }

      // Clean up temp file
      try { await IOUtils.remove(tempFile); } catch (e) {}

      return foundPath;
    } catch (e) {
      this.log(`Error finding ${name}: ${e.message}`);
    }
    return null;
  }

  showDependencyCheck() {
    const allFound = this.ddjvuFound && this.ocrmypdfFound && this.tesseractFound && this.gsFound;

    // Only show popup if something is missing
    if (allFound) {
      this.log("All dependencies found");
      return;
    }

    const ok = "\u2705"; // ✅
    const missing = "\u274C"; // ❌

    let message = "Dependency Check\n\n";

    // ddjvu status
    message += `${this.ddjvuFound ? ok : missing} ddjvu (djvulibre) - DJVU to PDF conversion\n`;

    // ocrmypdf status
    message += `${this.ocrmypdfFound ? ok : missing} ocrmypdf - OCR text layer\n`;

    // tesseract status
    message += `${this.tesseractFound ? ok : missing} tesseract - OCR engine\n`;

    // ghostscript status
    message += `${this.gsFound ? ok : missing} ghostscript - PDF compression\n`;

    message += "\n--- Install missing dependencies ---\n\n";

    if (!this.ddjvuFound) {
      message += "  brew install djvulibre\n";
    }
    if (!this.ocrmypdfFound) {
      message += "  brew install ocrmypdf\n";
    }
    if (!this.tesseractFound) {
      message += "  brew install tesseract tesseract-lang\n";
    }
    if (!this.gsFound) {
      message += "  brew install ghostscript\n";
    }

    message += "\nRestart Zotero after installing.";

    Services.prompt.alert(
      null,
      "DJVU to PDF Converter",
      message
    );
  }

  shutdown() {
    this.log("Shutting down...");
    if (this.notifierID) {
      Zotero.Notifier.unregisterObserver(this.notifierID);
      this.notifierID = null;
    }
  }

  onMainWindowLoad(window) {
    this.log("Main window loaded");
    this.addContextMenu(window);
  }

  onMainWindowUnload(window) {
    this.log("Main window unloading...");
    this.removeContextMenu(window);
  }

  addContextMenu(window) {
    const doc = window.document;
    const self = this;

    // Find the item context menu
    const menu = doc.getElementById("zotero-itemmenu");
    if (!menu) {
      this.log("Could not find zotero-itemmenu");
      return;
    }

    // Check if already added (prevent duplicates)
    if (doc.getElementById("djvu-converter-separator")) {
      this.log("Context menu already added, skipping");
      return;
    }

    // Create separator
    const separator = doc.createXULElement("menuseparator");
    separator.id = "djvu-converter-separator";
    menu.appendChild(separator);

    // Create "Convert DJVU to PDF" menu item
    const convertMenuItem = doc.createXULElement("menuitem");
    convertMenuItem.id = "djvu-converter-convert";
    convertMenuItem.setAttribute("label", "Convert DJVU to PDF...");
    convertMenuItem.addEventListener("command", async () => {
      await self.handleManualConvert();
    });
    menu.appendChild(convertMenuItem);

    // Create "Add OCR Layer" menu item
    const ocrMenuItem = doc.createXULElement("menuitem");
    ocrMenuItem.id = "djvu-converter-ocr";
    ocrMenuItem.setAttribute("label", "Add OCR Layer to PDF...");
    ocrMenuItem.addEventListener("command", async () => {
      await self.handleManualOcr();
    });
    menu.appendChild(ocrMenuItem);

    // Create "Compress PDF" menu item
    const compressMenuItem = doc.createXULElement("menuitem");
    compressMenuItem.id = "djvu-converter-compress";
    compressMenuItem.setAttribute("label", "Compress PDF...");
    compressMenuItem.addEventListener("command", async () => {
      await self.handleManualCompress();
    });
    menu.appendChild(compressMenuItem);

    // Add listener to show/hide items based on selection
    // Store reference for cleanup
    this._menuPopupHandler = () => {
      self.updateContextMenuVisibility(window);
    };
    menu.addEventListener("popupshowing", this._menuPopupHandler);

    this.log("Context menu items added");
  }

  removeContextMenu(window) {
    const doc = window.document;

    // Remove event listener
    const menu = doc.getElementById("zotero-itemmenu");
    if (menu && this._menuPopupHandler) {
      menu.removeEventListener("popupshowing", this._menuPopupHandler);
    }

    // Remove menu items
    const ids = [
      "djvu-converter-separator",
      "djvu-converter-convert",
      "djvu-converter-ocr",
      "djvu-converter-compress"
    ];

    for (const id of ids) {
      const el = doc.getElementById(id);
      if (el) {
        el.remove();
      }
    }

    this.log("Context menu items removed");
  }

  updateContextMenuVisibility(window) {
    const doc = window.document;
    const convertItem = doc.getElementById("djvu-converter-convert");
    const ocrItem = doc.getElementById("djvu-converter-ocr");
    const compressItem = doc.getElementById("djvu-converter-compress");
    const separator = doc.getElementById("djvu-converter-separator");

    // Hide all by default
    if (convertItem) convertItem.hidden = true;
    if (ocrItem) ocrItem.hidden = true;
    if (compressItem) compressItem.hidden = true;
    if (separator) separator.hidden = true;

    // Get selected items
    const zoteroPane = Zotero.getActiveZoteroPane();
    if (!zoteroPane) return;
    const items = zoteroPane.getSelectedItems();
    if (!items || items.length === 0) return;

    let hasDjvu = false;
    let hasPdf = false;

    // Helper to check attachment type
    const checkAttachment = (item) => {
      if (!item.isAttachment()) return;
      const contentType = item.attachmentContentType;
      const filename = item.attachmentFilename || "";
      const lowerName = filename.toLowerCase();

      if (lowerName.endsWith(".djvu") || lowerName.endsWith(".djv")) {
        hasDjvu = true;
      }
      if (contentType === "application/pdf" || lowerName.endsWith(".pdf")) {
        hasPdf = true;
      }
    };

    for (const item of items) {
      if (item.isAttachment()) {
        checkAttachment(item);
      } else {
        // Check child attachments of parent items
        const attachmentIDs = item.getAttachments();
        for (const attID of attachmentIDs) {
          const attachment = Zotero.Items.get(attID);
          if (attachment) {
            checkAttachment(attachment);
          }
        }
      }
    }

    // Show relevant menu items
    if (hasDjvu && convertItem) {
      convertItem.hidden = false;
      if (separator) separator.hidden = false;
    }
    if (hasPdf && ocrItem) {
      ocrItem.hidden = false;
      if (separator) separator.hidden = false;
    }
    if (hasPdf && compressItem) {
      compressItem.hidden = false;
      if (separator) separator.hidden = false;
    }
  }

  async handleManualConvert() {
    const zoteroPane = Zotero.getActiveZoteroPane();
    if (!zoteroPane) return;
    const items = zoteroPane.getSelectedItems();
    if (!items || items.length === 0) return;

    // Check if ddjvu is available
    if (!this.ddjvuFound) {
      Services.prompt.alert(
        null,
        "DJVU to PDF Converter - Error",
        "Cannot convert: ddjvu (djvulibre) is not installed.\n\n" +
        "Please install it with:\n" +
        "  brew install djvulibre\n\n" +
        "Then restart Zotero."
      );
      return;
    }

    // Collect all DJVU attachments (NOT PDFs, NOT in trash)
    const djvuItems = [];

    const checkItem = (item) => {
      if (item.isAttachment() && !item.deleted) {
        const filename = item.attachmentFilename || "";
        const lowerName = filename.toLowerCase();
        // Only DJVU files, not PDFs
        if (lowerName.endsWith(".djvu") || lowerName.endsWith(".djv")) {
          djvuItems.push(item);
        }
      }
    };

    for (const item of items) {
      if (item.isAttachment() && !item.deleted) {
        checkItem(item);
      } else if (!item.deleted) {
        // Check child attachments
        const attachmentIDs = item.getAttachments();
        for (const attID of attachmentIDs) {
          const attachment = Zotero.Items.get(attID);
          if (attachment) {
            checkItem(attachment);
          }
        }
      }
    }

    // Check if any DJVU files found
    if (djvuItems.length === 0) {
      Services.prompt.alert(
        null,
        "DJVU to PDF Converter",
        "No DJVU files found in selection.\n\nThis option only works with .djvu or .djv files."
      );
      return;
    }

    this.log(`Found ${djvuItems.length} DJVU file(s) to convert`);

    // Process each DJVU
    for (const djvuItem of djvuItems) {
      await this.processAttachment(djvuItem);
    }
  }

  async handleManualOcr() {
    const zoteroPane = Zotero.getActiveZoteroPane();
    if (!zoteroPane) return;
    const items = zoteroPane.getSelectedItems();
    if (!items || items.length === 0) return;

    // Check dependencies
    if (!this.ocrmypdfFound || !this.tesseractFound) {
      let missingDeps = [];
      if (!this.ocrmypdfFound) missingDeps.push("ocrmypdf");
      if (!this.tesseractFound) missingDeps.push("tesseract");

      Services.prompt.alert(
        null,
        "DJVU to PDF Converter - Error",
        `Cannot add OCR: ${missingDeps.join(" and ")} not installed.\n\n` +
        "Please install with:\n" +
        "  brew install ocrmypdf tesseract tesseract-lang\n\n" +
        "Then restart Zotero."
      );
      return;
    }

    // Collect all PDF attachments (NOT in trash)
    const pdfItems = [];

    const checkItem = (item) => {
      if (item.isAttachment() && !item.deleted) {
        const contentType = item.attachmentContentType;
        const filename = item.attachmentFilename || "";
        if (contentType === "application/pdf" || filename.toLowerCase().endsWith(".pdf")) {
          pdfItems.push(item);
        }
      }
    };

    for (const item of items) {
      if (item.isAttachment() && !item.deleted) {
        checkItem(item);
      } else if (!item.deleted) {
        // Check child attachments
        const attachmentIDs = item.getAttachments();
        for (const attID of attachmentIDs) {
          const attachment = Zotero.Items.get(attID);
          if (attachment) {
            checkItem(attachment);
          }
        }
      }
    }

    // Check if any PDF files found
    if (pdfItems.length === 0) {
      Services.prompt.alert(
        null,
        "DJVU to PDF Converter",
        "No PDF files found in selection.\n\nThis option only works with PDF files."
      );
      return;
    }

    // Process each PDF
    for (const pdfItem of pdfItems) {
      await this.addOcrToExistingPdf(pdfItem);
    }
  }

  async handleManualCompress() {
    const zoteroPane = Zotero.getActiveZoteroPane();
    if (!zoteroPane) return;
    const items = zoteroPane.getSelectedItems();
    if (!items || items.length === 0) return;

    // Check dependencies
    if (!this.gsFound) {
      Services.prompt.alert(
        null,
        "DJVU to PDF Converter - Error",
        "Cannot compress: ghostscript is not installed.\n\n" +
        "Please install it with:\n" +
        "  brew install ghostscript\n\n" +
        "Then restart Zotero."
      );
      return;
    }

    // Collect all PDF attachments (NOT in trash)
    const pdfItems = [];

    const checkItem = (item) => {
      if (item.isAttachment() && !item.deleted) {
        const contentType = item.attachmentContentType;
        const filename = item.attachmentFilename || "";
        if (contentType === "application/pdf" || filename.toLowerCase().endsWith(".pdf")) {
          pdfItems.push(item);
        }
      }
    };

    for (const item of items) {
      if (item.isAttachment() && !item.deleted) {
        checkItem(item);
      } else if (!item.deleted) {
        // Check child attachments
        const attachmentIDs = item.getAttachments();
        for (const attID of attachmentIDs) {
          const attachment = Zotero.Items.get(attID);
          if (attachment) {
            checkItem(attachment);
          }
        }
      }
    }

    // Check if any PDF files found
    if (pdfItems.length === 0) {
      Services.prompt.alert(
        null,
        "DJVU to PDF Converter",
        "No PDF files found in selection.\n\nThis option only works with PDF files."
      );
      return;
    }

    // Process each PDF
    for (const pdfItem of pdfItems) {
      await this.compressExistingPdf(pdfItem);
    }
  }

  async checkPdfHasText(filePath) {
    // Use pdftotext to check if PDF has text
    // Returns true if text found, false otherwise
    try {
      if (!this.pdftotextPath) {
        this.log("pdftotext not found, cannot check for existing text");
        return false; // Assume no text if we can't check
      }

      // Extract text from first 3 pages to a temp file
      const tempTextFile = filePath + ".txt";
      const escapedPdf = this.escapeShellPath(filePath);
      const escapedTxt = this.escapeShellPath(tempTextFile);

      const cmd = `"${this.pdftotextPath}" -f 1 -l 3 "${escapedPdf}" "${escapedTxt}" 2>/dev/null`;

      await Zotero.Utilities.Internal.exec("/bin/sh", ["-c", cmd]);

      // Wait a bit for file to be written
      await Zotero.Promise.delay(200);

      // Check if text file has content
      let hasText = false;
      try {
        const textContent = await Zotero.File.getContentsAsync(tempTextFile);
        // Check if there's meaningful text (more than just whitespace)
        const cleanedText = textContent.replace(/\s+/g, '').trim();
        hasText = cleanedText.length > 50; // More than 50 non-whitespace chars
        this.log(`PDF text check: ${cleanedText.length} chars found, hasText=${hasText}`);
      } catch (e) {
        this.log(`Could not read text file: ${e.message}`);
      }

      // Clean up temp file
      try {
        await IOUtils.remove(tempTextFile);
      } catch (e) {}

      return hasText;
    } catch (e) {
      this.log(`Error checking PDF text: ${e.message}`);
      return false;
    }
  }

  showOcrOptionsDialog(filename, hasExistingText) {
    return new Promise((resolve) => {
      const win = Zotero.getMainWindow();
      if (!win) {
        this.log("No main window found");
        resolve(null);
        return;
      }
      const doc = win.document;

      // Remove any existing dialog
      const existing = doc.getElementById("djvu-ocr-dialog");
      if (existing) existing.remove();

      // Create overlay
      const overlay = doc.createElement("div");
      overlay.id = "djvu-ocr-dialog";
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      `;

      // Create dialog box
      const dialog = doc.createElement("div");
      dialog.style.cssText = `
        background: white;
        border-radius: 8px;
        padding: 20px;
        min-width: 350px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        color: #333;
      `;

      // Title
      const title = doc.createElement("div");
      title.textContent = hasExistingText ? "Redo OCR" : "Add OCR Layer";
      title.style.cssText = "font-size: 16px; font-weight: bold; margin-bottom: 15px;";
      dialog.appendChild(title);

      // Message
      const message = doc.createElement("div");
      const truncatedName = this.truncateFilename(filename);
      if (hasExistingText) {
        message.textContent = `"${truncatedName}" already appears to have text/OCR. Redo the OCR?`;
      } else {
        message.textContent = `Add OCR text layer to "${truncatedName}"?`;
      }
      message.style.cssText = "margin-bottom: 20px; color: #666;";
      dialog.appendChild(message);

      // Languages label
      const langLabel = doc.createElement("div");
      langLabel.textContent = "OCR Languages:";
      langLabel.style.cssText = "font-weight: 500; margin-bottom: 10px;";
      dialog.appendChild(langLabel);

      // Language checkboxes in a grid
      const langGrid = doc.createElement("div");
      langGrid.style.cssText = "display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px 12px; margin-bottom: 16px;";

      const languages = [
        { code: "eng", name: "English" },
        { code: "rus", name: "Russian" },
        { code: "deu", name: "German" },
        { code: "fra", name: "French" },
        { code: "spa", name: "Spanish" },
        { code: "ita", name: "Italian" },
        { code: "por", name: "Portuguese" },
        { code: "chi_sim", name: "Chinese (S)" },
        { code: "jpn", name: "Japanese" },
        { code: "kor", name: "Korean" },
        { code: "ara", name: "Arabic" },
        { code: "ukr", name: "Ukrainian" }
      ];

      const langChecks = [];

      for (const lang of languages) {
        const langOption = doc.createElement("label");
        langOption.style.cssText = "display: flex; align-items: center; cursor: pointer; font-size: 12px;";
        const check = doc.createElement("input");
        check.type = "checkbox";
        check.value = lang.code;
        check.style.cssText = "margin-right: 4px; width: 14px; height: 14px;";
        if (lang.code === "eng") {
          check.checked = true;
        }
        langOption.appendChild(check);
        langOption.appendChild(doc.createTextNode(lang.name));
        langGrid.appendChild(langOption);
        langChecks.push(check);
      }

      dialog.appendChild(langGrid);

      // Compress checkbox (if ghostscript available)
      let compressCheck = null;
      if (this.gsFound) {
        const compressLabel = doc.createElement("label");
        compressLabel.style.cssText = "display: flex; align-items: center; margin-bottom: 20px; cursor: pointer;";
        compressCheck = doc.createElement("input");
        compressCheck.type = "checkbox";
        compressCheck.checked = true;
        compressCheck.style.cssText = "margin-right: 8px; width: 16px; height: 16px;";
        compressLabel.appendChild(compressCheck);
        compressLabel.appendChild(doc.createTextNode("Compress PDF after OCR"));
        dialog.appendChild(compressLabel);
      }

      // Buttons container
      const buttons = doc.createElement("div");
      buttons.style.cssText = "display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px;";

      // Cleanup function
      const cleanup = () => {
        doc.removeEventListener("keydown", handleKeydown);
        if (overlay.parentNode) {
          overlay.remove();
        }
      };

      // Cancel button
      const cancelBtn = doc.createElement("button");
      cancelBtn.textContent = "Cancel";
      cancelBtn.style.cssText = `
        padding: 8px 16px;
        border: 1px solid #888;
        border-radius: 6px;
        background: linear-gradient(to bottom, #f8f8f8, #e8e8e8);
        cursor: pointer;
        font-size: 13px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        color: #333;
        min-width: 80px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        line-height: 1;
      `;
      cancelBtn.onmouseenter = () => {
        cancelBtn.style.background = "linear-gradient(to bottom, #e8e8e8, #d8d8d8)";
      };
      cancelBtn.onmouseleave = () => {
        cancelBtn.style.background = "linear-gradient(to bottom, #f8f8f8, #e8e8e8)";
      };
      cancelBtn.onclick = () => {
        cleanup();
        resolve(null);
      };
      buttons.appendChild(cancelBtn);

      // OK button
      const okBtn = doc.createElement("button");
      okBtn.textContent = hasExistingText ? "Redo OCR" : "Add OCR";
      okBtn.style.cssText = `
        padding: 8px 16px;
        border: 1px solid #0055aa;
        border-radius: 6px;
        background: linear-gradient(to bottom, #0077dd, #0055aa);
        color: white;
        cursor: pointer;
        font-size: 13px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-weight: 500;
        min-width: 80px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        line-height: 1;
      `;
      okBtn.onmouseenter = () => {
        okBtn.style.background = "linear-gradient(to bottom, #0066cc, #004499)";
      };
      okBtn.onmouseleave = () => {
        okBtn.style.background = "linear-gradient(to bottom, #0077dd, #0055aa)";
      };
      okBtn.onclick = () => {
        const selectedLangs = langChecks
          .filter(check => check.checked)
          .map(check => check.value);
        const ocrLangs = selectedLangs.length > 0 ? selectedLangs.join("+") : "eng";

        const result = {
          languages: ocrLangs,
          compress: compressCheck ? compressCheck.checked : false
        };
        cleanup();
        resolve(result);
      };
      buttons.appendChild(okBtn);

      dialog.appendChild(buttons);
      overlay.appendChild(dialog);
      doc.documentElement.appendChild(overlay);

      okBtn.focus();

      const handleKeydown = (e) => {
        if (e.key === "Escape") {
          cleanup();
          resolve(null);
        } else if (e.key === "Enter") {
          okBtn.click();
        }
      };
      doc.addEventListener("keydown", handleKeydown);

      overlay.onclick = (e) => {
        if (e.target === overlay) {
          cleanup();
          resolve(null);
        }
      };
    });
  }

  async addOcrToExistingPdf(item) {
    // Prevent concurrent operations
    if (this._isProcessing) {
      Services.prompt.alert(
        null,
        "DJVU to PDF Converter",
        "Another operation is already in progress.\n\nPlease wait for it to complete."
      );
      return;
    }

    // Skip items in trash
    if (item.deleted) {
      this.log("Item is in trash, skipping");
      return;
    }

    let filePath;
    try {
      filePath = await item.getFilePathAsync();
    } catch (e) {
      this.log(`Could not get file path: ${e.message}`);
      return;
    }
    if (!filePath) {
      this.log("No file path for attachment");
      return;
    }

    const filename = item.getField("title") || filePath.split("/").pop() || "file.pdf";

    // Check if PDF already has text/OCR
    const hasExistingText = await this.checkPdfHasText(filePath);

    // Show OCR options dialog with language selector
    const options = await this.showOcrOptionsDialog(filename, hasExistingText);

    if (!options) return;

    const shouldCompress = options.compress && this.gsFound;

    // Mark as processing and ensure cleanup with try/finally
    this._isProcessing = true;
    let progress = null;
    const ocrPdfPath = filePath.replace(/\.pdf$/i, "_ocr.pdf");

    try {
      progress = this.showProgress("Adding OCR layer...");
      // Get original size
      let inputSize = 0;
      try {
        inputSize = Zotero.File.pathToFile(filePath).fileSize;
      } catch (e) {}

      // Get page count for progress display
      const pageCount = await this.getPdfPageCount(filePath);
      this.log(`PDF has ${pageCount || "unknown"} pages`);

      // If redoing OCR, use force mode
      const forceOcr = hasExistingText;
      const ocrSuccess = await this.runOcrWithProgress(filePath, ocrPdfPath, progress, forceOcr, options.languages, pageCount);

      if (ocrSuccess && Zotero.File.pathToFile(ocrPdfPath).exists()) {
        // Check if cancelled BEFORE modifying original file
        if (progress.cancelled) {
          try { await IOUtils.remove(ocrPdfPath); } catch (e) {}
          progress.close();
          return;
        }

        // Replace original with OCR version
        await IOUtils.remove(filePath);
        await IOUtils.move(ocrPdfPath, filePath);

        let afterOcrSize = 0;
        try {
          afterOcrSize = Zotero.File.pathToFile(filePath).fileSize;
        } catch (e) {}

        // Compress if requested
        let finalSize = afterOcrSize;
        let wasCompressed = false;

        if (shouldCompress) {
          progress.setProgress(80);
          progress.updateText("Compressing PDF...");

          wasCompressed = await this.compressPdf(filePath, progress);

          // Check if cancelled
          if (progress.cancelled) {
            progress.close();
            return;
          }

          try {
            finalSize = Zotero.File.pathToFile(filePath).fileSize;
          } catch (e) {}
        }

        const formatSize = (bytes) => {
          if (bytes < 1024) return bytes + " B";
          if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
          return (bytes / (1024 * 1024)).toFixed(1) + " MB";
        };

        let sizeInfo = `${formatSize(inputSize)} → OCR: ${formatSize(afterOcrSize)}`;
        if (shouldCompress && wasCompressed) {
          sizeInfo += ` → Compressed: ${formatSize(finalSize)}`;
        }

        progress.finish(true, "Done! " + sizeInfo);
        this.log("OCR added successfully");
      } else {
        throw new Error("OCR output file not created");
      }
    } catch (e) {
      this.log(`OCR failed: ${e.message}`);

      // If cancelled, close silently
      if ((progress && progress.cancelled) || e.message.includes("Cancelled")) {
        try { await IOUtils.remove(ocrPdfPath); } catch (err) {}
        if (progress) progress.close();
        return;
      }

      if (progress) progress.finish(false, "OCR failed");

      Services.prompt.alert(
        null,
        "OCR Failed",
        `Failed to add OCR layer:\n\n${e.message}`
      );
    } finally {
      this._isProcessing = false;
    }
  }

  async compressExistingPdf(item) {
    // Prevent concurrent operations
    if (this._isProcessing) {
      Services.prompt.alert(
        null,
        "DJVU to PDF Converter",
        "Another operation is already in progress.\n\nPlease wait for it to complete."
      );
      return;
    }

    // Skip items in trash
    if (item.deleted) {
      this.log("Item is in trash, skipping");
      return;
    }

    let filePath;
    try {
      filePath = await item.getFilePathAsync();
    } catch (e) {
      this.log(`Could not get file path: ${e.message}`);
      return;
    }
    if (!filePath) {
      this.log("No file path for attachment");
      return;
    }

    const filename = item.getField("title") || filePath.split("/").pop();

    // Get original size
    let inputSize = 0;
    try {
      inputSize = Zotero.File.pathToFile(filePath).fileSize;
    } catch (e) {}

    const formatSize = (bytes) => {
      if (bytes < 1024) return bytes + " B";
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
      return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    };

    // Confirm with user
    const confirm = Services.prompt.confirm(
      null,
      "Compress PDF",
      `Compress "${filename}" (${formatSize(inputSize)})?\n\nThis will reduce file size but may slightly reduce quality.`
    );

    if (!confirm) return;

    // Mark as processing and ensure cleanup with try/finally
    this._isProcessing = true;
    let progress = null;

    try {
      progress = this.showProgress("Compressing PDF...");
      progress.setProgress(20);

      const compressed = await this.compressPdf(filePath, progress);

      // Check if cancelled
      if (progress.cancelled) {
        progress.close();
        return;
      }

      // Get new size
      let outputSize = 0;
      try {
        outputSize = Zotero.File.pathToFile(filePath).fileSize;
      } catch (e) {}

      if (compressed) {
        const savings = Math.round((1 - outputSize / inputSize) * 100);
        const sizeInfo = `${formatSize(inputSize)} → ${formatSize(outputSize)} (${savings}% smaller)`;
        progress.finish(true, "Compressed! " + sizeInfo);
        this.log("PDF compressed successfully");
      } else {
        progress.finish(true, "No compression needed - file already optimized");
        this.log("Compression skipped - no size reduction");
      }
    } catch (e) {
      this.log(`Compression failed: ${e.message}`);

      // If cancelled, close silently
      if (progress && progress.cancelled) {
        progress.close();
        return;
      }

      if (progress) progress.finish(false, "Compression failed");

      Services.prompt.alert(
        null,
        "Compression Failed",
        `Failed to compress PDF:\n\n${e.message}`
      );
    } finally {
      this._isProcessing = false;
    }
  }

  registerNotifier() {
    if (this.notifierID) {
      this.log("Notifier already registered");
      return;
    }

    const self = this;

    const callback = {
      notify: async function (event, type, ids, extraData) {
        self.log(`Notifier triggered: event=${event}, type=${type}, ids=${JSON.stringify(ids)}`);

        if (event === "add" && type === "item") {
          for (const id of ids) {
            await Zotero.Promise.delay(500);
            await self.handleItemAdded(id);
          }
        }
      },
    };

    this.notifierID = Zotero.Notifier.registerObserver(callback, ["item"], "djvuConverter");
    this.log(`Notifier registered with ID: ${this.notifierID}`);
  }

  async handleItemAdded(id) {
    try {
      this.log(`Checking item ID: ${id}`);

      const item = await Zotero.Items.getAsync(id);
      if (!item) {
        this.log(`Item ${id} not found`);
        return;
      }

      // Skip items in trash
      if (item.deleted) {
        this.log(`Item ${id} is in trash, skipping`);
        return;
      }

      this.log(`Item type: ${item.itemType}, isAttachment: ${item.isAttachment()}`);

      if (!item.isAttachment()) {
        this.log("Not an attachment, skipping");
        return;
      }

      await this.processAttachment(item);
    } catch (e) {
      this.log(`Error processing item ${id}: ${e.message}\n${e.stack}`);
    }
  }

  showOptionsDialog(filename) {
    const self = this;
    return new Promise((resolve) => {
      const win = Zotero.getMainWindow();
      if (!win) {
        self.log("No main window found");
        resolve(null);
        return;
      }
      const doc = win.document;

      // Remove any existing dialog
      const existing = doc.getElementById("djvu-options-dialog");
      if (existing) existing.remove();

      // Create overlay
      const overlay = doc.createElement("div");
      overlay.id = "djvu-options-dialog";
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      `;

      // Create dialog box
      const dialog = doc.createElement("div");
      dialog.style.cssText = `
        background: white;
        border-radius: 8px;
        padding: 20px;
        min-width: 350px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        color: #333;
      `;

      // Title
      const title = doc.createElement("div");
      title.textContent = "DJVU to PDF Converter";
      title.style.cssText = "font-size: 16px; font-weight: bold; margin-bottom: 15px;";
      dialog.appendChild(title);

      // Filename
      const filenameDiv = doc.createElement("div");
      filenameDiv.textContent = `Convert "${self.truncateFilename(filename)}" to PDF?`;
      filenameDiv.style.cssText = "margin-bottom: 20px; color: #666;";
      dialog.appendChild(filenameDiv);

      // Options label
      const optLabel = doc.createElement("div");
      optLabel.textContent = "Options:";
      optLabel.style.cssText = "font-weight: 500; margin-bottom: 10px;";
      dialog.appendChild(optLabel);

      // OCR checkbox
      const ocrLabel = doc.createElement("label");
      ocrLabel.style.cssText = "display: flex; align-items: center; margin-bottom: 8px; cursor: pointer;";
      const ocrCheck = doc.createElement("input");
      ocrCheck.type = "checkbox";
      ocrCheck.id = "djvu-ocr";
      ocrCheck.style.cssText = "margin-right: 8px; width: 16px; height: 16px;";
      ocrLabel.appendChild(ocrCheck);
      ocrLabel.appendChild(doc.createTextNode("Add OCR text layer (makes PDF searchable)"));
      dialog.appendChild(ocrLabel);

      // OCR Languages container (hidden initially)
      const langContainer = doc.createElement("div");
      langContainer.id = "djvu-lang-container";
      langContainer.style.cssText = "margin-left: 24px; margin-bottom: 12px; display: none;";

      const langLabel = doc.createElement("div");
      langLabel.textContent = "OCR Languages:";
      langLabel.style.cssText = "font-size: 12px; color: #666; margin-bottom: 6px;";
      langContainer.appendChild(langLabel);

      // Language checkboxes in a grid
      const langGrid = doc.createElement("div");
      langGrid.style.cssText = "display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px 12px;";

      const languages = [
        { code: "eng", name: "English" },
        { code: "rus", name: "Russian" },
        { code: "deu", name: "German" },
        { code: "fra", name: "French" },
        { code: "spa", name: "Spanish" },
        { code: "ita", name: "Italian" },
        { code: "por", name: "Portuguese" },
        { code: "chi_sim", name: "Chinese (S)" },
        { code: "jpn", name: "Japanese" },
        { code: "kor", name: "Korean" },
        { code: "ara", name: "Arabic" },
        { code: "ukr", name: "Ukrainian" }
      ];

      // Store language checkboxes
      const langChecks = [];

      for (const lang of languages) {
        const langOption = doc.createElement("label");
        langOption.style.cssText = "display: flex; align-items: center; cursor: pointer; font-size: 12px;";
        const check = doc.createElement("input");
        check.type = "checkbox";
        check.value = lang.code;
        check.style.cssText = "margin-right: 4px; width: 14px; height: 14px;";
        // Default: English checked
        if (lang.code === "eng") {
          check.checked = true;
        }
        langOption.appendChild(check);
        langOption.appendChild(doc.createTextNode(lang.name));
        langGrid.appendChild(langOption);
        langChecks.push(check);
      }

      langContainer.appendChild(langGrid);
      dialog.appendChild(langContainer);

      // Show/hide language selector based on OCR checkbox
      ocrCheck.addEventListener("change", () => {
        langContainer.style.display = ocrCheck.checked ? "block" : "none";
      });
      ocrCheck.addEventListener("click", () => {
        // Also handle click for immediate feedback
        setTimeout(() => {
          langContainer.style.display = ocrCheck.checked ? "block" : "none";
        }, 0);
      });

      // Compress checkbox
      const compressLabel = doc.createElement("label");
      compressLabel.style.cssText = "display: flex; align-items: center; margin-bottom: 20px; cursor: pointer;";
      const compressCheck = doc.createElement("input");
      compressCheck.type = "checkbox";
      compressCheck.id = "djvu-compress";
      compressCheck.checked = true;
      compressCheck.style.cssText = "margin-right: 8px; width: 16px; height: 16px;";
      compressLabel.appendChild(compressCheck);
      compressLabel.appendChild(doc.createTextNode("Compress PDF (smaller file size)"));
      dialog.appendChild(compressLabel);

      // After conversion label
      const afterLabel = doc.createElement("div");
      afterLabel.textContent = "After conversion:";
      afterLabel.style.cssText = "font-weight: 500; margin-bottom: 10px;";
      dialog.appendChild(afterLabel);

      // Replace radio
      const replaceLabel = doc.createElement("label");
      replaceLabel.style.cssText = "display: flex; align-items: center; margin-bottom: 8px; cursor: pointer;";
      const replaceRadio = doc.createElement("input");
      replaceRadio.type = "radio";
      replaceRadio.name = "djvu-action";
      replaceRadio.value = "replace";
      replaceRadio.checked = true;
      replaceRadio.style.cssText = "margin-right: 8px; width: 16px; height: 16px;";
      replaceLabel.appendChild(replaceRadio);
      replaceLabel.appendChild(doc.createTextNode("Replace DJVU with PDF"));
      dialog.appendChild(replaceLabel);

      // Keep radio
      const keepLabel = doc.createElement("label");
      keepLabel.style.cssText = "display: flex; align-items: center; margin-bottom: 20px; cursor: pointer;";
      const keepRadio = doc.createElement("input");
      keepRadio.type = "radio";
      keepRadio.name = "djvu-action";
      keepRadio.value = "keep";
      keepRadio.style.cssText = "margin-right: 8px; width: 16px; height: 16px;";
      keepLabel.appendChild(keepRadio);
      keepLabel.appendChild(doc.createTextNode("Keep both files"));
      dialog.appendChild(keepLabel);

      // Buttons container
      const buttons = doc.createElement("div");
      buttons.style.cssText = "display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px;";

      // Cleanup function
      const cleanup = () => {
        doc.removeEventListener("keydown", handleKeydown);
        if (overlay.parentNode) {
          overlay.remove();
        }
      };

      // Cancel button
      const cancelBtn = doc.createElement("button");
      cancelBtn.textContent = "Cancel";
      cancelBtn.style.cssText = `
        padding: 8px 16px;
        border: 1px solid #888;
        border-radius: 6px;
        background: linear-gradient(to bottom, #f8f8f8, #e8e8e8);
        cursor: pointer;
        font-size: 13px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        color: #333;
        min-width: 80px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        line-height: 1;
      `;
      cancelBtn.onmouseenter = () => {
        cancelBtn.style.background = "linear-gradient(to bottom, #e8e8e8, #d8d8d8)";
      };
      cancelBtn.onmouseleave = () => {
        cancelBtn.style.background = "linear-gradient(to bottom, #f8f8f8, #e8e8e8)";
      };
      cancelBtn.onclick = () => {
        cleanup();
        resolve(null);
      };
      buttons.appendChild(cancelBtn);

      // Convert button
      const convertBtn = doc.createElement("button");
      convertBtn.textContent = "Convert";
      convertBtn.style.cssText = `
        padding: 8px 16px;
        border: 1px solid #0055aa;
        border-radius: 6px;
        background: linear-gradient(to bottom, #0077dd, #0055aa);
        color: white;
        cursor: pointer;
        font-size: 13px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-weight: 500;
        min-width: 80px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        line-height: 1;
      `;
      convertBtn.onmouseenter = () => {
        convertBtn.style.background = "linear-gradient(to bottom, #0066cc, #004499)";
      };
      convertBtn.onmouseleave = () => {
        convertBtn.style.background = "linear-gradient(to bottom, #0077dd, #0055aa)";
      };
      convertBtn.onclick = () => {
        // Collect selected languages
        const selectedLangs = langChecks
          .filter(check => check.checked)
          .map(check => check.value);
        // Default to English if none selected
        const ocrLangs = selectedLangs.length > 0 ? selectedLangs.join("+") : "eng";

        const result = {
          addOcr: ocrCheck.checked,
          compress: compressCheck.checked,
          deleteOriginal: replaceRadio.checked,
          ocrLanguages: ocrLangs
        };
        cleanup();
        resolve(result);
      };
      buttons.appendChild(convertBtn);

      dialog.appendChild(buttons);
      overlay.appendChild(dialog);
      doc.documentElement.appendChild(overlay);

      // Focus the convert button
      convertBtn.focus();

      // Handle Escape key
      const handleKeydown = (e) => {
        if (e.key === "Escape") {
          cleanup();
          resolve(null);
        } else if (e.key === "Enter") {
          convertBtn.click();
        }
      };
      doc.addEventListener("keydown", handleKeydown);

      // Close on overlay click (outside dialog)
      overlay.onclick = (e) => {
        if (e.target === overlay) {
          cleanup();
          resolve(null);
        }
      };
    });
  }

  showProgress(message) {
    const self = this;
    const win = Zotero.getMainWindow();
    if (!win) {
      // Fallback to simple progress window without cancel
      const progressWin = new Zotero.ProgressWindow({ closeOnClick: false });
      progressWin.changeHeadline("DJVU to PDF Converter");
      const icon = "chrome://zotero/skin/treeitem-attachment-pdf.png";
      const progress = new progressWin.ItemProgress(icon, message);
      progressWin.show();
      return {
        cancelled: false,
        updateText: (text) => progress.setText(text),
        setProgress: (percent) => progress.setProgress(percent),
        finish: (success, msg) => {
          if (success) {
            progress.setProgress(100);
            progress.setText(msg || "Done!");
          } else {
            progress.setError();
            progress.setText(msg || "Failed");
          }
          progressWin.startCloseTimer(4000);
        }
      };
    }

    const doc = win.document;

    // Remove any existing progress dialog
    const existing = doc.getElementById("djvu-progress-dialog");
    if (existing) existing.remove();

    // Create overlay
    const overlay = doc.createElement("div");
    overlay.id = "djvu-progress-dialog";
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;

    // Create dialog box
    const dialog = doc.createElement("div");
    dialog.style.cssText = `
      background: white;
      border-radius: 8px;
      padding: 20px;
      min-width: 320px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #333;
    `;

    // Title
    const title = doc.createElement("div");
    title.textContent = "DJVU to PDF Converter";
    title.style.cssText = "font-size: 16px; font-weight: bold; margin-bottom: 15px;";
    dialog.appendChild(title);

    // Status text
    const statusText = doc.createElement("div");
    statusText.textContent = message;
    statusText.style.cssText = "margin-bottom: 16px; color: #666; min-height: 20px;";
    dialog.appendChild(statusText);

    // Cancel button
    const cancelBtn = doc.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.style.cssText = `
      display: flex;
      width: 100%;
      padding: 10px 16px;
      border: 1px solid #cc0000;
      border-radius: 6px;
      background: linear-gradient(to bottom, #ff4444, #cc0000);
      color: white;
      cursor: pointer;
      font-size: 13px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-weight: 500;
      align-items: center;
      justify-content: center;
      line-height: 1;
    `;
    cancelBtn.onmouseenter = () => {
      cancelBtn.style.background = "linear-gradient(to bottom, #ee3333, #aa0000)";
    };
    cancelBtn.onmouseleave = () => {
      cancelBtn.style.background = "linear-gradient(to bottom, #ff4444, #cc0000)";
    };
    dialog.appendChild(cancelBtn);

    overlay.appendChild(dialog);
    doc.documentElement.appendChild(overlay);

    // Progress controller object
    const controller = {
      cancelled: false,
      finished: false,
      overlay: overlay,
      updateText: (text) => {
        if (!controller.cancelled && !controller.finished) {
          statusText.textContent = text;
        }
      },
      // Keep setProgress as no-op for backward compatibility
      setProgress: (percent) => {},
      finish: (success, msg) => {
        if (controller.cancelled) return;

        controller.finished = true;
        statusText.textContent = msg || (success ? "Done!" : "Failed");
        statusText.style.color = success ? "#00aa00" : "#cc0000";

        cancelBtn.textContent = "Close";
        cancelBtn.style.background = "linear-gradient(to bottom, #f8f8f8, #e8e8e8)";
        cancelBtn.style.border = "1px solid #888";
        cancelBtn.style.color = "#333";
        cancelBtn.onmouseenter = () => {
          cancelBtn.style.background = "linear-gradient(to bottom, #e8e8e8, #d8d8d8)";
        };
        cancelBtn.onmouseleave = () => {
          cancelBtn.style.background = "linear-gradient(to bottom, #f8f8f8, #e8e8e8)";
        };
      },
      close: () => {
        if (overlay.parentNode) {
          overlay.remove();
        }
      }
    };

    // Cancel button handler
    cancelBtn.onclick = () => {
      if (controller.cancelled || controller.finished) {
        // Already cancelled or finished, just close
        overlay.remove();
        return;
      }
      controller.cancelled = true;
      statusText.textContent = "Cancelling...";
      // Don't fully disable - allow clicking again to force close
      cancelBtn.style.opacity = "0.7";
      cancelBtn.style.cursor = "pointer";
      self.log("User cancelled operation");
    };

    return controller;
  }

  async processAttachment(item) {
    // Prevent concurrent conversions
    if (this._isProcessing) {
      Services.prompt.alert(
        null,
        "DJVU to PDF Converter",
        "Another conversion is already in progress.\n\nPlease wait for it to complete."
      );
      return;
    }

    // Skip items in trash
    if (item.deleted) {
      this.log("Item is in trash, skipping");
      return;
    }

    let filePath;
    try {
      filePath = await item.getFilePathAsync();
    } catch (e) {
      this.log(`Could not get file path: ${e.message}`);
      return;
    }

    if (!filePath) {
      this.log("No file path for attachment");
      return;
    }

    this.log(`Attachment file path: ${filePath}`);

    // Check if it's a DJVU file
    const lowerPath = filePath.toLowerCase();
    if (!lowerPath.endsWith(".djvu") && !lowerPath.endsWith(".djv")) {
      this.log("Not a DJVU file, skipping");
      return;
    }

    const filename = item.getField("title") || filePath.split("/").pop() || "file.djvu";
    this.log(`DJVU file detected: ${filename}`);

    // Check if ddjvu is available
    if (!this.ddjvuFound) {
      Services.prompt.alert(
        null,
        "DJVU to PDF Converter - Error",
        "Cannot convert: ddjvu (djvulibre) is not installed.\n\n" +
        "Please install it with:\n" +
        "  brew install djvulibre\n\n" +
        "Then restart Zotero."
      );
      return;
    }

    // Show options dialog
    const options = await this.showOptionsDialog(filename);

    if (!options) {
      this.log("User cancelled conversion");
      return;
    }

    // Warn if OCR requested but dependencies not available
    if (options.addOcr && (!this.ocrmypdfFound || !this.tesseractFound)) {
      let missingDeps = [];
      if (!this.ocrmypdfFound) missingDeps.push("ocrmypdf");
      if (!this.tesseractFound) missingDeps.push("tesseract");

      const continueWithoutOcr = Services.prompt.confirm(
        null,
        "DJVU to PDF Converter - Warning",
        `OCR dependencies missing: ${missingDeps.join(", ")}\n\n` +
        "To enable OCR, install with:\n" +
        "  brew install ocrmypdf tesseract tesseract-lang\n\n" +
        "Continue conversion without OCR?"
      );
      if (!continueWithoutOcr) {
        return;
      }
      options.addOcr = false;
    }

    this.log(`Options: OCR=${options.addOcr}, compress=${options.compress}, deleteOriginal=${options.deleteOriginal}`);

    // Mark as processing and ensure cleanup with try/finally
    this._isProcessing = true;
    let progress = null;

    // Helper to get file size
    const getSize = (path) => {
      try {
        return Zotero.File.pathToFile(path).fileSize;
      } catch (e) {
        return 0;
      }
    };

    // Helper to format size
    const formatSize = (bytes) => {
      if (bytes < 1024) return bytes + " B";
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
      return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    };

    // Track sizes at each stage
    const sizes = {
      original: getSize(filePath),
      afterConversion: 0,
      afterOcr: 0,
      afterCompression: 0,
      final: 0
    };

    try {
      // Show progress window
      progress = this.showProgress("Starting conversion...");

      // Step 1: Convert DJVU to PDF
      const tempPdfPath = filePath.replace(/\.(djvu|djv)$/i, ".pdf");

      this.log(`Converting: ${filePath} -> ${tempPdfPath}`);

      // Run DJVU conversion with progress
      await this.runDdjvuWithProgress(filePath, tempPdfPath, progress);

      // Check if output file exists
      let outputExists = false;
      try {
        outputExists = Zotero.File.pathToFile(tempPdfPath).exists();
      } catch (e) {
        this.log(`Error checking output file: ${e.message}`);
      }

      if (!outputExists) {
        throw new Error(
          "DJVU to PDF conversion failed.\n\n" +
          "The output file was not created. Possible causes:\n" +
          "- Corrupted DJVU file\n" +
          "- Insufficient disk space\n" +
          "- Permission issues"
        );
      }

      sizes.afterConversion = getSize(tempPdfPath);
      this.log(`Size after conversion: ${formatSize(sizes.afterConversion)}`);

      // Check if cancelled after conversion
      if (progress.cancelled) {
        this.log("Conversion cancelled after DJVU to PDF step");
        try { await IOUtils.remove(tempPdfPath); } catch (e) {}
        progress.close();
        return;
      }

      let finalPdfPath = tempPdfPath;

      // Step 2: Add OCR if requested
      if (options.addOcr) {
        sizes.afterOcr = sizes.afterConversion; // Default in case OCR fails

        const ocrPdfPath = tempPdfPath.replace(/\.pdf$/i, "_ocr.pdf");

        // Get page count for progress display
        const pageCount = await this.getPdfPageCount(tempPdfPath);
        this.log(`PDF has ${pageCount || "unknown"} pages`);

        this.log(`Running OCR: ${tempPdfPath} -> ${ocrPdfPath}`);

        try {
          // Run OCR via shell with progress updates
          const ocrSuccess = await this.runOcrWithProgress(tempPdfPath, ocrPdfPath, progress, false, options.ocrLanguages || "eng", pageCount);

          if (ocrSuccess && Zotero.File.pathToFile(ocrPdfPath).exists()) {
            // Delete the non-OCR version and use OCR version
            await IOUtils.remove(tempPdfPath);
            await IOUtils.move(ocrPdfPath, tempPdfPath);
            sizes.afterOcr = getSize(tempPdfPath);
            this.log(`OCR completed successfully. Size after OCR: ${formatSize(sizes.afterOcr)}`);
          } else {
            sizes.afterOcr = sizes.afterConversion;
            this.log("OCR output not found, using non-OCR version");
          }
        } catch (ocrError) {
          this.log(`OCR failed: ${ocrError.message}`);

          // Check if cancelled
          if (ocrError.message.includes("Cancelled by user") || progress.cancelled) {
            this.log("OCR was cancelled by user");
            try { await IOUtils.remove(tempPdfPath); } catch (e) {}
            try { await IOUtils.remove(ocrPdfPath); } catch (e) {}
            progress.close();
            return;
          }

          // Show OCR error but continue with non-OCR PDF
          let ocrErrorMsg;
          if (ocrError.message.includes("timeout")) {
            ocrErrorMsg = "OCR timed out (file too large)";
          } else {
            // Truncate long messages
            ocrErrorMsg = ocrError.message.substring(0, 100);
          }
          progress.updateText("OCR failed - continuing without OCR");

          // Log full error for debugging
          this.log(`Full OCR error: ${ocrError.message}`);

          // Show simple alert
          Services.prompt.alert(
            null,
            "OCR Failed",
            "OCR processing failed.\n\n" +
            "Reason: " + ocrErrorMsg + "\n\n" +
            "PDF will be created without searchable text."
          );
        }
      }

      // If no OCR, set afterOcr to afterConversion for consistency
      if (!options.addOcr) {
        sizes.afterOcr = sizes.afterConversion;
      }

      // Get size before compression (after OCR or after conversion)
      const sizeBeforeCompression = sizes.afterOcr || sizes.afterConversion;

      // Step 3: Compress PDF if requested
      if (options.compress && this.gsFound) {
        progress.setProgress(80);
        progress.updateText("Compressing PDF...");

        const compressed = await this.compressPdf(finalPdfPath, progress);

        // Check if cancelled during compression
        if (progress.cancelled) {
          this.log("Conversion cancelled during compression");
          try { await IOUtils.remove(finalPdfPath); } catch (e) {}
          progress.close();
          return;
        }

        sizes.afterCompression = getSize(finalPdfPath);
        if (compressed) {
          this.log(`PDF compression completed. Size after compression: ${formatSize(sizes.afterCompression)}`);
        } else {
          this.log("PDF compression skipped (no size reduction)");
        }
      } else if (options.compress && !this.gsFound) {
        sizes.afterCompression = sizeBeforeCompression;
        this.log("Compression requested but ghostscript not found");
      } else {
        sizes.afterCompression = sizeBeforeCompression;
      }

      // Final cancellation check before updating library
      if (progress.cancelled) {
        this.log("Conversion cancelled before library update");
        try { await IOUtils.remove(finalPdfPath); } catch (e) {}
        progress.close();
        return;
      }

      // Get final size BEFORE moving file
      sizes.final = getSize(finalPdfPath);

      progress.setProgress(90);
      progress.updateText("Updating Zotero library...");

      // Step 4: Handle the converted file
      // Check if item still exists and is not in trash
      try {
        const itemStillExists = await Zotero.Items.getAsync(item.id);
        if (!itemStillExists) {
          throw new Error("Item was deleted during conversion");
        }
        if (itemStillExists.deleted) {
          throw new Error("Item was moved to trash during conversion");
        }
      } catch (e) {
        this.log(`Item check failed: ${e.message}`);
        // Item might have been deleted or trashed, save PDF to temp location and notify user
        const tempDir = Zotero.getTempDirectory().path;
        const tempDest = PathUtils.join(tempDir, "converted_" + Date.now() + ".pdf");
        await IOUtils.move(finalPdfPath, tempDest);
        throw new Error(`Original item was deleted or moved to trash during conversion.\n\nThe converted PDF was saved to:\n${tempDest}`);
      }

      if (options.deleteOriginal) {
        await this.replaceAttachment(item, finalPdfPath);
        this.log("Replaced DJVU with PDF");
      } else {
        await this.addPDFSibling(item, finalPdfPath);
        this.log("Added PDF as sibling attachment");
      }

      // Build size info string
      let sizeInfo = `DJVU: ${formatSize(sizes.original)}`;
      sizeInfo += ` → PDF: ${formatSize(sizes.afterConversion)}`;

      if (options.addOcr) {
        sizeInfo += ` → OCR: ${formatSize(sizes.afterOcr)}`;
      }

      if (options.compress && this.gsFound) {
        sizeInfo += ` → Compressed: ${formatSize(sizes.final)}`;
      }

      progress.finish(true, "Done! " + sizeInfo);
      this.log(`Conversion completed: ${sizeInfo}`);

    } catch (e) {
      this.log(`Conversion failed: ${e.message}\n${e.stack}`);

      // Clean up any temp files
      const tempPdfPath = filePath.replace(/\.(djvu|djv)$/i, ".pdf");
      const ocrPdfPath = tempPdfPath.replace(/\.pdf$/i, "_ocr.pdf");
      const compressedPath = tempPdfPath.replace(/\.pdf$/i, "_compressed.pdf");

      for (const tempFile of [tempPdfPath, ocrPdfPath, compressedPath]) {
        try {
          if (Zotero.File.pathToFile(tempFile).exists()) {
            await IOUtils.remove(tempFile);
            this.log(`Cleaned up temp file: ${tempFile}`);
          }
        } catch (cleanupErr) {
          // Ignore cleanup errors
        }
      }

      // If cancelled, just close silently
      if ((progress && progress.cancelled) || e.message.includes("Cancelled")) {
        if (progress) progress.close();
        return;
      }

      // Show detailed error in progress window
      if (progress) progress.finish(false, "Conversion failed");

      // Show detailed error dialog
      Services.prompt.alert(
        null,
        "DJVU to PDF Converter - Error",
        `Conversion failed:\n\n${e.message}`
      );
    } finally {
      this._isProcessing = false;
    }
  }

  async replaceAttachment(item, pdfPath) {
    // Get the storage directory for this attachment
    const storageDir = Zotero.Attachments.getStorageDirectory(item);
    const storagePath = storageDir.path;

    // Get original file path and new PDF filename
    const originalPath = await item.getFilePathAsync();
    const originalFilename = originalPath.split("/").pop();
    const pdfFilename = originalFilename.replace(/\.(djvu|djv)$/i, ".pdf");
    const destPath = PathUtils.join(storagePath, pdfFilename);

    this.log(`Storage dir: ${storagePath}`);
    this.log(`Moving PDF from ${pdfPath} to ${destPath}`);

    // Delete the original DJVU file
    let originalDeleted = false;
    try {
      await IOUtils.remove(originalPath);
      this.log("Deleted original DJVU file");
      originalDeleted = true;
    } catch (e) {
      this.log(`Could not delete original: ${e.message}`);
      // If we can't delete the original, we should still proceed but warn
      // The original file will remain as an orphan
    }

    // Move the PDF to the storage directory
    try {
      await IOUtils.move(pdfPath, destPath);
      this.log("Moved PDF to storage");
    } catch (e) {
      this.log(`Move failed, trying copy: ${e.message}`);
      try {
        await IOUtils.copy(pdfPath, destPath);
        await IOUtils.remove(pdfPath);
      } catch (copyError) {
        // If copy also fails and original wasn't deleted, we're in trouble
        if (!originalDeleted) {
          throw new Error(`Failed to replace attachment: could not delete original (${e.message}) or copy new file (${copyError.message})`);
        }
        throw copyError;
      }
    }

    // Update the attachment item to point to the PDF
    item.attachmentFilename = pdfFilename;
    item.attachmentContentType = "application/pdf";

    // Update title if it was the filename
    const currentTitle = item.getField("title");
    if (currentTitle === originalFilename || currentTitle.endsWith(".djvu") || currentTitle.endsWith(".djv")) {
      item.setField("title", pdfFilename);
    }

    await item.saveTx();
    this.log("Updated attachment to point to PDF");
  }

  async runOcrWithProgress(inputPath, outputPath, progress, forceOcr = false, languages = "eng", pageCount = null) {
    const self = this;

    return new Promise((resolve, reject) => {
      self.log("Starting OCR process...");
      self.log(`OCR languages: ${languages}, pages: ${pageCount || "unknown"}`);

      // Build the shell command with error capture
      // -O 1 = fast optimization
      // --skip-text = skip pages with text (normal mode)
      // --force-ocr = redo OCR even if text exists (force mode)
      // --verbose = output progress info for page tracking
      // Set PATH to include Homebrew so tesseract can be found
      const errorLogFile = outputPath + ".log";
      const pidFile = outputPath + ".pid";
      const pathExport = 'export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH";';

      // Escape paths for shell
      const escapedInput = self.escapeShellPath(inputPath);
      const escapedOutput = self.escapeShellPath(outputPath);
      const escapedLogFile = self.escapeShellPath(errorLogFile);
      const escapedPidFile = self.escapeShellPath(pidFile);

      // Validate language string (only allow alphanumeric, underscore, plus)
      let safeLangs = languages.replace(/[^a-zA-Z0-9_+]/g, '');
      // Fallback to English if empty after sanitization
      if (!safeLangs || safeLangs === '+') {
        safeLangs = 'eng';
      }

      // Use --force-ocr to redo OCR, or --skip-text to skip existing text
      // Use --verbose to get page-by-page progress in log
      const ocrMode = forceOcr ? "--force-ocr" : "--skip-text";
      const cmd = `${pathExport} "${self.ocrmypdfPath}" -O 1 ${ocrMode} --skip-big 50 --tesseract-timeout 180 --verbose -l ${safeLangs} "${escapedInput}" "${escapedOutput}" 2>"${escapedLogFile}"`;

      self.log(`OCR command: ${cmd}`);

      // Create a marker file to track completion
      const markerFile = outputPath + ".done";
      const errorFile = outputPath + ".error";
      const escapedMarker = self.escapeShellPath(markerFile);
      const escapedError = self.escapeShellPath(errorFile);

      // Run OCR in background via shell, saving PID for cancellation
      // The subshell runs the command and we capture its PID
      const fullCmd = `(${cmd} && touch "${escapedMarker}") || (touch "${escapedError}") & echo $! > "${escapedPidFile}"`;

      // Start the background process (non-blocking)
      Zotero.Utilities.Internal.exec("/bin/sh", ["-c", fullCmd]).catch(e => {
        self.log(`OCR background start error: ${e.message}`);
      });

      // Helper to kill process by PID
      const killProcess = async () => {
        try {
          const pidContent = await Zotero.File.getContentsAsync(pidFile);
          const pid = parseInt(pidContent.trim(), 10);
          if (pid > 0) {
            self.log(`Killing OCR process with PID: ${pid}`);
            // Kill the process group to ensure child processes are also killed
            await Zotero.Utilities.Internal.exec("/bin/sh", ["-c", `kill -TERM -${pid} 2>/dev/null || kill -TERM ${pid} 2>/dev/null || true`]);
            // Also try to kill any ocrmypdf/tesseract processes that might be orphaned
            await Zotero.Utilities.Internal.exec("/bin/sh", ["-c", `pkill -f "ocrmypdf.*${self.escapeShellPath(outputPath)}" 2>/dev/null || true`]);
          }
        } catch (e) {
          self.log(`Could not kill process: ${e.message}`);
        }
        try { await IOUtils.remove(pidFile); } catch (e) {}
      };

      // Poll for completion with progress updates
      const startTime = Date.now();
      const maxWait = 600000; // 10 minutes max

      const checkInterval = setInterval(async () => {
        // Check if cancelled
        if (progress.cancelled) {
          clearInterval(checkInterval);
          // Kill the background process
          await killProcess();
          // Clean up marker files
          try { await IOUtils.remove(markerFile); } catch (e) {}
          try { await IOUtils.remove(errorFile); } catch (e) {}
          try { await IOUtils.remove(errorLogFile); } catch (e) {}
          try { await IOUtils.remove(outputPath); } catch (e) {}
          self.log("OCR cancelled by user");
          reject(new Error("Cancelled by user"));
          return;
        }

        const elapsed = Date.now() - startTime;
        const elapsedSec = Math.floor(elapsed / 1000);

        // Try to parse page progress from log file
        let pageInfo = "";
        try {
          const logContent = await Zotero.File.getContentsAsync(errorLogFile);
          if (logContent) {
            // Look for patterns like "Start processing N" or "page N" in ocrmypdf verbose output
            const pageMatches = logContent.match(/(?:Start processing|page)\s+(\d+)/gi);
            if (pageMatches && pageMatches.length > 0) {
              const lastMatch = pageMatches[pageMatches.length - 1];
              const pageNum = lastMatch.match(/(\d+)/);
              if (pageNum) {
                const currentPage = parseInt(pageNum[1], 10);
                if (pageCount && pageCount > 0) {
                  pageInfo = ` (page ${currentPage}/${pageCount})`;
                } else {
                  pageInfo = ` (page ${currentPage})`;
                }
              }
            }
          }
        } catch (e) {
          // Log file might not exist yet
        }

        progress.updateText(`Running OCR... ${elapsedSec}s${pageInfo}`);

        // Check if done
        let done = false;
        let error = false;

        try {
          done = Zotero.File.pathToFile(markerFile).exists();
        } catch (e) {}

        try {
          error = Zotero.File.pathToFile(errorFile).exists();
        } catch (e) {}

        if (done) {
          clearInterval(checkInterval);
          try { await IOUtils.remove(markerFile); } catch (e) {}
          try { await IOUtils.remove(errorFile); } catch (e) {}
          try { await IOUtils.remove(errorLogFile); } catch (e) {}
          try { await IOUtils.remove(pidFile); } catch (e) {}
          progress.setProgress(79);
          progress.updateText("OCR complete!");
          self.log("OCR completed successfully");
          resolve(true);
        } else if (error) {
          clearInterval(checkInterval);
          // Try to read error log
          let errorMsg = "OCR processing failed";
          try {
            const logContent = await Zotero.File.getContentsAsync(errorLogFile);
            if (logContent && logContent.trim()) {
              // Get last few lines of error
              const lines = logContent.trim().split("\n");
              errorMsg = lines.slice(-3).join(" ").substring(0, 200);
            }
          } catch (e) {}
          try { await IOUtils.remove(errorFile); } catch (e) {}
          try { await IOUtils.remove(errorLogFile); } catch (e) {}
          try { await IOUtils.remove(pidFile); } catch (e) {}
          self.log(`OCR failed: ${errorMsg}`);
          reject(new Error(errorMsg));
        } else if (elapsed >= maxWait) {
          clearInterval(checkInterval);
          // Kill the process on timeout
          await killProcess();
          // Clean up all marker files on timeout
          try { await IOUtils.remove(markerFile); } catch (e) {}
          try { await IOUtils.remove(errorFile); } catch (e) {}
          try { await IOUtils.remove(errorLogFile); } catch (e) {}
          self.log(`OCR timeout after ${elapsedSec} seconds`);
          reject(new Error("OCR timed out after 10 minutes"));
        }
      }, 1000);
    });
  }

  async runDdjvuWithProgress(inputPath, outputPath, progress) {
    const self = this;

    return new Promise((resolve, reject) => {
      self.log("Starting DJVU conversion...");

      const markerFile = outputPath + ".done";
      const errorFile = outputPath + ".error";
      const pidFile = outputPath + ".pid";

      const escapedInput = self.escapeShellPath(inputPath);
      const escapedOutput = self.escapeShellPath(outputPath);
      const escapedMarker = self.escapeShellPath(markerFile);
      const escapedError = self.escapeShellPath(errorFile);
      const escapedPidFile = self.escapeShellPath(pidFile);

      // Run ddjvu in background
      const cmd = `("${self.ddjvuPath}" -format=pdf "${escapedInput}" "${escapedOutput}" && touch "${escapedMarker}") || touch "${escapedError}" & echo $! > "${escapedPidFile}"`;

      Zotero.Utilities.Internal.exec("/bin/sh", ["-c", cmd]).catch(e => {
        self.log(`DJVU background start error: ${e.message}`);
      });

      // Helper to kill process
      const killProcess = async () => {
        try {
          const pidContent = await Zotero.File.getContentsAsync(pidFile);
          const pid = parseInt(pidContent.trim(), 10);
          if (pid > 0) {
            self.log(`Killing DJVU process with PID: ${pid}`);
            await Zotero.Utilities.Internal.exec("/bin/sh", ["-c", `kill -TERM -${pid} 2>/dev/null || kill -TERM ${pid} 2>/dev/null || true`]);
          }
        } catch (e) {}
        try { await IOUtils.remove(pidFile); } catch (e) {}
      };

      const startTime = Date.now();
      const maxWait = 300000; // 5 minutes

      const checkInterval = setInterval(async () => {
        if (progress.cancelled) {
          clearInterval(checkInterval);
          await killProcess();
          try { await IOUtils.remove(markerFile); } catch (e) {}
          try { await IOUtils.remove(errorFile); } catch (e) {}
          try { await IOUtils.remove(outputPath); } catch (e) {}
          self.log("DJVU conversion cancelled");
          reject(new Error("Cancelled by user"));
          return;
        }

        const elapsed = Date.now() - startTime;
        const elapsedSec = Math.floor(elapsed / 1000);
        progress.updateText(`Converting DJVU to PDF... ${elapsedSec}s`);

        let done = false;
        let error = false;

        try { done = Zotero.File.pathToFile(markerFile).exists(); } catch (e) {}
        try { error = Zotero.File.pathToFile(errorFile).exists(); } catch (e) {}

        if (done) {
          clearInterval(checkInterval);
          try { await IOUtils.remove(markerFile); } catch (e) {}
          try { await IOUtils.remove(errorFile); } catch (e) {}
          try { await IOUtils.remove(pidFile); } catch (e) {}
          self.log("DJVU conversion complete");
          resolve(true);
        } else if (error) {
          clearInterval(checkInterval);
          try { await IOUtils.remove(errorFile); } catch (e) {}
          try { await IOUtils.remove(pidFile); } catch (e) {}
          self.log("DJVU conversion failed");
          reject(new Error("DJVU conversion failed - check if file is corrupted"));
        } else if (elapsed >= maxWait) {
          clearInterval(checkInterval);
          await killProcess();
          try { await IOUtils.remove(markerFile); } catch (e) {}
          try { await IOUtils.remove(errorFile); } catch (e) {}
          self.log("DJVU conversion timeout");
          reject(new Error("DJVU conversion timed out"));
        }
      }, 500);
    });
  }

  async compressPdf(inputPath, progress) {
    const self = this;
    const compressedPath = inputPath.replace(/\.pdf$/i, "_compressed.pdf");

    this.log(`Compressing PDF: ${inputPath} -> ${compressedPath}`);

    return new Promise((resolve, reject) => {
      // Ghostscript compression command
      // /ebook = 150 dpi, good balance of quality and size
      // /screen = 72 dpi, smallest but lower quality
      const pathExport = 'export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH";';

      // Escape paths for shell
      const escapedInput = self.escapeShellPath(inputPath);
      const escapedCompressed = self.escapeShellPath(compressedPath);

      const gsCmd = `${pathExport} "${self.gsPath}" -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/ebook -dNOPAUSE -dQUIET -dBATCH -sOutputFile="${escapedCompressed}" "${escapedInput}"`;

      self.log(`GS command: ${gsCmd}`);

      const markerFile = compressedPath + ".done";
      const errorFile = compressedPath + ".error";
      const pidFile = compressedPath + ".pid";
      const escapedMarker = self.escapeShellPath(markerFile);
      const escapedError = self.escapeShellPath(errorFile);
      const escapedPidFile = self.escapeShellPath(pidFile);

      // Run compression in background via shell, saving PID for cancellation
      const fullCmd = `(${gsCmd} && touch "${escapedMarker}") || (touch "${escapedError}") & echo $! > "${escapedPidFile}"`;

      // Start background process
      Zotero.Utilities.Internal.exec("/bin/sh", ["-c", fullCmd]).catch(e => {
        self.log(`GS background start error: ${e.message}`);
      });

      // Helper to kill process by PID
      const killProcess = async () => {
        try {
          const pidContent = await Zotero.File.getContentsAsync(pidFile);
          const pid = parseInt(pidContent.trim(), 10);
          if (pid > 0) {
            self.log(`Killing compression process with PID: ${pid}`);
            await Zotero.Utilities.Internal.exec("/bin/sh", ["-c", `kill -TERM -${pid} 2>/dev/null || kill -TERM ${pid} 2>/dev/null || true`]);
            // Also try to kill any gs processes that might be orphaned
            await Zotero.Utilities.Internal.exec("/bin/sh", ["-c", `pkill -f "gs.*${self.escapeShellPath(compressedPath)}" 2>/dev/null || true`]);
          }
        } catch (e) {
          self.log(`Could not kill process: ${e.message}`);
        }
        try { await IOUtils.remove(pidFile); } catch (e) {}
      };

      // Poll for completion
      const startTime = Date.now();
      const maxWait = 300000; // 5 minutes max

      const checkInterval = setInterval(async () => {
        // Check if cancelled
        if (progress.cancelled) {
          clearInterval(checkInterval);
          // Kill the background process
          await killProcess();
          // Clean up files
          try { await IOUtils.remove(markerFile); } catch (e) {}
          try { await IOUtils.remove(errorFile); } catch (e) {}
          try { await IOUtils.remove(compressedPath); } catch (e) {}
          self.log("Compression cancelled by user");
          resolve(false);
          return;
        }

        const elapsed = Date.now() - startTime;
        const elapsedSec = Math.floor(elapsed / 1000);

        progress.updateText(`Compressing PDF... ${elapsedSec}s`);

        let done = false;
        let error = false;

        try {
          done = Zotero.File.pathToFile(markerFile).exists();
        } catch (e) {}

        try {
          error = Zotero.File.pathToFile(errorFile).exists();
        } catch (e) {}

        if (done) {
          clearInterval(checkInterval);
          try { await IOUtils.remove(markerFile); } catch (e) {}
          try { await IOUtils.remove(errorFile); } catch (e) {}
          try { await IOUtils.remove(pidFile); } catch (e) {}

          // Check if compressed file is smaller
          try {
            const originalSize = Zotero.File.pathToFile(inputPath).fileSize;
            const compressedSize = Zotero.File.pathToFile(compressedPath).fileSize;

            if (compressedSize < originalSize) {
              // Replace original with compressed
              await IOUtils.remove(inputPath);
              await IOUtils.move(compressedPath, inputPath);
              self.log(`Compression saved ${Math.round((1 - compressedSize / originalSize) * 100)}%`);
              resolve(true);
            } else {
              // Keep original, delete compressed
              await IOUtils.remove(compressedPath);
              self.log("Compressed file larger than original, keeping original");
              resolve(false);
            }
          } catch (e) {
            self.log(`Error comparing sizes: ${e.message}`);
            try { await IOUtils.remove(compressedPath); } catch (e) {}
            resolve(false);
          }
        } else if (error) {
          clearInterval(checkInterval);
          try { await IOUtils.remove(errorFile); } catch (e) {}
          try { await IOUtils.remove(compressedPath); } catch (e) {}
          try { await IOUtils.remove(pidFile); } catch (e) {}
          self.log("PDF compression failed");
          resolve(false); // Don't fail the whole process, just skip compression
        } else if (elapsed >= maxWait) {
          clearInterval(checkInterval);
          // Kill the process on timeout
          await killProcess();
          // Clean up marker files on timeout
          try { await IOUtils.remove(markerFile); } catch (e) {}
          try { await IOUtils.remove(errorFile); } catch (e) {}
          try { await IOUtils.remove(compressedPath); } catch (e) {}
          self.log("Compression timeout");
          resolve(false);
        }
      }, 500);
    });
  }

  async addPDFSibling(item, pdfPath) {
    const parentItem = item.parentItem;

    if (parentItem) {
      await Zotero.Attachments.importFromFile({
        file: pdfPath,
        parentItemID: parentItem.id,
      });
      this.log("Added PDF as child of parent item");
    } else {
      await Zotero.Attachments.importFromFile({
        file: pdfPath,
        libraryID: item.libraryID,
      });
      this.log("Added PDF as standalone attachment");
    }

    // Clean up temp PDF
    try {
      await IOUtils.remove(pdfPath);
    } catch (e) {
      this.log(`Could not delete temp PDF: ${e.message}`);
    }
  }
}
