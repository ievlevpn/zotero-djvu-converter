class ZoteroDJVUConverter {
  // Timeouts (in milliseconds)
  static TIMEOUT_OCR = 1800000;          // 30 minutes for OCR
  static TIMEOUT_CONVERSION = 300000;    // 5 minutes for DJVU conversion

  // Polling intervals (in milliseconds)
  static POLL_INTERVAL_FAST = 500;       // For conversion/compression
  static POLL_INTERVAL_SLOW = 1000;      // For OCR (less frequent)

  // OCR settings
  static OCR_SKIP_BIG_MB = 50;           // Skip images larger than 50MB
  static OCR_TESSERACT_TIMEOUT = 180;    // Tesseract timeout per page (seconds)

  // UI settings
  static PROGRESS_CLOSE_DELAY = 4000;    // Auto-close progress after success (ms)
  static MIN_TEXT_CHARS = 50;            // Minimum chars to consider PDF has text

  // Compression level mapping to ocrmypdf -O levels
  // Higher -O = more aggressive compression = smaller files
  static COMPRESSION_LEVELS = {
    "none": 0,     // No optimization
    "light": 1,    // Lossless optimization (best quality)
    "medium": 2,   // Lossy optimization (recommended)
    "maximum": 3   // Aggressive optimization (smallest file)
  };

  // Get ocrmypdf -O level from compression level string
  static getOptimizeLevel(compressLevel) {
    if (!compressLevel || compressLevel === "none") return 0;
    return ZoteroDJVUConverter.COMPRESSION_LEVELS[compressLevel] ?? 1;
  }

  // Common UI styles
  static STYLES = {
    OVERLAY: `
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
    `,
    DIALOG: `
      background: white;
      border-radius: 8px;
      padding: 20px;
      min-width: 350px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #333;
    `,
    TITLE: "font-size: 16px; font-weight: bold; margin-bottom: 15px;",
    LABEL: "font-weight: 500; margin-bottom: 10px;",
    BUTTON_BASE: `
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      min-width: 80px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
    `,
    BUTTON_PRIMARY: `
      border: 1px solid #0055aa;
      background: linear-gradient(to bottom, #0077dd, #0055aa);
      color: white;
      font-weight: 500;
    `,
    BUTTON_SECONDARY: `
      border: 1px solid #888;
      background: linear-gradient(to bottom, #f8f8f8, #e8e8e8);
      color: #333;
    `,
    BUTTON_DANGER: `
      border: 1px solid #cc0000;
      background: linear-gradient(to bottom, #ff4444, #cc0000);
      color: white;
      font-weight: 500;
    `,
    SELECT: "width: 100%; padding: 6px 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px;",
    CHECKBOX: "margin-right: 8px; width: 16px; height: 16px;",
    BUTTONS_CONTAINER: "display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px;"
  };

  // Create modal overlay element
  createOverlay(doc, id) {
    const overlay = doc.createElement("div");
    overlay.id = id;
    overlay.style.cssText = ZoteroDJVUConverter.STYLES.OVERLAY;
    return overlay;
  }

  // Create dialog box element
  createDialog(doc) {
    const dialog = doc.createElement("div");
    dialog.style.cssText = ZoteroDJVUConverter.STYLES.DIALOG;
    return dialog;
  }

  // Create title element
  createTitle(doc, text) {
    const title = doc.createElement("div");
    title.textContent = text;
    title.style.cssText = ZoteroDJVUConverter.STYLES.TITLE;
    return title;
  }

  // Create button element
  createButton(doc, text, isPrimary, onClick) {
    const btn = doc.createElement("button");
    btn.textContent = text;
    const baseStyle = ZoteroDJVUConverter.STYLES.BUTTON_BASE;
    const typeStyle = isPrimary ? ZoteroDJVUConverter.STYLES.BUTTON_PRIMARY : ZoteroDJVUConverter.STYLES.BUTTON_SECONDARY;
    btn.style.cssText = baseStyle + typeStyle;

    // Hover effects
    const hoverBg = isPrimary
      ? "linear-gradient(to bottom, #0066cc, #004499)"
      : "linear-gradient(to bottom, #e8e8e8, #d8d8d8)";
    const normalBg = isPrimary
      ? "linear-gradient(to bottom, #0077dd, #0055aa)"
      : "linear-gradient(to bottom, #f8f8f8, #e8e8e8)";

    btn.onmouseenter = () => { btn.style.background = hoverBg; };
    btn.onmouseleave = () => { btn.style.background = normalBg; };
    btn.onclick = onClick;

    return btn;
  }

  // Create buttons container
  createButtonsContainer(doc) {
    const container = doc.createElement("div");
    container.style.cssText = ZoteroDJVUConverter.STYLES.BUTTONS_CONTAINER;
    return container;
  }

  // Create select dropdown
  createSelect(doc, options = [], defaultValue, disabled = false) {
    const select = doc.createElement("select");
    select.disabled = disabled;
    select.style.cssText = ZoteroDJVUConverter.STYLES.SELECT + (disabled ? " opacity: 0.5;" : "");

    for (const opt of options) {
      const option = doc.createElement("option");
      option.value = opt.value;
      option.textContent = opt.label;
      if (opt.value === defaultValue) option.selected = true;
      select.appendChild(option);
    }

    return select;
  }

  // Create checkbox with label
  createCheckbox(doc, id, labelText, checked = false, disabled = false) {
    const label = doc.createElement("label");
    label.style.cssText = `display: flex; align-items: center; margin-bottom: 8px; cursor: ${disabled ? "default" : "pointer"};`;
    if (disabled) label.style.color = "#999";

    const checkbox = doc.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = id;
    checkbox.checked = checked;
    checkbox.disabled = disabled;
    checkbox.style.cssText = ZoteroDJVUConverter.STYLES.CHECKBOX;

    label.appendChild(checkbox);
    label.appendChild(doc.createTextNode(labelText));

    return { label, checkbox };
  }

  constructor() {
    this.notifierID = null;
    this.ddjvuPath = null;
    this.ocrmypdfPath = null;
    this._menuPopupHandler = null;
    this._isProcessing = false; // Prevent concurrent conversions
    this._searchPaths = null; // Cached search paths
  }

  // Get platform-specific search paths for executables
  getSearchPaths() {
    if (this._searchPaths) return this._searchPaths;

    const os = Services.appinfo.OS; // "Darwin", "Linux", "WINNT"
    const paths = [];

    if (os === "Darwin") {
      // macOS: Homebrew paths (ARM first, then Intel)
      paths.push("/opt/homebrew/bin");
      paths.push("/usr/local/bin");
      paths.push("/usr/bin");
    } else if (os === "Linux") {
      // Linux: Common paths for package managers
      paths.push("/usr/local/bin");
      paths.push("/usr/bin");
      paths.push("/snap/bin"); // Snap packages (Ubuntu)
      paths.push("/home/linuxbrew/.linuxbrew/bin"); // Linuxbrew
      // User's local bin directories
      try {
        const home = Services.dirsvc.get("Home", Ci.nsIFile).path;
        paths.push(PathUtils.join(home, ".local", "bin"));
        paths.push(PathUtils.join(home, "bin"));
      } catch (e) {
        this.log(`Could not get home directory: ${e.message}`);
      }
    } else if (os === "WINNT") {
      // Windows: Common paths (requires tools installed via Chocolatey, Scoop, etc.)
      paths.push("C:\\Program Files\\DjVuLibre");
      paths.push("C:\\Program Files\\Tesseract-OCR");
      try {
        const home = Services.dirsvc.get("Home", Ci.nsIFile).path;
        paths.push(PathUtils.join(home, "scoop", "shims")); // Scoop
        paths.push(PathUtils.join(home, "AppData", "Local", "Programs")); // User installs
      } catch (e) {}
    }

    this._searchPaths = paths;
    return paths;
  }

  // Build PATH export string for shell commands (Unix only)
  // Also sets LANG for UTF-8 support (needed for non-ASCII filenames like Cyrillic)
  getPathExport() {
    const os = Services.appinfo.OS;
    if (os === "WINNT") return ""; // Windows doesn't use this

    const paths = this.getSearchPaths();
    return `export LANG=en_US.UTF-8; export PATH="${paths.join(":")}:$PATH";`;
  }

  // Check if running on Windows
  isWindows() {
    return Services.appinfo.OS === "WINNT";
  }

  // Get filename from path (cross-platform)
  getBasename(filePath) {
    if (!filePath) return '';
    // Handle both Unix (/) and Windows (\) separators
    const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
    return lastSlash >= 0 ? filePath.substring(lastSlash + 1) : filePath;
  }

  // Get platform-specific install instructions for a package
  getInstallInstructions(packages) {
    const os = Services.appinfo.OS;
    const pkgList = Array.isArray(packages) ? packages : [packages];

    if (os === "Darwin") {
      return pkgList.map(p => `  brew install ${p}`).join("\n");
    } else if (os === "Linux") {
      // Show apt commands as most common
      const aptMap = {
        "djvulibre": "djvulibre-bin",
        "ocrmypdf": "ocrmypdf",
        "tesseract": "tesseract-ocr",
        "tesseract-lang": "tesseract-ocr-eng"
      };
      return pkgList.map(p => `  sudo apt install ${aptMap[p] || p}`).join("\n");
    } else if (os === "WINNT") {
      const winMap = {
        "djvulibre": "choco install djvulibre",
        "ocrmypdf": "pip install ocrmypdf",
        "tesseract": "choco install tesseract",
        "tesseract-lang": "" // included with tesseract on Windows
      };
      return pkgList.map(p => winMap[p] ? `  ${winMap[p]}` : "").filter(s => s).join("\n");
    }
    return pkgList.join(", ");
  }

  // Format file size for display
  formatSize(bytes) {
    // Handle edge cases
    if (bytes == null || isNaN(bytes) || bytes < 0) return "0 B";
    if (bytes < 1024) return Math.round(bytes) + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  // Build a background command that creates marker files on success/error
  // Returns the full command string for the current platform
  buildBackgroundCommand(cmd, markerFile, errorFile, pidFile) {
    if (this.isWindows()) {
      // Windows: Use cmd.exe with conditional execution
      // Note: Windows cmd doesn't support easy PID capture, so we skip pidFile
      const escapedMarker = this.escapeWindowsPath(markerFile);
      const escapedError = this.escapeWindowsPath(errorFile);
      // Use copy nul to create empty files (Windows touch equivalent)
      // && runs next command only if previous succeeds, || runs if it fails
      return `(${cmd}) && (copy nul "${escapedMarker}" >nul 2>&1) || (copy nul "${escapedError}" >nul 2>&1)`;
    } else {
      // Unix: Use shell with touch and background execution
      const escapedMarker = this.escapeShellPath(markerFile);
      const escapedError = this.escapeShellPath(errorFile);
      const escapedPid = this.escapeShellPath(pidFile);
      return `(${cmd} && touch "${escapedMarker}") || (touch "${escapedError}") & echo $! > "${escapedPid}"`;
    }
  }

  // Start a background process
  async startBackgroundProcess(cmd, markerFile, errorFile, pidFile) {
    const fullCmd = this.buildBackgroundCommand(cmd, markerFile, errorFile, pidFile);

    if (this.isWindows()) {
      // Windows: Use start /B for background execution
      // Pass command directly - the buildBackgroundCommand already handles escaping
      // Using start /B without extra quoting wrapper to avoid escaping conflicts
      Zotero.Utilities.Internal.exec("cmd.exe", ["/c", `start /B cmd /c ${fullCmd}`]).catch(e => {
        this.log(`Background start error: ${e.message}`);
      });
    } else {
      // Unix: The command already includes & for background
      Zotero.Utilities.Internal.exec("/bin/sh", ["-c", fullCmd]).catch(e => {
        this.log(`Background start error: ${e.message}`);
      });
    }
  }

  // Kill a background process by PID file (Unix) or by pattern (Windows)
  async killBackgroundProcess(pidFile, processPattern) {
    if (this.isWindows()) {
      // Windows: Try to kill by process name pattern
      if (processPattern) {
        try {
          // Use taskkill to kill processes matching the pattern
          // /F = force, /IM = image name (must include .exe)
          // Handle special cases for different executables
          const patterns = [];
          if (processPattern === "ocrmypdf") {
            // ocrmypdf runs via Python on Windows
            patterns.push("ocrmypdf.exe");
            // Note: We don't kill python.exe as it might affect other processes
          } else {
            // Add .exe if not already present
            const exeName = processPattern.endsWith(".exe") ? processPattern : `${processPattern}.exe`;
            patterns.push(exeName);
          }

          for (const pattern of patterns) {
            try {
              await Zotero.Utilities.Internal.exec("cmd.exe", ["/c",
                `taskkill /F /IM "${pattern}" 2>nul`
              ]);
            } catch (e) {
              // Process might not exist or already be dead
            }
          }
        } catch (e) {
          // Process might already be dead
        }
      }
    } else {
      // Unix: Kill by PID from file
      try {
        const pidContent = await Zotero.File.getContentsAsync(pidFile);
        const pid = parseInt(pidContent.trim(), 10);
        if (pid > 0) {
          this.log(`Killing process with PID: ${pid}`);
          // Kill the process group to ensure child processes are also killed
          await Zotero.Utilities.Internal.exec("/bin/sh", ["-c",
            `kill -TERM -${pid} 2>/dev/null || kill -TERM ${pid} 2>/dev/null || true`
          ]);
        }
      } catch (e) {
        this.log(`Could not kill process: ${e.message}`);
      }
    }
    // Clean up PID file
    try { await IOUtils.remove(pidFile); } catch (e) {}
  }

  // Supported OCR languages
  getOcrLanguages() {
    return [
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
  }

  log(msg) {
    Zotero.debug(`[DJVU Converter] ${msg}`);
    dump(`[DJVU Converter] ${msg}\n`);
  }

  // Collect attachments from selected items that match a filter function
  // filterFn receives (item) and should return true to include the attachment
  collectAttachments(items, filterFn) {
    if (!items || !Array.isArray(items)) return [];

    const results = [];
    const seenIds = new Set();

    const checkItem = (item) => {
      if (item && item.isAttachment() && !item.deleted && filterFn(item) && !seenIds.has(item.id)) {
        seenIds.add(item.id);
        results.push(item);
      }
    };

    for (const item of items) {
      if (!item) continue;
      if (item.isAttachment() && !item.deleted) {
        checkItem(item);
      } else if (!item.deleted) {
        // Check child attachments of parent items
        const attachmentIDs = item.getAttachments();
        for (const attID of attachmentIDs) {
          const attachment = Zotero.Items.get(attID);
          if (attachment) {
            checkItem(attachment);
          }
        }
      }
    }

    return results;
  }

  // Truncate long filenames for display in dialogs
  truncateFilename(filename, maxLength = 50) {
    // Handle edge cases
    if (!filename) return '';
    if (maxLength < 4) maxLength = 4; // Minimum length to show "x..."
    if (filename.length <= maxLength) return filename;

    const ext = filename.lastIndexOf('.') > 0 ? filename.slice(filename.lastIndexOf('.')) : '';
    const nameWithoutExt = filename.slice(0, filename.length - ext.length);
    const available = maxLength - ext.length - 3; // 3 for "..."
    if (available <= 0) {
      // Not enough space for name + ext, just truncate the whole thing
      return filename.slice(0, Math.max(1, maxLength - 3)) + '...';
    }
    const truncatedName = nameWithoutExt.slice(0, available) + '...';
    return truncatedName + ext;
  }

  // Escape path for use in shell commands (inside double quotes)
  escapeShellPath(path) {
    // Handle null/undefined
    if (!path) return '';
    // Escape characters that are special inside double quotes: $ ` \ " !
    // Also remove any newlines/carriage returns for safety
    return path
      .replace(/[\r\n]/g, '') // Remove newlines (shouldn't exist in filenames)
      .replace(/([\\$`"!])/g, '\\$1');
  }

  // Escape path for Windows cmd.exe (handles spaces and special chars)
  escapeWindowsPath(path) {
    // Handle null/undefined
    if (!path) return '';
    // Windows paths with spaces need to be quoted, but if we're already
    // inside quotes, we just need to escape special characters
    // For cmd.exe, escape: & | < > ^ % (when outside quotes)
    // Inside quotes, most chars are safe except % and "
    return path
      .replace(/[\r\n]/g, '') // Remove newlines
      .replace(/%/g, '%%')    // Escape percent signs
      .replace(/"/g, '""');   // Escape double quotes by doubling
  }

  async init() {
    this.log("Initializing...");

    try {
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

      // Also check for pdftotext (used for checking existing OCR)
      this.pdftotextPath = await this.findExecutable("pdftotext");
      if (this.pdftotextPath) this.log(`Found pdftotext at: ${this.pdftotextPath}`);

      // Also check for pdfinfo (used for page count)
      this.pdfinfoPath = await this.findExecutable("pdfinfo");
      if (this.pdfinfoPath) this.log(`Found pdfinfo at: ${this.pdfinfoPath}`);

      // Show dependency check popup
      this.showDependencyCheck();
    } catch (e) {
      this.log(`Init error: ${e.message}`);
    }
  }

  // Get page count from PDF using pdfinfo
  async getPdfPageCount(pdfPath) {
    try {
      if (!this.pdfinfoPath) return null;

      const tempFile = pdfPath + ".pagecount";
      const escapedPdf = this.escapeShellPath(pdfPath);
      const escapedTemp = this.escapeShellPath(tempFile);

      if (this.isWindows()) {
        // Windows: use findstr instead of grep
        const escapedToolWin = this.escapeWindowsPath(this.pdfinfoPath);
        const escapedPdfWin = this.escapeWindowsPath(pdfPath);
        const escapedTempWin = this.escapeWindowsPath(tempFile);
        const cmd = `"${escapedToolWin}" "${escapedPdfWin}" 2>nul | findstr /i "^Pages:" > "${escapedTempWin}"`;
        await Zotero.Utilities.Internal.exec("cmd.exe", ["/c", cmd]);
      } else {
        // Set LANG for UTF-8 support (needed for non-ASCII filenames like Cyrillic)
        await Zotero.Utilities.Internal.exec("/bin/sh", ["-c",
          `export LANG=en_US.UTF-8; "${this.pdfinfoPath}" "${escapedPdf}" 2>/dev/null | grep -i "^Pages:" > "${escapedTemp}"`
        ]);
      }

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

  // Find executable on PATH using `which` (Unix) or `where` (Windows)
  async findExecutable(name) {
    try {
      // Write output to a temp file since exec doesn't return stdout
      const tempDir = Zotero.getTempDirectory().path;
      const tempFile = PathUtils.join(tempDir, `which_${name}_${Date.now()}.txt`);

      if (this.isWindows()) {
        // Windows: Use 'where' command and also check common paths directly
        const escapedTempFile = tempFile.replace(/\\/g, "\\\\");

        // First check if executable exists in known paths
        // Check multiple extensions: .exe, .bat, .cmd, and no extension (for scripts)
        const searchPaths = this.getSearchPaths();
        const extensions = [".exe", ".bat", ".cmd", ""];
        for (const dir of searchPaths) {
          for (const ext of extensions) {
            const exePath = PathUtils.join(dir, name + ext);
            try {
              if (await IOUtils.exists(exePath)) {
                return exePath;
              }
            } catch (e) {}
          }
        }

        // Fall back to 'where' command
        const cmd = `where ${name} > "${escapedTempFile}" 2>nul`;
        await Zotero.Utilities.Internal.exec("cmd.exe", ["/c", cmd]);
      } else {
        // Unix: Use 'which' with expanded PATH
        const escapedTempFile = this.escapeShellPath(tempFile);
        const cmd = `${this.getPathExport()} which ${name} > "${escapedTempFile}" 2>/dev/null`;
        await Zotero.Utilities.Internal.exec("/bin/sh", ["-c", cmd]);
      }

      // Small delay to ensure file is written
      await Zotero.Promise.delay(100);

      // Read the result
      let foundPath = null;
      try {
        const content = await Zotero.File.getContentsAsync(tempFile);
        const trimmed = content?.trim();
        if (trimmed && trimmed.length > 0) {
          // Unix paths start with /, Windows paths start with drive letter (e.g., C:\)
          const isValidPath = trimmed.startsWith("/") || /^[A-Za-z]:[\\\/]/.test(trimmed);
          if (isValidPath) {
            // On Windows, 'where' may return multiple lines; take the first one
            foundPath = trimmed.split(/[\r\n]/)[0].trim();
          }
        }
      } catch (e) {
        // File might not exist if which/where failed
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
    // Core dependencies: ddjvu for conversion, ocrmypdf+tesseract for OCR and compression
    const allFound = this.ddjvuFound && this.ocrmypdfFound && this.tesseractFound;

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
    message += `${this.ocrmypdfFound ? ok : missing} ocrmypdf - OCR and PDF compression\n`;

    // tesseract status
    message += `${this.tesseractFound ? ok : missing} tesseract - OCR engine\n`;

    message += "\n--- Install missing dependencies ---\n\n";

    const os = Services.appinfo.OS;

    if (os === "Darwin") {
      // macOS instructions
      if (!this.ddjvuFound) {
        message += "  brew install djvulibre\n";
      }
      if (!this.ocrmypdfFound) {
        message += "  brew install ocrmypdf\n";
      }
      if (!this.tesseractFound) {
        message += "  brew install tesseract tesseract-lang\n";
      }
    } else if (os === "Linux") {
      // Linux instructions (Debian/Ubuntu)
      message += "Debian/Ubuntu:\n";
      if (!this.ddjvuFound) {
        message += "  sudo apt install djvulibre-bin\n";
      }
      if (!this.ocrmypdfFound) {
        message += "  sudo apt install ocrmypdf\n";
      }
      if (!this.tesseractFound) {
        message += "  sudo apt install tesseract-ocr tesseract-ocr-eng\n";
      }
      message += "\nFedora/RHEL:\n";
      if (!this.ddjvuFound) {
        message += "  sudo dnf install djvulibre\n";
      }
      if (!this.ocrmypdfFound) {
        message += "  sudo dnf install ocrmypdf\n";
      }
      if (!this.tesseractFound) {
        message += "  sudo dnf install tesseract tesseract-langpack-eng\n";
      }
    } else if (os === "WINNT") {
      // Windows instructions
      message += "Using Chocolatey:\n";
      if (!this.ddjvuFound) {
        message += "  choco install djvulibre\n";
      }
      if (!this.ocrmypdfFound) {
        message += "  pip install ocrmypdf\n";
      }
      if (!this.tesseractFound) {
        message += "  choco install tesseract\n";
      }
      message += "\nOr download installers from project websites.";
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
      if (!item.isAttachment() || item.deleted) return;
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
      if (item.deleted) continue;
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
        this.getInstallInstructions("djvulibre") + "\n\n" +
        "Then restart Zotero."
      );
      return;
    }

    // Collect all DJVU attachments
    const djvuItems = this.collectAttachments(items, (item) => {
      const filename = (item.attachmentFilename || "").toLowerCase();
      return filename.endsWith(".djvu") || filename.endsWith(".djv");
    });

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
        this.getInstallInstructions(["ocrmypdf", "tesseract", "tesseract-lang"]) + "\n\n" +
        "Then restart Zotero."
      );
      return;
    }

    // Collect all PDF attachments
    const pdfItems = this.collectAttachments(items, (item) => {
      const contentType = item.attachmentContentType;
      const filename = (item.attachmentFilename || "").toLowerCase();
      return contentType === "application/pdf" || filename.endsWith(".pdf");
    });

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

    // Check dependencies (ocrmypdf handles compression via optimization)
    if (!this.ocrmypdfFound) {
      Services.prompt.alert(
        null,
        "DJVU to PDF Converter - Error",
        "Cannot compress: ocrmypdf is not installed.\n\n" +
        "Please install it with:\n" +
        this.getInstallInstructions("ocrmypdf") + "\n\n" +
        "Then restart Zotero."
      );
      return;
    }

    // Collect all PDF attachments
    const pdfItems = this.collectAttachments(items, (item) => {
      const contentType = item.attachmentContentType;
      const filename = (item.attachmentFilename || "").toLowerCase();
      return contentType === "application/pdf" || filename.endsWith(".pdf");
    });

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

      if (this.isWindows()) {
        const escapedToolWin = this.escapeWindowsPath(this.pdftotextPath);
        const escapedPdfWin = this.escapeWindowsPath(filePath);
        const escapedTxtWin = this.escapeWindowsPath(tempTextFile);
        const cmd = `"${escapedToolWin}" -f 1 -l 3 "${escapedPdfWin}" "${escapedTxtWin}" 2>nul`;
        await Zotero.Utilities.Internal.exec("cmd.exe", ["/c", cmd]);
      } else {
        // Set LANG for UTF-8 support (needed for non-ASCII filenames like Cyrillic)
        const cmd = `export LANG=en_US.UTF-8; "${this.pdftotextPath}" -f 1 -l 3 "${escapedPdf}" "${escapedTxt}" 2>/dev/null`;
        await Zotero.Utilities.Internal.exec("/bin/sh", ["-c", cmd]);
      }

      // Wait a bit for file to be written
      await Zotero.Promise.delay(200);

      // Check if text file has content
      let hasText = false;
      try {
        const textContent = await Zotero.File.getContentsAsync(tempTextFile);
        // Check if there's meaningful text (more than just whitespace)
        const cleanedText = textContent.replace(/\s+/g, '').trim();
        hasText = cleanedText.length > ZoteroDJVUConverter.MIN_TEXT_CHARS;
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

      const overlay = this.createOverlay(doc, "djvu-ocr-dialog");
      const dialog = this.createDialog(doc);

      dialog.appendChild(this.createTitle(doc, hasExistingText ? "Redo OCR" : "Add OCR Layer"));

      // Message
      const message = doc.createElement("div");
      const truncatedName = this.truncateFilename(filename);
      message.textContent = hasExistingText
        ? `"${truncatedName}" already appears to have text/OCR. Redo the OCR?`
        : `Add OCR text layer to "${truncatedName}"?`;
      message.style.cssText = "margin-bottom: 20px; color: #666;";
      dialog.appendChild(message);

      // Languages label
      const langLabel = doc.createElement("div");
      langLabel.textContent = "OCR Languages:";
      langLabel.style.cssText = ZoteroDJVUConverter.STYLES.LABEL;
      dialog.appendChild(langLabel);

      // Language checkboxes in a grid
      const langGrid = doc.createElement("div");
      langGrid.style.cssText = "display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px 12px; margin-bottom: 16px;";

      const languages = this.getOcrLanguages();
      const langChecks = [];

      for (const lang of languages) {
        const langOption = doc.createElement("label");
        langOption.style.cssText = "display: flex; align-items: center; cursor: pointer; font-size: 12px;";
        const check = doc.createElement("input");
        check.type = "checkbox";
        check.value = lang.code;
        check.style.cssText = "margin-right: 4px; width: 14px; height: 14px;";
        if (lang.code === "eng") check.checked = true;
        langOption.appendChild(check);
        langOption.appendChild(doc.createTextNode(lang.name));
        langGrid.appendChild(langOption);
        langChecks.push(check);
      }
      dialog.appendChild(langGrid);

      // PDF Optimization dropdown (same options as other dialogs for consistency)
      const optimizeLabel = doc.createElement("div");
      optimizeLabel.textContent = "PDF Compression:";
      optimizeLabel.style.cssText = ZoteroDJVUConverter.STYLES.LABEL + " margin-bottom: 8px;";
      dialog.appendChild(optimizeLabel);

      const optimizeOptions = [
        { value: "none", label: "None (no optimization)" },
        { value: "light", label: "Light (lossless, best quality)" },
        { value: "medium", label: "Medium (recommended)" },
        { value: "maximum", label: "Maximum (smallest file)" }
      ];
      const optimizeSelect = this.createSelect(doc, optimizeOptions, "medium");
      optimizeSelect.style.marginBottom = "20px";
      dialog.appendChild(optimizeSelect);

      // Cleanup function
      const cleanup = () => {
        doc.removeEventListener("keydown", handleKeydown);
        if (overlay.parentNode) overlay.remove();
      };

      // Buttons
      const buttons = this.createButtonsContainer(doc);
      buttons.appendChild(this.createButton(doc, "Cancel", false, () => {
        cleanup();
        resolve(null);
      }));

      const okBtn = this.createButton(doc, hasExistingText ? "Redo OCR" : "Add OCR", true, () => {
        const selectedLangs = langChecks.filter(c => c.checked).map(c => c.value);
        const ocrLangs = selectedLangs.length > 0 ? selectedLangs.join("+") : "eng";
        cleanup();
        resolve({ languages: ocrLangs, optimizeLevel: ZoteroDJVUConverter.getOptimizeLevel(optimizeSelect.value) });
      });
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

  showCompressionOptionsDialog(filename, fileSize) {
    const window = Zotero.getMainWindow();
    const doc = window.document;

    return new Promise((resolve) => {
      const overlay = this.createOverlay(doc, "djvu-compression-dialog-overlay");
      const dialog = this.createDialog(doc);

      dialog.appendChild(this.createTitle(doc, "Compress PDF"));

      // Message
      const message = doc.createElement("div");
      const truncatedName = this.truncateFilename(filename);
      message.textContent = `Compress "${truncatedName}" (${this.formatSize(fileSize)})?`;
      message.style.cssText = "margin-bottom: 20px; color: #666;";
      dialog.appendChild(message);

      // Compression level label
      const levelLabel = doc.createElement("div");
      levelLabel.textContent = "Compression Level:";
      levelLabel.style.cssText = ZoteroDJVUConverter.STYLES.LABEL + " margin-bottom: 8px;";
      dialog.appendChild(levelLabel);

      // Compression level dropdown
      const levels = [
        { value: "light", label: "Light (lossless, best quality)" },
        { value: "medium", label: "Medium (recommended)" },
        { value: "maximum", label: "Maximum (smallest file)" }
      ];
      const levelSelect = this.createSelect(doc, levels, "medium");
      levelSelect.style.marginBottom = "20px";
      dialog.appendChild(levelSelect);

      // Cleanup function
      const cleanup = () => {
        doc.removeEventListener("keydown", handleKeydown);
        if (overlay.parentNode) overlay.remove();
      };

      // Buttons
      const buttons = this.createButtonsContainer(doc);
      buttons.appendChild(this.createButton(doc, "Cancel", false, () => {
        cleanup();
        resolve(null);
      }));
      const compressBtn = this.createButton(doc, "Compress", true, () => {
        cleanup();
        resolve(levelSelect.value);
      });
      buttons.appendChild(compressBtn);

      dialog.appendChild(buttons);
      overlay.appendChild(dialog);
      doc.documentElement.appendChild(overlay);

      compressBtn.focus();

      const handleKeydown = (e) => {
        if (e.key === "Escape") {
          cleanup();
          resolve(null);
        } else if (e.key === "Enter") {
          compressBtn.click();
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
    if (!item) {
      this.log("No item provided");
      return;
    }

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

    const filename = item.getField("title") || this.getBasename(filePath) || "file.pdf";

    // Check if PDF already has text/OCR
    const hasExistingText = await this.checkPdfHasText(filePath);

    // Show OCR options dialog with language selector
    const options = await this.showOcrOptionsDialog(filename, hasExistingText);

    if (!options) return;

    const optimizeLevel = options.optimizeLevel ?? 1;

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
      const ocrSuccess = await this.runOcrWithProgress(filePath, ocrPdfPath, progress, forceOcr, options.languages, pageCount, optimizeLevel);

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

        let finalSize = 0;
        try {
          finalSize = Zotero.File.pathToFile(filePath).fileSize;
        } catch (e) {}

        let sizeInfo = `${this.formatSize(inputSize)} → ${this.formatSize(finalSize)}`;

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
    if (!item) {
      this.log("No item provided");
      return;
    }

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

    const filename = item.getField("title") || this.getBasename(filePath);

    // Get original size
    let inputSize = 0;
    try {
      inputSize = Zotero.File.pathToFile(filePath).fileSize;
    } catch (e) {}

    // Show compression options dialog
    const compressionLevel = await this.showCompressionOptionsDialog(filename, inputSize);

    if (!compressionLevel) return; // User cancelled

    // Mark as processing and ensure cleanup with try/finally
    this._isProcessing = true;
    let progress = null;

    try {
      progress = this.showProgress("Compressing PDF...");

      // Get optimize level from compression level
      const optimizeLevel = ZoteroDJVUConverter.getOptimizeLevel(compressionLevel);

      // Get page count for progress display
      const pageCount = await this.getPdfPageCount(filePath);

      // Use ocrmypdf with skipOcr=true to only apply optimization without OCR
      const compressedPath = filePath.replace(/\.pdf$/i, "_compressed.pdf");

      const success = await this.runOcrWithProgress(
        filePath,
        compressedPath,
        progress,
        false,  // forceOcr
        "eng",  // languages (not used when skipOcr=true)
        pageCount,
        optimizeLevel,
        true    // skipOcr - compression only
      );

      // Check if cancelled
      if (progress.cancelled) {
        try { await IOUtils.remove(compressedPath); } catch (e) {}
        progress.close();
        return;
      }

      if (success && Zotero.File.pathToFile(compressedPath).exists()) {
        // Replace original with compressed version
        await IOUtils.remove(filePath);
        await IOUtils.move(compressedPath, filePath);

        // Get new size
        let outputSize = 0;
        try {
          outputSize = Zotero.File.pathToFile(filePath).fileSize;
        } catch (e) {}

        if (outputSize < inputSize) {
          const savings = inputSize > 0 ? Math.round((1 - outputSize / inputSize) * 100) : 0;
          const sizeInfo = `${this.formatSize(inputSize)} → ${this.formatSize(outputSize)} (${savings}% smaller)`;
          progress.finish(true, "Compressed! " + sizeInfo);
          this.log("PDF compressed successfully");
        } else {
          progress.finish(true, "No compression needed - file already optimized");
          this.log("Compression skipped - no size reduction");
        }
      } else {
        throw new Error("Compression output file not created");
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
    return new Promise((resolve) => {
      const win = Zotero.getMainWindow();
      if (!win) {
        this.log("No main window found");
        resolve(null);
        return;
      }
      const doc = win.document;

      // Remove any existing dialog
      const existing = doc.getElementById("djvu-options-dialog");
      if (existing) existing.remove();

      const overlay = this.createOverlay(doc, "djvu-options-dialog");
      const dialog = this.createDialog(doc);

      dialog.appendChild(this.createTitle(doc, "DJVU to PDF Converter"));

      // Filename message
      const filenameDiv = doc.createElement("div");
      filenameDiv.textContent = `Convert "${this.truncateFilename(filename)}" to PDF?`;
      filenameDiv.style.cssText = "margin-bottom: 20px; color: #666;";
      dialog.appendChild(filenameDiv);

      // Options label
      const optLabel = doc.createElement("div");
      optLabel.textContent = "Options:";
      optLabel.style.cssText = ZoteroDJVUConverter.STYLES.LABEL;
      dialog.appendChild(optLabel);

      // OCR checkbox
      const ocrAvailable = this.ocrmypdfFound && this.tesseractFound;
      const ocrText = ocrAvailable
        ? "Add OCR text layer (makes PDF searchable)"
        : "Add OCR text layer (not available - install ocrmypdf + tesseract)";
      const { label: ocrLabel, checkbox: ocrCheck } = this.createCheckbox(doc, "djvu-ocr", ocrText, false, !ocrAvailable);
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

      const languages = this.getOcrLanguages();
      const langChecks = [];

      for (const lang of languages) {
        const langOption = doc.createElement("label");
        langOption.style.cssText = "display: flex; align-items: center; cursor: pointer; font-size: 12px;";
        const check = doc.createElement("input");
        check.type = "checkbox";
        check.value = lang.code;
        check.style.cssText = "margin-right: 4px; width: 14px; height: 14px;";
        if (lang.code === "eng") check.checked = true;
        langOption.appendChild(check);
        langOption.appendChild(doc.createTextNode(lang.name));
        langGrid.appendChild(langOption);
        langChecks.push(check);
      }

      langContainer.appendChild(langGrid);
      dialog.appendChild(langContainer);

      // Compression dropdown (always visible, independent of OCR)
      const compressContainer = doc.createElement("div");
      compressContainer.style.cssText = "margin-bottom: 16px;";

      const compressAvailable = this.ocrmypdfFound;

      const compressLevelLabel = doc.createElement("div");
      compressLevelLabel.textContent = "PDF Compression:";
      compressLevelLabel.style.cssText = ZoteroDJVUConverter.STYLES.LABEL + ` margin-bottom: 8px; ${compressAvailable ? "" : "color: #999;"}`;
      compressContainer.appendChild(compressLevelLabel);

      const compressLevels = [
        { value: "none", label: "None (no optimization)" },
        { value: "light", label: "Light (lossless, best quality)" },
        { value: "medium", label: "Medium (recommended)" },
        { value: "maximum", label: "Maximum (smallest file)" }
      ];
      const compressSelect = this.createSelect(doc, compressLevels, "medium", !compressAvailable);
      compressContainer.appendChild(compressSelect);

      if (!compressAvailable) {
        const notAvailableNote = doc.createElement("div");
        notAvailableNote.textContent = "Install ocrmypdf to enable compression";
        notAvailableNote.style.cssText = "font-size: 11px; color: #999; margin-top: 4px;";
        compressContainer.appendChild(notAvailableNote);
      }

      dialog.appendChild(compressContainer);

      // Show/hide language selector based on OCR checkbox
      const updateVisibility = () => {
        langContainer.style.display = ocrCheck.checked ? "block" : "none";
      };
      ocrCheck.addEventListener("change", updateVisibility);
      ocrCheck.addEventListener("click", () => setTimeout(updateVisibility, 0));

      // After conversion label
      const afterLabel = doc.createElement("div");
      afterLabel.textContent = "After conversion:";
      afterLabel.style.cssText = ZoteroDJVUConverter.STYLES.LABEL;
      dialog.appendChild(afterLabel);

      // Replace radio
      const replaceLabel = doc.createElement("label");
      replaceLabel.style.cssText = "display: flex; align-items: center; margin-bottom: 8px; cursor: pointer;";
      const replaceRadio = doc.createElement("input");
      replaceRadio.type = "radio";
      replaceRadio.name = "djvu-action";
      replaceRadio.value = "replace";
      replaceRadio.checked = true;
      replaceRadio.style.cssText = ZoteroDJVUConverter.STYLES.CHECKBOX;
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
      keepRadio.style.cssText = ZoteroDJVUConverter.STYLES.CHECKBOX;
      keepLabel.appendChild(keepRadio);
      keepLabel.appendChild(doc.createTextNode("Keep both files"));
      dialog.appendChild(keepLabel);

      // Cleanup function
      const cleanup = () => {
        doc.removeEventListener("keydown", handleKeydown);
        if (overlay.parentNode) overlay.remove();
      };

      // Buttons
      const buttons = this.createButtonsContainer(doc);
      buttons.appendChild(this.createButton(doc, "Cancel", false, () => {
        cleanup();
        resolve(null);
      }));

      const convertBtn = this.createButton(doc, "Convert", true, () => {
        const selectedLangs = langChecks.filter(c => c.checked).map(c => c.value);
        const ocrLangs = selectedLangs.length > 0 ? selectedLangs.join("+") : "eng";
        const compressLevel = compressSelect.value !== "none" ? compressSelect.value : null;

        cleanup();
        resolve({
          addOcr: ocrCheck.checked,
          compressLevel: compressLevel,
          deleteOriginal: replaceRadio.checked,
          ocrLanguages: ocrLangs
        });
      });
      buttons.appendChild(convertBtn);

      dialog.appendChild(buttons);
      overlay.appendChild(dialog);
      doc.documentElement.appendChild(overlay);

      convertBtn.focus();

      const handleKeydown = (e) => {
        if (e.key === "Escape") {
          cleanup();
          resolve(null);
        } else if (e.key === "Enter") {
          convertBtn.click();
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

  showProgress(message) {
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
          progressWin.startCloseTimer(ZoteroDJVUConverter.PROGRESS_CLOSE_DELAY);
        },
        close: () => progressWin.close()
      };
    }

    const doc = win.document;

    // Remove any existing progress dialog
    const existing = doc.getElementById("djvu-progress-dialog");
    if (existing) existing.remove();

    const overlay = this.createOverlay(doc, "djvu-progress-dialog");
    const dialog = this.createDialog(doc);
    dialog.style.minWidth = "320px";

    dialog.appendChild(this.createTitle(doc, "DJVU to PDF Converter"));

    // Status text
    const statusText = doc.createElement("div");
    statusText.textContent = message;
    statusText.style.cssText = "margin-bottom: 16px; color: #666; min-height: 20px;";
    dialog.appendChild(statusText);

    // Cancel button (danger style, full width)
    const cancelBtn = doc.createElement("button");
    cancelBtn.textContent = "Cancel";
    const S = ZoteroDJVUConverter.STYLES;
    cancelBtn.style.cssText = S.BUTTON_BASE + S.BUTTON_DANGER + " width: 100%; padding: 10px 16px;";
    cancelBtn.onmouseenter = () => { cancelBtn.style.background = "linear-gradient(to bottom, #ee3333, #aa0000)"; };
    cancelBtn.onmouseleave = () => { cancelBtn.style.background = "linear-gradient(to bottom, #ff4444, #cc0000)"; };
    dialog.appendChild(cancelBtn);

    overlay.appendChild(dialog);
    doc.documentElement.appendChild(overlay);

    // Progress controller object
    const controller = {
      cancelled: false,
      finished: false,
      overlay: overlay,
      updateText: (text) => {
        if (!controller.cancelled && !controller.finished) statusText.textContent = text;
      },
      setProgress: (percent) => {}, // No-op for backward compatibility
      finish: (success, msg) => {
        if (controller.cancelled) return;
        controller.finished = true;
        statusText.textContent = msg || (success ? "Done!" : "Failed");
        statusText.style.color = success ? "#00aa00" : "#cc0000";

        // Switch to secondary style
        cancelBtn.textContent = "Close";
        cancelBtn.style.cssText = S.BUTTON_BASE + S.BUTTON_SECONDARY + " width: 100%; padding: 10px 16px;";
        cancelBtn.onmouseenter = () => { cancelBtn.style.background = "linear-gradient(to bottom, #e8e8e8, #d8d8d8)"; };
        cancelBtn.onmouseleave = () => { cancelBtn.style.background = "linear-gradient(to bottom, #f8f8f8, #e8e8e8)"; };
      },
      close: () => { if (overlay.parentNode) overlay.remove(); }
    };

    // Cancel button handler
    cancelBtn.onclick = () => {
      if (controller.cancelled || controller.finished) {
        overlay.remove();
        return;
      }
      controller.cancelled = true;
      statusText.textContent = "Cancelling...";
      cancelBtn.style.opacity = "0.7";
      this.log("User cancelled operation");
    };

    return controller;
  }

  // Helper to get file size safely
  getFileSize(path) {
    try {
      return Zotero.File.pathToFile(path).fileSize;
    } catch (e) {
      return 0;
    }
  }

  // Clean up temporary files created during conversion
  async cleanupTempFiles(basePath) {
    if (!basePath) return;

    const tempFiles = [
      basePath,
      basePath.replace(/\.pdf$/i, "_ocr.pdf"),
      basePath.replace(/\.pdf$/i, "_compressed.pdf")
    ];

    for (const tempFile of tempFiles) {
      try {
        if (Zotero.File.pathToFile(tempFile).exists()) {
          await IOUtils.remove(tempFile);
          this.log(`Cleaned up temp file: ${tempFile}`);
        }
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }

  // Validate attachment is a DJVU file and get its path
  async validateDjvuAttachment(item) {
    if (!item) {
      this.log("No item provided");
      return null;
    }
    if (item.deleted) {
      this.log("Item is in trash, skipping");
      return null;
    }

    let filePath;
    try {
      filePath = await item.getFilePathAsync();
    } catch (e) {
      this.log(`Could not get file path: ${e.message}`);
      return null;
    }

    if (!filePath) {
      this.log("No file path for attachment");
      return null;
    }

    const lowerPath = filePath.toLowerCase();
    if (!lowerPath.endsWith(".djvu") && !lowerPath.endsWith(".djv")) {
      this.log("Not a DJVU file, skipping");
      return null;
    }

    return filePath;
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

    // Validate the attachment
    const filePath = await this.validateDjvuAttachment(item);
    if (!filePath) return;

    this.log(`Attachment file path: ${filePath}`);
    const filename = item.getField("title") || this.getBasename(filePath) || "file.djvu";
    this.log(`DJVU file detected: ${filename}`);

    // Check if ddjvu is available
    if (!this.ddjvuFound) {
      Services.prompt.alert(
        null,
        "DJVU to PDF Converter - Error",
        "Cannot convert: ddjvu (djvulibre) is not installed.\n\n" +
        "Please install it with:\n" +
        this.getInstallInstructions("djvulibre") + "\n\n" +
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
        this.getInstallInstructions(["ocrmypdf", "tesseract", "tesseract-lang"]) + "\n\n" +
        "Continue conversion without OCR?"
      );
      if (!continueWithoutOcr) {
        return;
      }
      options.addOcr = false;
    }

    this.log(`Options: OCR=${options.addOcr}, compressLevel=${options.compressLevel}, deleteOriginal=${options.deleteOriginal}`);

    // Mark as processing and ensure cleanup with try/finally
    this._isProcessing = true;
    let progress = null;

    // Track sizes at each stage
    const sizes = {
      original: this.getFileSize(filePath),
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

      sizes.afterConversion = this.getFileSize(tempPdfPath);
      this.log(`Size after conversion: ${this.formatSize(sizes.afterConversion)}`);

      // Check if cancelled after conversion
      if (progress.cancelled) {
        this.log("Conversion cancelled after DJVU to PDF step");
        try { await IOUtils.remove(tempPdfPath); } catch (e) {}
        progress.close();
        return;
      }

      let finalPdfPath = tempPdfPath;

      // Step 2: Run ocrmypdf for OCR and/or compression
      // ocrmypdf handles both OCR (via tesseract) and optimization (via -O level)
      const needsOcr = options.addOcr;
      const needsCompression = options.compressLevel && options.compressLevel !== "none";
      const optimizeLevel = ZoteroDJVUConverter.getOptimizeLevel(options.compressLevel);

      if ((needsOcr || needsCompression) && this.ocrmypdfFound) {
        sizes.afterOcr = sizes.afterConversion; // Default in case processing fails

        const ocrPdfPath = tempPdfPath.replace(/\.pdf$/i, "_ocr.pdf");

        // Get page count for progress display
        const pageCount = await this.getPdfPageCount(tempPdfPath);
        this.log(`PDF has ${pageCount || "unknown"} pages`);

        // Determine what we're doing for logging/progress
        let stepDescription;
        if (needsOcr && needsCompression) {
          stepDescription = "Running OCR + compression";
        } else if (needsOcr) {
          stepDescription = "Running OCR";
        } else {
          stepDescription = "Compressing PDF";
        }

        this.log(`${stepDescription}: ${tempPdfPath} -> ${ocrPdfPath} (optimize level: ${optimizeLevel})`);

        try {
          // Run ocrmypdf with progress updates
          // When OCR is disabled, use forceOcr=false and --skip-text mode (handled in runOcrWithProgress)
          // The skipOcr parameter tells runOcrWithProgress to use --skip-text even when not adding OCR
          const ocrSuccess = await this.runOcrWithProgress(
            tempPdfPath,
            ocrPdfPath,
            progress,
            false,  // forceOcr - don't redo existing OCR
            options.ocrLanguages || "eng",
            pageCount,
            optimizeLevel,
            !needsOcr  // skipOcr - if we don't need OCR, skip it but still optimize
          );

          if (ocrSuccess && Zotero.File.pathToFile(ocrPdfPath).exists()) {
            // Delete the original and use processed version
            await IOUtils.remove(tempPdfPath);
            await IOUtils.move(ocrPdfPath, tempPdfPath);
            sizes.afterOcr = this.getFileSize(tempPdfPath);
            this.log(`Processing completed successfully. Size after: ${this.formatSize(sizes.afterOcr)}`);
          } else {
            sizes.afterOcr = sizes.afterConversion;
            this.log("Processing output not found, using original version");
          }
        } catch (ocrError) {
          this.log(`Processing failed: ${ocrError.message}`);

          // Check if cancelled
          if (ocrError.message.includes("Cancelled by user") || progress.cancelled) {
            this.log("Processing was cancelled by user");
            try { await IOUtils.remove(tempPdfPath); } catch (e) {}
            try { await IOUtils.remove(ocrPdfPath); } catch (e) {}
            progress.close();
            return;
          }

          // Show error but continue with original PDF
          let errorMsg;
          if (ocrError.message.includes("timeout")) {
            errorMsg = "Processing timed out (file too large)";
          } else {
            // Truncate long messages
            errorMsg = ocrError.message.substring(0, 100);
          }
          progress.updateText("Processing failed - using original PDF");

          // Log full error for debugging
          this.log(`Full processing error: ${ocrError.message}`);

          // Show simple alert
          const alertTitle = needsOcr ? "OCR Failed" : "Compression Failed";
          Services.prompt.alert(
            null,
            alertTitle,
            `PDF processing failed.\n\nReason: ${errorMsg}\n\nPDF will be saved without processing.`
          );
        }
      } else {
        // No processing needed
        sizes.afterOcr = sizes.afterConversion;
      }

      // Final cancellation check before updating library
      if (progress.cancelled) {
        this.log("Conversion cancelled before library update");
        try { await IOUtils.remove(finalPdfPath); } catch (e) {}
        progress.close();
        return;
      }

      // Get final size BEFORE moving file
      sizes.final = this.getFileSize(finalPdfPath);

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
      let sizeInfo = `DJVU: ${this.formatSize(sizes.original)}`;
      sizeInfo += ` → PDF: ${this.formatSize(sizes.afterConversion)}`;

      // Show processing result (OCR and/or compression via ocrmypdf)
      if ((needsOcr || needsCompression) && sizes.afterOcr !== sizes.afterConversion) {
        let processLabel;
        if (needsOcr && needsCompression) {
          processLabel = "OCR+Comp";
        } else if (needsOcr) {
          processLabel = "OCR";
        } else {
          processLabel = "Compressed";
        }
        sizeInfo += ` → ${processLabel}: ${this.formatSize(sizes.afterOcr)}`;
      }

      progress.finish(true, "Done! " + sizeInfo);
      this.log(`Conversion completed: ${sizeInfo}`);

    } catch (e) {
      this.log(`Conversion failed: ${e.message}\n${e.stack}`);

      // Clean up any temp files
      const tempPdfPath = filePath.replace(/\.(djvu|djv)$/i, ".pdf");
      await this.cleanupTempFiles(tempPdfPath);

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
    const originalFilename = this.getBasename(originalPath);
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

  // Build the ocrmypdf command string
  buildOcrmypdfCommand(inputPath, outputPath, errorLogFile, options = {}) {
    const { forceOcr = false, languages = 'eng', optimizeLevel = 1, skipOcr = false } = options;

    // Validate language string (only allow alphanumeric, underscore, plus)
    let safeLangs = (languages || 'eng').replace(/[^a-zA-Z0-9_+]/g, '');
    if (!safeLangs || safeLangs === '+') safeLangs = 'eng';

    const ocrMode = forceOcr ? "--force-ocr" : "--skip-text";
    const skipBig = ZoteroDJVUConverter.OCR_SKIP_BIG_MB;
    const tessTimeout = skipOcr ? 0 : ZoteroDJVUConverter.OCR_TESSERACT_TIMEOUT;
    const optLevel = optimizeLevel >= 0 && optimizeLevel <= 3 ? optimizeLevel : 1;

    if (this.isWindows()) {
      const escapedInput = this.escapeWindowsPath(inputPath);
      const escapedOutput = this.escapeWindowsPath(outputPath);
      const escapedLogFile = this.escapeWindowsPath(errorLogFile);
      const escapedTool = this.escapeWindowsPath(this.ocrmypdfPath);
      return `"${escapedTool}" -O ${optLevel} ${ocrMode} --skip-big ${skipBig} --tesseract-timeout ${tessTimeout} -v 1 -l ${safeLangs} "${escapedInput}" "${escapedOutput}" 2>"${escapedLogFile}"`;
    } else {
      const pathExport = this.getPathExport();
      const escapedInput = this.escapeShellPath(inputPath);
      const escapedOutput = this.escapeShellPath(outputPath);
      const escapedLogFile = this.escapeShellPath(errorLogFile);
      return `${pathExport} "${this.ocrmypdfPath}" -O ${optLevel} ${ocrMode} --skip-big ${skipBig} --tesseract-timeout ${tessTimeout} -v 1 -l ${safeLangs} "${escapedInput}" "${escapedOutput}" 2>"${escapedLogFile}"`;
    }
  }

  // Parse ocrmypdf log file for progress info
  async parseOcrProgress(errorLogFile, pageCount, skipOcr) {
    let statusText = skipOcr ? "Compressing" : "Running OCR";
    let pageInfo = "";

    try {
      const logContent = await Zotero.File.getContentsAsync(errorLogFile);
      if (logContent) {
        const isPostprocessing = logContent.includes("Postprocessing");
        const isOptimizing = logContent.includes("Optimizable images");

        if (isOptimizing) {
          statusText = "Optimizing";
        } else if (isPostprocessing) {
          statusText = "Postprocessing";
        }

        // Look for page numbers in output
        if (!isPostprocessing && !isOptimizing) {
          const pageLineMatches = logContent.match(/^\s+(\d+)\s+\S/gm);
          if (pageLineMatches && pageLineMatches.length > 0) {
            let maxPage = 0;
            for (const match of pageLineMatches) {
              const numMatch = match.match(/(\d+)/);
              if (numMatch) {
                const pageNum = parseInt(numMatch[1], 10);
                if (pageNum > maxPage) maxPage = pageNum;
              }
            }
            if (maxPage > 0) {
              pageInfo = pageCount > 0 ? ` • page ${maxPage}/${pageCount}` : ` • page ${maxPage}`;
            }
          }
        }
      }
    } catch (e) {
      // Log file might not exist yet
    }

    return { statusText, pageInfo };
  }

  // Clean up OCR marker and log files
  async cleanupOcrMarkerFiles(outputPath) {
    if (!outputPath) return;

    const files = [
      outputPath + ".done",
      outputPath + ".error",
      outputPath + ".log",
      outputPath + ".pid"
    ];
    for (const file of files) {
      try { await IOUtils.remove(file); } catch (e) {}
    }
  }

  async runOcrWithProgress(inputPath, outputPath, progress, forceOcr = false, languages = "eng", pageCount = null, optimizeLevel = 1, skipOcr = false) {
    const modeDesc = skipOcr ? "compression-only" : (forceOcr ? "force-OCR" : "OCR");
    this.log(`Starting ${modeDesc} process...`);
    this.log(`Languages: ${languages}, pages: ${pageCount || "unknown"}, optimize: -O ${optimizeLevel}, skipOcr: ${skipOcr}`);

    // File paths for tracking
    const errorLogFile = outputPath + ".log";
    const pidFile = outputPath + ".pid";
    const markerFile = outputPath + ".done";
    const errorFile = outputPath + ".error";

    // Build command using helper
    const ocrCmd = this.buildOcrmypdfCommand(inputPath, outputPath, errorLogFile, {
      forceOcr, languages, optimizeLevel, skipOcr
    });
    this.log(`OCR command: ${ocrCmd}`);

    // Clean up any leftover files from previous cancelled runs
    await this.cleanupOcrMarkerFiles(outputPath);
    try { await IOUtils.remove(outputPath); } catch (e) {}

    // Start background process
    this.startBackgroundProcess(ocrCmd, markerFile, errorFile, pidFile);

    // Poll for completion with progress updates
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const maxWait = ZoteroDJVUConverter.TIMEOUT_OCR;

      const checkInterval = setInterval(async () => {
        // Check if cancelled
        if (progress.cancelled) {
          clearInterval(checkInterval);
          await this.killBackgroundProcess(pidFile, "ocrmypdf");
          if (this.isWindows()) {
            try {
              await Zotero.Utilities.Internal.exec("cmd.exe", ["/c", "taskkill /F /IM tesseract.exe 2>nul"]);
            } catch (e) {}
          }
          await this.cleanupOcrMarkerFiles(outputPath);
          try { await IOUtils.remove(outputPath); } catch (e) {}
          this.log("OCR cancelled by user");
          reject(new Error("Cancelled by user"));
          return;
        }

        const elapsed = Date.now() - startTime;
        const elapsedSec = Math.floor(elapsed / 1000);

        // Parse progress from log file using helper
        const { statusText, pageInfo } = await this.parseOcrProgress(errorLogFile, pageCount, skipOcr);
        progress.updateText(`${statusText}${pageInfo} • ${elapsedSec}s`);

        // Check if done
        let done = false;
        let error = false;

        try { done = await IOUtils.exists(markerFile); } catch (e) {}
        try { error = await IOUtils.exists(errorFile); } catch (e) {}

        if (done) {
          clearInterval(checkInterval);
          await this.cleanupOcrMarkerFiles(outputPath);
          progress.setProgress(79);
          const completeMsg = skipOcr ? "Compression complete!" :
            optimizeLevel > 0 ? "OCR & optimization complete!" : "OCR complete!";
          progress.updateText(completeMsg);
          this.log(skipOcr ? "Compression completed successfully" : "OCR completed successfully");
          resolve(true);
        } else if (error) {
          clearInterval(checkInterval);
          const modeLabel = skipOcr ? "Compression" : "OCR";
          let errorMsg = `${modeLabel} processing failed`;
          try {
            const logContent = await Zotero.File.getContentsAsync(errorLogFile);
            if (logContent && logContent.trim()) {
              const lines = logContent.trim().split("\n");
              errorMsg = lines.slice(-3).join(" ").substring(0, 200);
            }
          } catch (e) {}
          await this.cleanupOcrMarkerFiles(outputPath);
          this.log(`${modeLabel} failed: ${errorMsg}`);
          reject(new Error(errorMsg));
        } else if (elapsed >= maxWait) {
          clearInterval(checkInterval);
          await this.killBackgroundProcess(pidFile, "ocrmypdf");
          if (this.isWindows()) {
            try {
              await Zotero.Utilities.Internal.exec("cmd.exe", ["/c", "taskkill /F /IM tesseract.exe 2>nul"]);
            } catch (e) {}
          }
          await this.cleanupOcrMarkerFiles(outputPath);
          const modeLabel = skipOcr ? "Compression" : "OCR";
          this.log(`${modeLabel} timeout after ${elapsedSec} seconds`);
          reject(new Error(`${modeLabel} timed out after 10 minutes`));
        }
      }, ZoteroDJVUConverter.POLL_INTERVAL_SLOW);
    });
  }

  async getDjvuPageCount(inputPath) {
    const self = this;
    return new Promise((resolve) => {
      try {
        // Find djvused (part of djvulibre, same as ddjvu)
        const djvusedPath = self.ddjvuPath.replace(/ddjvu([^\/\\]*)$/, "djvused$1");
        const tempFile = PathUtils.join(Zotero.getTempDirectory().path, `djvu_pagecount_${Date.now()}.txt`);

        let cmd;
        if (self.isWindows()) {
          const escapedInput = self.escapeWindowsPath(inputPath);
          const escapedTool = self.escapeWindowsPath(djvusedPath);
          const escapedTemp = self.escapeWindowsPath(tempFile);
          cmd = `"${escapedTool}" "${escapedInput}" -e "n" > "${escapedTemp}" 2>&1`;
        } else {
          const escapedInput = self.escapeShellPath(inputPath);
          const escapedTemp = self.escapeShellPath(tempFile);
          // Set LANG for UTF-8 support (needed for non-ASCII filenames like Cyrillic)
          cmd = `export LANG=en_US.UTF-8; "${djvusedPath}" "${escapedInput}" -e 'n' > "${escapedTemp}" 2>&1`;
        }

        const process = Components.classes["@mozilla.org/process/util;1"]
          .createInstance(Components.interfaces.nsIProcess);
        const shell = self.isWindows() ? "cmd.exe" : "/bin/sh";
        const shellArgs = self.isWindows() ? ["/c", cmd] : ["-c", cmd];
        const shellFile = Components.classes["@mozilla.org/file/local;1"]
          .createInstance(Components.interfaces.nsIFile);
        shellFile.initWithPath(shell);
        process.init(shellFile);
        process.run(true, shellArgs, shellArgs.length);

        // Read result
        setTimeout(async () => {
          try {
            const content = await Zotero.File.getContentsAsync(tempFile);
            const pageCount = parseInt(content.trim(), 10);
            try { await IOUtils.remove(tempFile); } catch (e) {}
            resolve(isNaN(pageCount) ? null : pageCount);
          } catch (e) {
            resolve(null);
          }
        }, 100);
      } catch (e) {
        self.log(`Failed to get DJVU page count: ${e.message}`);
        resolve(null);
      }
    });
  }

  async runDdjvuWithProgress(inputPath, outputPath, progress) {
    if (!inputPath || !outputPath) {
      throw new Error("Missing input or output path");
    }

    // Get page count first for progress display
    const totalPages = await this.getDjvuPageCount(inputPath);
    if (totalPages) {
      this.log(`DJVU has ${totalPages} pages`);
    }

    this.log("Starting DJVU conversion...");

    const markerFile = outputPath + ".done";
    const errorFile = outputPath + ".error";
    const pidFile = outputPath + ".pid";
    const logFile = outputPath + ".log";

    // Clean up any leftover files from previous cancelled runs
    try { await IOUtils.remove(markerFile); } catch (e) {}
    try { await IOUtils.remove(errorFile); } catch (e) {}
    try { await IOUtils.remove(logFile); } catch (e) {}
    try { await IOUtils.remove(pidFile); } catch (e) {}
    try { await IOUtils.remove(outputPath); } catch (e) {}

    // Build the ddjvu command with -verbose for progress (cross-platform)
    let ddjvuCmd;
    if (this.isWindows()) {
      const escapedInput = this.escapeWindowsPath(inputPath);
      const escapedOutput = this.escapeWindowsPath(outputPath);
      const escapedTool = this.escapeWindowsPath(this.ddjvuPath);
      const escapedLog = this.escapeWindowsPath(logFile);
      ddjvuCmd = `"${escapedTool}" -format=pdf -verbose "${escapedInput}" "${escapedOutput}" 2>"${escapedLog}"`;
    } else {
      const escapedInput = this.escapeShellPath(inputPath);
      const escapedOutput = this.escapeShellPath(outputPath);
      const escapedLog = this.escapeShellPath(logFile);
      // Set LANG for UTF-8 support (needed for non-ASCII filenames like Cyrillic)
      ddjvuCmd = `export LANG=en_US.UTF-8; "${this.ddjvuPath}" -format=pdf -verbose "${escapedInput}" "${escapedOutput}" 2>"${escapedLog}"`;
    }

    // Start background process using helper
    this.startBackgroundProcess(ddjvuCmd, markerFile, errorFile, pidFile);

    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const maxWait = ZoteroDJVUConverter.TIMEOUT_CONVERSION;

      const checkInterval = setInterval(async () => {
        if (progress.cancelled) {
          clearInterval(checkInterval);
          await this.killBackgroundProcess(pidFile, "ddjvu");
          try { await IOUtils.remove(markerFile); } catch (e) {}
          try { await IOUtils.remove(errorFile); } catch (e) {}
          try { await IOUtils.remove(logFile); } catch (e) {}
          try { await IOUtils.remove(outputPath); } catch (e) {}
          this.log("DJVU conversion cancelled");
          reject(new Error("Cancelled by user"));
          return;
        }

        const elapsed = Date.now() - startTime;
        const elapsedSec = Math.floor(elapsed / 1000);

        // Parse log file for page progress
        let pageInfo = "";
        try {
          const logContent = await Zotero.File.getContentsAsync(logFile);
          const pageMatches = logContent.match(/-------- page (\d+) -------/g);
          if (pageMatches && pageMatches.length > 0) {
            const lastMatch = pageMatches[pageMatches.length - 1];
            const currentPage = lastMatch.match(/page (\d+)/)[1];
            pageInfo = totalPages ? ` • page ${currentPage}/${totalPages}` : ` • page ${currentPage}`;
          }
        } catch (e) {
          // Log file might not exist yet
        }

        progress.updateText(`Converting DJVU to PDF${pageInfo} • ${elapsedSec}s`);

        let done = false;
        let error = false;

        try { done = await IOUtils.exists(markerFile); } catch (e) {}
        try { error = await IOUtils.exists(errorFile); } catch (e) {}

        if (done) {
          clearInterval(checkInterval);
          try { await IOUtils.remove(markerFile); } catch (e) {}
          try { await IOUtils.remove(errorFile); } catch (e) {}
          try { await IOUtils.remove(logFile); } catch (e) {}
          try { await IOUtils.remove(pidFile); } catch (e) {}
          this.log("DJVU conversion complete");
          resolve(true);
        } else if (error) {
          clearInterval(checkInterval);
          // Log file contents for debugging before cleanup
          try {
            const logContent = await Zotero.File.getContentsAsync(logFile);
            this.log(`DJVU log file content (last 500 chars): ${logContent ? logContent.slice(-500) : 'empty'}`);
          } catch (e) {
            this.log(`Could not read log file: ${e.message}`);
          }
          try { await IOUtils.remove(errorFile); } catch (e) {}
          try { await IOUtils.remove(logFile); } catch (e) {}
          try { await IOUtils.remove(pidFile); } catch (e) {}
          this.log("DJVU conversion failed");
          reject(new Error("DJVU conversion failed - check if file is corrupted"));
        } else if (elapsed >= maxWait) {
          clearInterval(checkInterval);
          await this.killBackgroundProcess(pidFile, "ddjvu");
          try { await IOUtils.remove(markerFile); } catch (e) {}
          try { await IOUtils.remove(errorFile); } catch (e) {}
          try { await IOUtils.remove(logFile); } catch (e) {}
          this.log("DJVU conversion timeout");
          reject(new Error("DJVU conversion timed out"));
        }
      }, ZoteroDJVUConverter.POLL_INTERVAL_FAST);
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
