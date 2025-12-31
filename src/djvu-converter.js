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
  static MAX_BATCH_FILES = 10;           // Maximum files in batch conversion

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
    PROGRESS_DIALOG: `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: white;
      border-radius: 8px;
      padding: 16px 20px;
      min-width: 280px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #333;
      z-index: 10000;
      border: 1px solid #ccc;
    `,
    TITLE: "font-size: 16px; font-weight: bold; margin-bottom: 15px;",
    TITLE_SMALL: "font-size: 14px; font-weight: bold; margin-bottom: 10px;",
    LABEL: "font-weight: 500; margin-bottom: 10px;",
    LABEL_SMALL: "font-size: 12px; color: #666; margin-bottom: 6px;",
    MESSAGE: "margin-bottom: 20px; color: #666;",
    STATUS_TEXT: "margin-bottom: 8px; color: #666; min-height: 18px; font-size: 13px;",
    QUEUE_INFO: "margin-bottom: 12px; color: #888; font-size: 12px; display: none;",
    NOTE_DISABLED: "font-size: 11px; color: #999; margin-top: 4px;",
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
    CHECKBOX_SMALL: "margin-right: 4px; width: 14px; height: 14px;",
    BUTTONS_CONTAINER: "display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px;",
    SECTION: "margin-bottom: 16px;",
    INDENT: "margin-left: 24px; margin-bottom: 12px;",
    LANG_GRID: "display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px 12px;",
    LANG_OPTION: "display: flex; align-items: center; cursor: pointer; font-size: 12px;",
    RADIO_LABEL: "display: flex; align-items: center; margin-bottom: 8px; cursor: pointer;"
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
    const S = ZoteroDJVUConverter.STYLES;
    const label = doc.createElement("label");
    label.style.cssText = S.RADIO_LABEL + (disabled ? " cursor: default;" : "");
    if (disabled) label.style.color = "#999";

    const checkbox = doc.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = id;
    checkbox.checked = checked;
    checkbox.disabled = disabled;
    checkbox.style.cssText = S.CHECKBOX;

    label.appendChild(checkbox);
    label.appendChild(doc.createTextNode(labelText));

    return { label, checkbox };
  }

  // Create message/description text
  createMessage(doc, text) {
    const div = doc.createElement("div");
    div.textContent = text;
    div.style.cssText = ZoteroDJVUConverter.STYLES.MESSAGE;
    return div;
  }

  // Create section container
  createSection(doc) {
    const div = doc.createElement("div");
    div.style.cssText = ZoteroDJVUConverter.STYLES.SECTION;
    return div;
  }

  // Create language selection grid
  // Returns { container, getSelectedLanguages }
  createLanguageGrid(doc, defaultLanguages = ["eng"]) {
    const S = ZoteroDJVUConverter.STYLES;
    const languages = [
      { code: "eng", label: "English" },
      { code: "rus", label: "Russian" },
      { code: "deu", label: "German" },
      { code: "fra", label: "French" },
      { code: "spa", label: "Spanish" },
      { code: "ita", label: "Italian" },
      { code: "por", label: "Portuguese" },
      { code: "chi_sim", label: "Chinese" },
      { code: "jpn", label: "Japanese" },
      { code: "kor", label: "Korean" },
      { code: "ara", label: "Arabic" },
      { code: "ukr", label: "Ukrainian" }
    ];

    const container = doc.createElement("div");
    const grid = doc.createElement("div");
    grid.style.cssText = S.LANG_GRID;

    const checkboxes = [];
    for (const lang of languages) {
      const langOption = doc.createElement("label");
      langOption.style.cssText = S.LANG_OPTION;

      const check = doc.createElement("input");
      check.type = "checkbox";
      check.value = lang.code;
      check.checked = defaultLanguages.includes(lang.code);
      check.style.cssText = S.CHECKBOX_SMALL;
      checkboxes.push(check);

      langOption.appendChild(check);
      langOption.appendChild(doc.createTextNode(lang.label));
      grid.appendChild(langOption);
    }

    container.appendChild(grid);

    return {
      container,
      getSelectedLanguages: () => {
        const selected = checkboxes.filter(cb => cb.checked).map(cb => cb.value);
        return selected.length > 0 ? selected : ["eng"];
      }
    };
  }

  // Create radio button group
  // options: [{ id, label, checked }]
  // Returns { container, radios }
  createRadioGroup(doc, name, options) {
    const S = ZoteroDJVUConverter.STYLES;
    const container = doc.createElement("div");
    const radios = {};

    for (const opt of options) {
      const label = doc.createElement("label");
      label.style.cssText = S.RADIO_LABEL + (opt.last ? "" : " margin-bottom: 8px;");

      const radio = doc.createElement("input");
      radio.type = "radio";
      radio.name = name;
      radio.id = opt.id;
      radio.checked = opt.checked || false;
      radio.style.cssText = S.CHECKBOX;

      label.appendChild(radio);
      label.appendChild(doc.createTextNode(opt.label));
      container.appendChild(label);
      radios[opt.id] = radio;
    }

    return { container, radios };
  }

  // Create disabled feature note
  createDisabledNote(doc, text) {
    const note = doc.createElement("div");
    note.textContent = text;
    note.style.cssText = ZoteroDJVUConverter.STYLES.NOTE_DISABLED;
    return note;
  }

  constructor() {
    this.notifierID = null;
    this.ddjvuPath = null;
    this.ocrmypdfPath = null;
    this._menuPopupHandler = null;
    this._isProcessing = false; // Prevent concurrent conversions
    this._processingItemIds = new Set(); // Track items being processed to prevent duplicate notifier calls
    this._searchPaths = null; // Cached search paths
    this._activeProcesses = new Map(); // Track active background processes: pidFile -> processPattern

    // Operation queue system
    this._operationQueue = []; // Pending operations: {type, items, options, resolve, reject}
    this._currentOperation = null; // Currently running operation
    this._globalFileOffset = 0; // Files completed before current operation

    // Auto-convert debounce system - collect files over a time window
    this._pendingAutoConvertItems = []; // DJVU items waiting to be processed
    this._autoConvertTimer = null; // Debounce timer
  }

  // Queue an operation or run immediately if nothing is running
  async enqueueOperation(type, items, options = {}) {
    return new Promise((resolve, reject) => {
      const operation = { type, items, options, resolve, reject };

      if (this._currentOperation) {
        // Something is running, add to queue
        this._operationQueue.push(operation);
        this.log(`Queued ${type} operation (${items.length} items). Queue size: ${this._operationQueue.length}`);
        this.updateQueueDisplay();
      } else {
        // Nothing running, reset offset and start immediately
        this._globalFileOffset = 0;
        this.runOperation(operation);
      }
    });
  }

  // Run a single operation
  async runOperation(operation) {
    this._currentOperation = operation;

    // Calculate global totals for progress display
    const globalTotal = this._globalFileOffset + this.getTotalFilesInQueue();
    const globalOffset = this._globalFileOffset;

    this.log(`Starting ${operation.type} operation (${operation.items.length} items, global ${globalOffset + 1}-${globalOffset + operation.items.length}/${globalTotal})`);

    try {
      let result;
      switch (operation.type) {
        case "convert":
          result = await this.executeConversion(operation.items, operation.options, globalOffset, globalTotal);
          break;
        case "ocr":
          result = await this.executeOcr(operation.items, operation.options, globalOffset, globalTotal);
          break;
        case "compress":
          result = await this.executeCompress(operation.items, operation.options, globalOffset, globalTotal);
          break;
        default:
          throw new Error(`Unknown operation type: ${operation.type}`);
      }
      operation.resolve(result);
    } catch (e) {
      this.log(`Operation ${operation.type} failed: ${e.message}`);
      operation.reject(e);
    } finally {
      // Update offset for next operation
      this._globalFileOffset += operation.items.length;
      this._currentOperation = null;
      this.processNextInQueue();
    }
  }

  // Process next item in queue
  processNextInQueue() {
    if (this._operationQueue.length > 0) {
      const next = this._operationQueue.shift();
      this.log(`Processing next in queue: ${next.type} (${this._operationQueue.length} remaining)`);
      this.runOperation(next);
    }
  }

  // Update queue count in progress dialog
  updateQueueDisplay() {
    const win = Zotero.getMainWindow();
    if (!win) return;

    const queueInfo = win.document.getElementById("djvu-queue-info");
    const cancelAllBtn = win.document.getElementById("djvu-cancel-all-btn");
    const statusText = win.document.getElementById("djvu-progress-status");

    if (this._operationQueue.length > 0) {
      const queuedFiles = this._operationQueue.reduce((sum, op) => sum + op.items.length, 0);

      if (queueInfo) {
        queueInfo.textContent = `${queuedFiles} more in queue`;
        queueInfo.style.display = "block";
      }
      if (cancelAllBtn) cancelAllBtn.style.display = "inline-flex";

      // Update the [X/Y] in status text with new total
      if (statusText && this._currentOperation) {
        const newTotal = this._globalFileOffset + this.getTotalFilesInQueue();
        const currentFileNum = this._globalFileOffset + 1;
        const currentText = statusText.textContent;

        // Only show [X/Y] if total > 1 and fileNum is valid
        if (newTotal > 1 && currentFileNum <= newTotal) {
          // Check if there's already a [X/Y] pattern
          if (/\[\d+\/\d+\]/.test(currentText)) {
            // Replace [X/oldTotal] with [X/newTotal], but ensure X doesn't exceed newTotal
            statusText.textContent = currentText.replace(/\[(\d+)\/\d+\]/, (match, x) => {
              const fileNum = parseInt(x, 10);
              if (fileNum <= newTotal) return `[${fileNum}/${newTotal}]`;
              return match; // Keep original if invalid
            });
          } else {
            // No pattern yet - add [fileNum/newTotal] prefix
            statusText.textContent = `[${currentFileNum}/${newTotal}] ${currentText}`;
          }
        }
      }
    } else {
      if (queueInfo) queueInfo.style.display = "none";
      if (cancelAllBtn) cancelAllBtn.style.display = "none";
    }
  }

  // Cancel current operation and clear queue
  cancelAllOperations() {
    this.log("Cancelling all operations");

    // Clear queue first
    const queuedCount = this._operationQueue.length;
    for (const op of this._operationQueue) {
      op.reject(new Error("Cancelled by user"));
    }
    this._operationQueue = [];

    if (queuedCount > 0) {
      this.log(`Cleared ${queuedCount} queued operations`);
    }

    // Current operation cancel is handled by the progress controller
    return queuedCount;
  }

  // Get queue status
  getQueueStatus() {
    return {
      isRunning: this._currentOperation !== null,
      currentType: this._currentOperation?.type || null,
      queueLength: this._operationQueue.length
    };
  }

  // Get total file count across current operation and queue
  getTotalFilesInQueue() {
    let total = 0;
    if (this._currentOperation) {
      total += this._currentOperation.items.length;
    }
    for (const op of this._operationQueue) {
      total += op.items.length;
    }
    return total;
  }

  // Execute conversion operation (called by queue system)
  async executeConversion(items, options, globalOffset = 0, globalTotal = null) {
    const fileCount = items.length;
    this.log(`Executing conversion for ${fileCount} file(s)`);
    this._isProcessing = true;
    let progress = null;
    let successCount = 0;
    let failCount = 0;

    // Helper to get current total (dynamic - updates as queue changes)
    const getTotal = () => globalOffset + this.getTotalFilesInQueue();

    try {
      const total = getTotal();
      const globalNum = globalOffset + 1;
      progress = this.showProgress(total === 1 ? "Starting conversion..." : `[${globalNum}/${total}] Converting...`);

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const globalFileNum = globalOffset + i + 1;
        const currentTotal = getTotal();

        if (progress.cancelled) {
          this.log("Conversion cancelled by user");
          break;
        }

        try {
          const filePath = await this.validateDjvuAttachment(item);
          if (!filePath) {
            failCount++;
            continue;
          }

          const filename = this.truncateFilename(item.getField("title") || this.getBasename(filePath) || "file.djvu", 30);
          const getBatchPrefix = () => {
            const total = getTotal();
            // Never show [1/1] - only show prefix when there's more than 1 file total
            if (total <= 1 || globalFileNum > total) return "";
            return `[${globalFileNum}/${total}] `;
          };
          progress.updateText(`${getBatchPrefix()}Converting: ${filename}`);

          await this.convertSingleDjvu(item, filePath, options, progress, globalFileNum, getBatchPrefix);
          successCount++;
        } catch (e) {
          this.log(`Error converting file ${globalFileNum}: ${e.message}`);
          if (e.message.includes("Cancelled by user") || progress.cancelled) {
            break;
          }
          failCount++;
        }
      }

      // Show summary (only if this is the last operation or queue is empty)
      const hasMoreQueued = this._operationQueue.length > 0;
      if (!hasMoreQueued) {
        const finalTotal = getTotal();
        if (finalTotal === 1) {
          if (progress.cancelled) {
            progress.finish(false, "Conversion cancelled");
          } else if (successCount === 1) {
            progress.finish(true, "Converted successfully");
          } else {
            progress.finish(false, "Conversion failed");
          }
        } else {
          const totalSuccess = globalOffset + successCount;
          if (progress.cancelled) {
            progress.finish(false, `Cancelled after ${totalSuccess}/${finalTotal}`);
          } else if (failCount === 0) {
            progress.finish(true, `All ${finalTotal} files converted`);
          } else {
            progress.finish(false, `Done: ${successCount} converted, ${failCount} failed`);
          }
        }
      }

      return { successCount, failCount };
    } finally {
      this._isProcessing = false;
    }
  }

  // Execute OCR operation (called by queue system)
  async executeOcr(items, options, globalOffset = 0, globalTotal = null) {
    const fileCount = items.length;
    this.log(`Executing OCR for ${fileCount} file(s)`);
    this._isProcessing = true;
    let progress = null;
    let successCount = 0;
    let failCount = 0;

    // Helper to get current total (dynamic - updates as queue changes)
    const getTotal = () => globalOffset + this.getTotalFilesInQueue();

    try {
      const total = getTotal();
      const globalNum = globalOffset + 1;
      progress = this.showProgress(total === 1 ? "Adding OCR layer..." : `[${globalNum}/${total}] Adding OCR...`);

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const globalFileNum = globalOffset + i + 1;
        const currentTotal = getTotal();

        if (progress.cancelled) {
          this.log("OCR cancelled by user");
          break;
        }

        try {
          const filePath = await item.getFilePathAsync();
          if (!filePath) {
            failCount++;
            continue;
          }

          const filename = this.truncateFilename(item.getField("title") || this.getBasename(filePath) || "file.pdf", 30);
          const getBatchPrefix = () => {
            const total = getTotal();
            // Never show [1/1] - only show prefix when there's more than 1 file total
            if (total <= 1 || globalFileNum > total) return "";
            return `[${globalFileNum}/${total}] `;
          };
          progress.updateText(`${getBatchPrefix()}OCR: ${filename}`);

          await this.ocrSinglePdf(item, filePath, options, progress, globalFileNum, getBatchPrefix);
          successCount++;
        } catch (e) {
          this.log(`Error adding OCR to file ${globalFileNum}: ${e.message}`);
          if (e.message.includes("Cancelled by user") || progress.cancelled) {
            break;
          }
          failCount++;
        }
      }

      // Show summary (only if this is the last operation or queue is empty)
      const hasMoreQueued = this._operationQueue.length > 0;
      if (!hasMoreQueued) {
        const finalTotal = getTotal();
        if (finalTotal === 1) {
          if (progress.cancelled) {
            progress.finish(false, "OCR cancelled");
          } else if (successCount === 1) {
            progress.finish(true, "OCR added successfully");
          } else {
            progress.finish(false, "OCR failed");
          }
        } else {
          const totalSuccess = globalOffset + successCount;
          if (progress.cancelled) {
            progress.finish(false, `Cancelled after ${totalSuccess}/${finalTotal}`);
          } else if (failCount === 0) {
            progress.finish(true, `OCR added to all ${finalTotal} files`);
          } else {
            progress.finish(false, `Done: ${successCount} processed, ${failCount} failed`);
          }
        }
      }

      return { successCount, failCount };
    } finally {
      this._isProcessing = false;
    }
  }

  // Execute compression operation (called by queue system)
  async executeCompress(items, options, globalOffset = 0, globalTotal = null) {
    const fileCount = items.length;
    this.log(`Executing compression for ${fileCount} file(s)`);
    this._isProcessing = true;
    let progress = null;
    let successCount = 0;
    let failCount = 0;

    // Helper to get current total (dynamic - updates as queue changes)
    const getTotal = () => globalOffset + this.getTotalFilesInQueue();

    try {
      const total = getTotal();
      const globalNum = globalOffset + 1;
      progress = this.showProgress(total === 1 ? "Compressing PDF..." : `[${globalNum}/${total}] Compressing...`);

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const globalFileNum = globalOffset + i + 1;
        const currentTotal = getTotal();

        if (progress.cancelled) {
          this.log("Compression cancelled by user");
          break;
        }

        try {
          const filePath = await item.getFilePathAsync();
          if (!filePath) {
            failCount++;
            continue;
          }

          const filename = this.truncateFilename(item.getField("title") || this.getBasename(filePath) || "file.pdf", 30);
          const getBatchPrefix = () => {
            const total = getTotal();
            // Never show [1/1] - only show prefix when there's more than 1 file total
            // Also safeguard: only show if fileNum makes sense
            if (total <= 1 || globalFileNum > total) return "";
            return `[${globalFileNum}/${total}] `;
          };
          progress.updateText(`${getBatchPrefix()}Compressing: ${filename}`);

          await this.compressSinglePdf(item, filePath, options.compressLevel, progress, globalFileNum, getBatchPrefix);
          successCount++;
        } catch (e) {
          this.log(`Error compressing file ${globalFileNum}: ${e.message}`);
          if (e.message.includes("Cancelled by user") || progress.cancelled) {
            break;
          }
          failCount++;
        }
      }

      // Show summary (only if this is the last operation or queue is empty)
      const hasMoreQueued = this._operationQueue.length > 0;
      if (!hasMoreQueued) {
        const finalTotal = getTotal();
        if (finalTotal === 1) {
          if (progress.cancelled) {
            progress.finish(false, "Compression cancelled");
          } else if (successCount === 1) {
            progress.finish(true, "Compressed successfully");
          } else {
            progress.finish(false, "Compression failed");
          }
        } else {
          const totalSuccess = globalOffset + successCount;
          if (progress.cancelled) {
            progress.finish(false, `Cancelled after ${totalSuccess}/${finalTotal}`);
          } else if (failCount === 0) {
            progress.finish(true, `All ${finalTotal} files compressed`);
          } else {
            progress.finish(false, `Done: ${successCount} compressed, ${failCount} failed`);
          }
        }
      }

      return { successCount, failCount };
    } finally {
      this._isProcessing = false;
    }
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

  // Clean up orphaned temp files from previous crashes
  // Only cleans up files with our unique prefix (djvu_conv_) older than 1 hour
  async cleanupOrphanedTempFiles() {
    try {
      const tempDir = Zotero.getTempDirectory().path;
      const entries = await IOUtils.getChildren(tempDir);
      const now = Date.now();
      const ONE_HOUR = 60 * 60 * 1000;
      let cleanedCount = 0;

      for (const entryPath of entries) {
        try {
          const filename = PathUtils.filename(entryPath);

          // Only clean up files with our unique prefix
          if (!filename.startsWith("djvu_conv_")) continue;

          // Only clean up files older than 1 hour to avoid deleting active operation files
          const stat = await IOUtils.stat(entryPath);
          const fileAge = now - stat.lastModified;

          if (fileAge > ONE_HOUR) {
            await IOUtils.remove(entryPath, { ignoreAbsent: true });
            cleanedCount++;
          }
        } catch (e) {
          // Ignore errors for individual files
        }
      }

      if (cleanedCount > 0) {
        this.log(`Cleaned up ${cleanedCount} orphaned temp file(s)`);
      }
    } catch (e) {
      this.log(`Error cleaning up temp files: ${e.message}`);
    }
  }

  async init() {
    this.log("Initializing...");

    // Clean up orphaned temp files from previous crashes
    await this.cleanupOrphanedTempFiles();

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

      // Use temp directory for output file with safe name
      const tempDir = Zotero.getTempDirectory().path;
      const tempFile = PathUtils.join(tempDir, `djvu_conv_pagecount_${Date.now()}.txt`);

      if (this.isWindows()) {
        // Windows: use findstr instead of grep
        const escapedToolWin = this.escapeWindowsPath(this.pdfinfoPath);
        const escapedPdfWin = this.escapeWindowsPath(pdfPath);
        const escapedTempWin = this.escapeWindowsPath(tempFile);
        const cmd = `"${escapedToolWin}" "${escapedPdfWin}" 2>nul | findstr /i "^Pages:" > "${escapedTempWin}"`;
        await Zotero.Utilities.Internal.exec("cmd.exe", ["/c", cmd]);
      } else {
        // pdfPath is now a safe temp path with ASCII-only characters, no escaping needed
        await Zotero.Utilities.Internal.exec("/bin/sh", ["-c",
          `export LANG=en_US.UTF-8; "${this.pdfinfoPath}" "${pdfPath}" 2>/dev/null | grep -i "^Pages:" > "${tempFile}"`
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
      const tempFile = PathUtils.join(tempDir, `djvu_conv_which_${name}_${Date.now()}.txt`);

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

  async shutdown() {
    this.log("Shutting down...");

    // Clear auto-convert timer and pending items
    if (this._autoConvertTimer) {
      clearTimeout(this._autoConvertTimer);
      this._autoConvertTimer = null;
    }
    this._pendingAutoConvertItems = [];

    // Kill all active background processes
    if (this._activeProcesses && this._activeProcesses.size > 0) {
      this.log(`Killing ${this._activeProcesses.size} active process(es)...`);
      for (const [pidFile, processPattern] of this._activeProcesses) {
        try {
          await this.killBackgroundProcess(pidFile, processPattern);
          this.log(`Killed process: ${processPattern}`);
        } catch (e) {
          this.log(`Failed to kill process ${processPattern}: ${e.message}`);
        }
      }
      // Also kill tesseract on Windows if ocrmypdf was running
      if (this.isWindows()) {
        try {
          await Zotero.Utilities.Internal.exec("cmd.exe", ["/c", "taskkill /F /IM tesseract.exe 2>nul"]);
        } catch (e) {}
      }
      this._activeProcesses.clear();
    }

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
    this.log("handleManualConvert called");
    const zoteroPane = Zotero.getActiveZoteroPane();
    if (!zoteroPane) {
      this.log("No active ZoteroPane");
      return;
    }
    const items = zoteroPane.getSelectedItems();
    this.log(`Selected items: ${items ? items.length : 0}`);
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
    let djvuItems = this.collectAttachments(items, (item) => {
      const filename = (item.attachmentFilename || "").toLowerCase();
      return filename.endsWith(".djvu") || filename.endsWith(".djv");
    });

    // Filter out items already being processed
    djvuItems = djvuItems.filter(item => !this._processingItemIds.has(item.id));

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

    // Check batch limit
    if (djvuItems.length > ZoteroDJVUConverter.MAX_BATCH_FILES) {
      Services.prompt.alert(
        null,
        "DJVU to PDF Converter",
        `Too many files selected (${djvuItems.length}).\n\n` +
        `Please select at most ${ZoteroDJVUConverter.MAX_BATCH_FILES} DJVU files at a time.`
      );
      return;
    }

    // Show options dialog (single or batch)
    let options;
    if (djvuItems.length === 1) {
      const item = djvuItems[0];
      const filePath = await item.getFilePathAsync();
      const filename = item.getField("title") || this.getBasename(filePath) || "file.djvu";
      options = await this.showOptionsDialog(filename);
    } else {
      options = await this.showBatchOptionsDialog(djvuItems.length);
    }

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

    // Queue or execute the conversion
    await this.enqueueOperation("convert", djvuItems, options);
  }

  showBatchOptionsDialog(fileCount) {
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

      const S = ZoteroDJVUConverter.STYLES;
      dialog.appendChild(this.createTitle(doc, "DJVU to PDF Converter"));

      // File count message
      dialog.appendChild(this.createMessage(doc, `Convert ${fileCount} DJVU files to PDF?`));

      // Options label
      const optionsLabel = doc.createElement("div");
      optionsLabel.textContent = "Options (apply to all files):";
      optionsLabel.style.cssText = S.LABEL;
      dialog.appendChild(optionsLabel);

      // OCR checkbox
      const hasOcr = this.ocrmypdfFound && this.tesseractFound;
      const ocrText = hasOcr
        ? "Add OCR text layer (makes PDF searchable)"
        : "Add OCR text layer (not available - install ocrmypdf + tesseract)";
      const { label: ocrLabel, checkbox: ocrCheckbox } = this.createCheckbox(doc, "ocr-checkbox", ocrText, false, !hasOcr);
      dialog.appendChild(ocrLabel);

      // OCR Languages container (hidden initially)
      const langContainer = doc.createElement("div");
      langContainer.id = "djvu-lang-container";
      langContainer.style.cssText = S.INDENT + " display: none;";

      const langLabel = doc.createElement("div");
      langLabel.textContent = "OCR Languages:";
      langLabel.style.cssText = S.LABEL_SMALL;
      langContainer.appendChild(langLabel);

      const langGrid = doc.createElement("div");
      langGrid.style.cssText = S.LANG_GRID;

      const languages = this.getOcrLanguages();
      const langChecks = [];

      for (const lang of languages) {
        const langOption = doc.createElement("label");
        langOption.style.cssText = S.LANG_OPTION;
        const check = doc.createElement("input");
        check.type = "checkbox";
        check.value = lang.code;
        check.style.cssText = S.CHECKBOX_SMALL;
        if (lang.code === "eng") check.checked = true;
        langOption.appendChild(check);
        langOption.appendChild(doc.createTextNode(lang.name));
        langGrid.appendChild(langOption);
        langChecks.push(check);
      }

      langContainer.appendChild(langGrid);
      dialog.appendChild(langContainer);

      // Show/hide language selector based on OCR checkbox
      const updateLangVisibility = () => {
        langContainer.style.display = ocrCheckbox.checked ? "block" : "none";
      };
      ocrCheckbox.addEventListener("change", updateLangVisibility);

      // Compression dropdown
      const hasCompress = this.ocrmypdfFound;
      const compressContainer = this.createSection(doc);

      const compressLevelLabel = doc.createElement("div");
      compressLevelLabel.textContent = "PDF Compression:";
      compressLevelLabel.style.cssText = S.LABEL + ` margin-bottom: 8px; ${hasCompress ? "" : "color: #999;"}`;
      compressContainer.appendChild(compressLevelLabel);

      const compressLevels = [
        { value: "none", label: "None (no optimization)" },
        { value: "light", label: "Light (lossless, best quality)" },
        { value: "medium", label: "Medium (recommended)" },
        { value: "maximum", label: "Maximum (smallest file)" }
      ];
      const compressSelect = this.createSelect(doc, compressLevels, "none", !hasCompress);
      compressContainer.appendChild(compressSelect);

      if (!hasCompress) {
        compressContainer.appendChild(this.createDisabledNote(doc, "Install ocrmypdf to enable compression"));
      }
      dialog.appendChild(compressContainer);

      // After conversion label
      const afterLabel = doc.createElement("div");
      afterLabel.textContent = "After conversion:";
      afterLabel.style.cssText = S.LABEL;
      dialog.appendChild(afterLabel);

      // Replace/Keep radio group
      const { container: radioContainer, radios } = this.createRadioGroup(doc, "djvu-action", [
        { id: "replace", label: "Replace DJVU with PDF", checked: true },
        { id: "keep", label: "Keep both files", last: true }
      ]);
      radioContainer.style.marginBottom = "20px";
      dialog.appendChild(radioContainer);
      const replaceRadio = radios.replace;

      // Cleanup function
      const cleanup = () => {
        doc.removeEventListener("keydown", handleKeydown);
        if (overlay.parentNode) overlay.remove();
      };

      // Keyboard handler
      const handleKeydown = (e) => {
        if (e.key === "Escape") {
          cleanup();
          resolve(null);
        } else if (e.key === "Enter") {
          convertBtn.click();
        }
      };
      doc.addEventListener("keydown", handleKeydown);

      // Buttons
      const buttonContainer = this.createButtonsContainer(doc);

      const cancelBtn = this.createButton(doc, "Cancel", false, () => {
        cleanup();
        resolve(null);
      });

      const convertBtn = this.createButton(doc, `Convert ${fileCount} Files`, true, () => {
        const selectedLangs = langChecks.filter(c => c.checked).map(c => c.value);
        const ocrLangs = selectedLangs.length > 0 ? selectedLangs.join("+") : "eng";
        cleanup();
        resolve({
          addOcr: ocrCheckbox.checked,
          ocrLanguages: ocrLangs,
          compressLevel: compressSelect.value,
          deleteOriginal: replaceRadio.checked
        });
      });

      buttonContainer.appendChild(cancelBtn);
      buttonContainer.appendChild(convertBtn);
      dialog.appendChild(buttonContainer);

      overlay.appendChild(dialog);
      doc.documentElement.appendChild(overlay);
    });
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
    let pdfItems = this.collectAttachments(items, (item) => {
      const contentType = item.attachmentContentType;
      const filename = (item.attachmentFilename || "").toLowerCase();
      return contentType === "application/pdf" || filename.endsWith(".pdf");
    });

    // Filter out items already being processed
    pdfItems = pdfItems.filter(item => !this._processingItemIds.has(item.id));

    // Check if any PDF files found
    if (pdfItems.length === 0) {
      Services.prompt.alert(
        null,
        "DJVU to PDF Converter",
        "No PDF files found in selection.\n\nThis option only works with PDF files."
      );
      return;
    }

    this.log(`Found ${pdfItems.length} PDF file(s) for OCR`);

    // Check batch limit
    if (pdfItems.length > ZoteroDJVUConverter.MAX_BATCH_FILES) {
      Services.prompt.alert(
        null,
        "DJVU to PDF Converter",
        `Too many files selected (${pdfItems.length}).\n\n` +
        `Please select at most ${ZoteroDJVUConverter.MAX_BATCH_FILES} PDF files at a time.`
      );
      return;
    }

    // Show options dialog (single or batch)
    let options;
    if (pdfItems.length === 1) {
      const item = pdfItems[0];
      const filePath = await item.getFilePathAsync();
      const filename = item.getField("title") || this.getBasename(filePath) || "file.pdf";
      // Check if PDF already has text/OCR to show appropriate dialog
      const hasExistingText = await this.checkPdfHasText(filePath);
      options = await this.showOcrOptionsDialog(filename, hasExistingText);
      // If PDF has existing text and user didn't check forceOcr, set it based on dialog context
      if (options && hasExistingText) {
        options.forceOcr = true;
      }
    } else {
      options = await this.showBatchOcrOptionsDialog(pdfItems.length);
    }

    if (!options) {
      this.log("User cancelled OCR");
      return;
    }

    this.log(`OCR options: forceOcr=${options.forceOcr}, languages=${options.languages}, optimizeLevel=${options.optimizeLevel}`);

    // Queue or execute the OCR operation
    await this.enqueueOperation("ocr", pdfItems, options);
  }

  async ocrSinglePdf(item, filePath, options, progress, fileNum, getBatchPrefix) {
    const filename = this.getBasename(filePath);
    this.log(`OCR file ${fileNum}: ${filename}`);

    const ocrPdfPath = filePath.replace(/\.pdf$/i, "_ocr.pdf");
    const pageCount = await this.getPdfPageCount(filePath);

    try {
      const ocrSuccess = await this.runOcrWithProgress(
        filePath,
        ocrPdfPath,
        progress,
        options.forceOcr,
        options.languages,
        pageCount,
        options.optimizeLevel,
        false,
        getBatchPrefix
      );

      if (ocrSuccess && Zotero.File.pathToFile(ocrPdfPath).exists()) {
        // Check if cancelled BEFORE modifying original file
        if (progress.cancelled) {
          try { await IOUtils.remove(ocrPdfPath); } catch (err) {}
          throw new Error("Cancelled by user");
        }

        // Replace original with OCR version
        await IOUtils.remove(filePath);
        await IOUtils.move(ocrPdfPath, filePath);
        this.log(`Successfully added OCR to: ${filename}`);
      } else {
        throw new Error("OCR output not created");
      }
    } catch (e) {
      try { await IOUtils.remove(ocrPdfPath); } catch (err) {}
      throw e;
    }
  }

  showBatchOcrOptionsDialog(fileCount) {
    return new Promise((resolve) => {
      const win = Zotero.getMainWindow();
      if (!win) {
        resolve(null);
        return;
      }
      const doc = win.document;

      const existing = doc.getElementById("djvu-options-dialog");
      if (existing) existing.remove();

      const S = ZoteroDJVUConverter.STYLES;
      const overlay = this.createOverlay(doc, "djvu-options-dialog");
      const dialog = this.createDialog(doc);

      dialog.appendChild(this.createTitle(doc, "Add OCR Layer"));
      dialog.appendChild(this.createMessage(doc, `Add OCR text layer to ${fileCount} PDF files?`));

      // Force OCR checkbox
      const { label: forceLabel, checkbox: forceCheckbox } = this.createCheckbox(
        doc, "force-ocr-checkbox", "Force OCR (redo existing text)", false
      );
      dialog.appendChild(forceLabel);

      // Languages label
      const langLabel = doc.createElement("div");
      langLabel.textContent = "OCR Languages:";
      langLabel.style.cssText = S.LABEL;
      dialog.appendChild(langLabel);

      // Language checkboxes in a grid
      const langGrid = doc.createElement("div");
      langGrid.style.cssText = S.LANG_GRID + " margin-bottom: 16px;";

      const languages = this.getOcrLanguages();
      const langChecks = [];

      for (const lang of languages) {
        const langOption = doc.createElement("label");
        langOption.style.cssText = S.LANG_OPTION;
        const check = doc.createElement("input");
        check.type = "checkbox";
        check.value = lang.code;
        check.style.cssText = S.CHECKBOX_SMALL;
        if (lang.code === "eng") check.checked = true;
        langOption.appendChild(check);
        langOption.appendChild(doc.createTextNode(lang.name));
        langGrid.appendChild(langOption);
        langChecks.push(check);
      }
      dialog.appendChild(langGrid);

      // Compression dropdown
      const compressContainer = this.createSection(doc);

      const compressLevelLabel = doc.createElement("div");
      compressLevelLabel.textContent = "PDF Compression:";
      compressLevelLabel.style.cssText = S.LABEL + " margin-bottom: 8px;";
      compressContainer.appendChild(compressLevelLabel);

      const compressLevels = [
        { value: "1", label: "Light (lossless, best quality)" },
        { value: "2", label: "Medium (recommended)" },
        { value: "3", label: "Strong (smaller files)" }
      ];
      const compressSelect = this.createSelect(doc, compressLevels, "1");
      compressContainer.appendChild(compressSelect);
      dialog.appendChild(compressContainer);

      // Cleanup function
      const cleanup = () => {
        doc.removeEventListener("keydown", handleKeydown);
        if (overlay.parentNode) overlay.remove();
      };

      // Keyboard handler
      const handleKeydown = (e) => {
        if (e.key === "Escape") {
          cleanup();
          resolve(null);
        } else if (e.key === "Enter") {
          ocrBtn.click();
        }
      };
      doc.addEventListener("keydown", handleKeydown);

      // Buttons
      const buttonContainer = this.createButtonsContainer(doc);

      const cancelBtn = this.createButton(doc, "Cancel", false, () => {
        cleanup();
        resolve(null);
      });

      const ocrBtn = this.createButton(doc, `Add OCR to ${fileCount} Files`, true, () => {
        const selectedLangs = langChecks.filter(c => c.checked).map(c => c.value);
        cleanup();
        resolve({
          forceOcr: forceCheckbox.checked,
          languages: selectedLangs.length > 0 ? selectedLangs.join("+") : "eng",
          optimizeLevel: parseInt(compressSelect.value, 10)
        });
      });

      buttonContainer.appendChild(cancelBtn);
      buttonContainer.appendChild(ocrBtn);
      dialog.appendChild(buttonContainer);

      overlay.appendChild(dialog);
      doc.documentElement.appendChild(overlay);
    });
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
    let pdfItems = this.collectAttachments(items, (item) => {
      const contentType = item.attachmentContentType;
      const filename = (item.attachmentFilename || "").toLowerCase();
      return contentType === "application/pdf" || filename.endsWith(".pdf");
    });

    // Filter out items already being processed
    pdfItems = pdfItems.filter(item => !this._processingItemIds.has(item.id));

    // Check if any PDF files found
    if (pdfItems.length === 0) {
      Services.prompt.alert(
        null,
        "DJVU to PDF Converter",
        "No PDF files found in selection.\n\nThis option only works with PDF files."
      );
      return;
    }

    this.log(`Found ${pdfItems.length} PDF file(s) for compression`);

    // Check batch limit
    if (pdfItems.length > ZoteroDJVUConverter.MAX_BATCH_FILES) {
      Services.prompt.alert(
        null,
        "DJVU to PDF Converter",
        `Too many files selected (${pdfItems.length}).\n\n` +
        `Please select at most ${ZoteroDJVUConverter.MAX_BATCH_FILES} PDF files at a time.`
      );
      return;
    }

    // Show options dialog (single or batch)
    let compressLevel;
    if (pdfItems.length === 1) {
      const item = pdfItems[0];
      const filePath = await item.getFilePathAsync();
      const filename = item.getField("title") || this.getBasename(filePath) || "file.pdf";
      const fileSize = this.getFileSize(filePath);
      compressLevel = await this.showCompressionOptionsDialog(filename, fileSize);
    } else {
      compressLevel = await this.showBatchCompressionOptionsDialog(pdfItems.length);
    }

    if (!compressLevel) {
      this.log("User cancelled compression");
      return;
    }

    this.log(`Compression level: ${compressLevel}`);

    // Queue or execute the compression operation
    await this.enqueueOperation("compress", pdfItems, { compressLevel });
  }

  async compressSinglePdf(item, filePath, optimizeLevel, progress, fileNum, getBatchPrefix) {
    const filename = this.getBasename(filePath);
    this.log(`Compressing file ${fileNum}: ${filename}`);

    const compressedPath = filePath.replace(/\.pdf$/i, "_compressed.pdf");
    const pageCount = await this.getPdfPageCount(filePath);

    try {
      const success = await this.runOcrWithProgress(
        filePath,
        compressedPath,
        progress,
        false,      // forceOcr
        "eng",      // languages (not used when skipOcr=true)
        pageCount,
        optimizeLevel,
        true,       // skipOcr - only compress, no OCR
        getBatchPrefix
      );

      if (success && Zotero.File.pathToFile(compressedPath).exists()) {
        // Check if cancelled BEFORE modifying original file
        if (progress.cancelled) {
          try { await IOUtils.remove(compressedPath); } catch (err) {}
          throw new Error("Cancelled by user");
        }

        // Compare file sizes - only replace if compressed is smaller
        let inputSize = 0, outputSize = 0;
        try {
          inputSize = Zotero.File.pathToFile(filePath).fileSize;
          outputSize = Zotero.File.pathToFile(compressedPath).fileSize;
        } catch (err) {}

        if (outputSize > 0 && outputSize < inputSize) {
          // Compressed file is smaller - replace original
          await IOUtils.remove(filePath);
          await IOUtils.move(compressedPath, filePath);
          const savings = Math.round((1 - outputSize / inputSize) * 100);
          this.log(`Successfully compressed: ${filename} (${savings}% smaller)`);
        } else {
          // Compressed file is same size or larger - keep original
          try { await IOUtils.remove(compressedPath); } catch (err) {}
          this.log(`Skipped ${filename}: compression would not reduce size`);
        }
      } else {
        throw new Error("Compression output not created");
      }
    } catch (e) {
      try { await IOUtils.remove(compressedPath); } catch (err) {}
      throw e;
    }
  }

  showBatchCompressionOptionsDialog(fileCount) {
    return new Promise((resolve) => {
      const win = Zotero.getMainWindow();
      if (!win) {
        resolve(null);
        return;
      }
      const doc = win.document;

      const existing = doc.getElementById("djvu-options-dialog");
      if (existing) existing.remove();

      const S = ZoteroDJVUConverter.STYLES;
      const overlay = this.createOverlay(doc, "djvu-options-dialog");
      const dialog = this.createDialog(doc);

      dialog.appendChild(this.createTitle(doc, "Compress PDF Files"));
      dialog.appendChild(this.createMessage(doc, `Compress ${fileCount} PDF files?`));

      // Compression level selector
      const compressContainer = this.createSection(doc);

      const levelLabel = doc.createElement("div");
      levelLabel.textContent = "Compression level:";
      levelLabel.style.cssText = S.LABEL + " margin-bottom: 8px;";
      compressContainer.appendChild(levelLabel);

      const levels = [
        { value: "light", label: "Light (lossless, best quality)" },
        { value: "medium", label: "Medium (recommended)" },
        { value: "strong", label: "Strong (smaller files)" },
        { value: "maximum", label: "Maximum (smallest files)" }
      ];
      const levelSelect = this.createSelect(doc, levels, "medium");
      compressContainer.appendChild(levelSelect);
      dialog.appendChild(compressContainer);

      // Cleanup function
      const cleanup = () => {
        doc.removeEventListener("keydown", handleKeydown);
        if (overlay.parentNode) overlay.remove();
      };

      // Keyboard handler
      const handleKeydown = (e) => {
        if (e.key === "Escape") {
          cleanup();
          resolve(null);
        } else if (e.key === "Enter") {
          compressBtn.click();
        }
      };
      doc.addEventListener("keydown", handleKeydown);

      // Buttons
      const buttonContainer = this.createButtonsContainer(doc);

      const cancelBtn = this.createButton(doc, "Cancel", false, () => {
        cleanup();
        resolve(null);
      });

      const compressBtn = this.createButton(doc, `Compress ${fileCount} Files`, true, () => {
        cleanup();
        resolve(levelSelect.value);
      });

      buttonContainer.appendChild(cancelBtn);
      buttonContainer.appendChild(compressBtn);
      dialog.appendChild(buttonContainer);

      overlay.appendChild(dialog);
      doc.documentElement.appendChild(overlay);
    });
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

      const S = ZoteroDJVUConverter.STYLES;
      const overlay = this.createOverlay(doc, "djvu-ocr-dialog");
      const dialog = this.createDialog(doc);

      dialog.appendChild(this.createTitle(doc, hasExistingText ? "Redo OCR" : "Add OCR Layer"));

      // Message
      const truncatedName = this.truncateFilename(filename);
      const messageText = hasExistingText
        ? `"${truncatedName}" already appears to have text/OCR. Redo the OCR?`
        : `Add OCR text layer to "${truncatedName}"?`;
      dialog.appendChild(this.createMessage(doc, messageText));

      // Languages label
      const langLabel = doc.createElement("div");
      langLabel.textContent = "OCR Languages:";
      langLabel.style.cssText = S.LABEL;
      dialog.appendChild(langLabel);

      // Language checkboxes in a grid
      const langGrid = doc.createElement("div");
      langGrid.style.cssText = S.LANG_GRID + " margin-bottom: 16px;";

      const languages = this.getOcrLanguages();
      const langChecks = [];

      for (const lang of languages) {
        const langOption = doc.createElement("label");
        langOption.style.cssText = S.LANG_OPTION;
        const check = doc.createElement("input");
        check.type = "checkbox";
        check.value = lang.code;
        check.style.cssText = S.CHECKBOX_SMALL;
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
      optimizeLabel.style.cssText = S.LABEL + " margin-bottom: 8px;";
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
    });
  }

  showCompressionOptionsDialog(filename, fileSize) {
    const window = Zotero.getMainWindow();
    const doc = window.document;

    return new Promise((resolve) => {
      const S = ZoteroDJVUConverter.STYLES;
      const overlay = this.createOverlay(doc, "djvu-compression-dialog-overlay");
      const dialog = this.createDialog(doc);

      dialog.appendChild(this.createTitle(doc, "Compress PDF"));

      // Message
      const truncatedName = this.truncateFilename(filename);
      dialog.appendChild(this.createMessage(doc, `Compress "${truncatedName}" (${this.formatSize(fileSize)})?`));

      // Compression level label
      const levelLabel = doc.createElement("div");
      levelLabel.textContent = "Compression Level:";
      levelLabel.style.cssText = S.LABEL + " margin-bottom: 8px;";
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
        // Compare file sizes BEFORE replacing - only replace if compressed is smaller
        let outputSize = 0;
        try {
          outputSize = Zotero.File.pathToFile(compressedPath).fileSize;
        } catch (e) {}

        if (outputSize > 0 && outputSize < inputSize) {
          // Compressed file is smaller - replace original
          await IOUtils.remove(filePath);
          await IOUtils.move(compressedPath, filePath);

          const savings = inputSize > 0 ? Math.round((1 - outputSize / inputSize) * 100) : 0;
          const sizeInfo = `${this.formatSize(inputSize)} → ${this.formatSize(outputSize)} (${savings}% smaller)`;
          progress.finish(true, "Compressed! " + sizeInfo);
          this.log("PDF compressed successfully");
        } else {
          // Compressed file is same size or larger - keep original
          try { await IOUtils.remove(compressedPath); } catch (e) {}
          progress.finish(true, "Original kept - compression would increase file size");
          this.log("Compression skipped - output would be larger than input");
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
    const DEBOUNCE_MS = 200; // Collect files for 0.2 seconds before showing dialog

    const callback = {
      notify: async function (event, type, ids, extraData) {
        try {
          self.log(`Notifier triggered: event=${event}, type=${type}, ids=${JSON.stringify(ids)}`);

          if (event === "add" && type === "item") {
            // Wait a bit for Zotero to finish processing the items
            await Zotero.Promise.delay(300);

            // Check each item and add valid DJVU files to pending list
            for (const id of ids) {
              const item = await self.getDjvuItemIfValid(id);
              if (item) {
                // Avoid duplicates
                if (!self._pendingAutoConvertItems.some(i => i.id === item.id)) {
                  self._pendingAutoConvertItems.push(item);
                  self.log(`Added DJVU to pending list: ${item.getField("title")} (${self._pendingAutoConvertItems.length} pending)`);
                }
              }
            }

            // Reset debounce timer - process after DEBOUNCE_MS of no new files
            if (self._autoConvertTimer) {
              clearTimeout(self._autoConvertTimer);
            }

            if (self._pendingAutoConvertItems.length > 0) {
              self._autoConvertTimer = setTimeout(async () => {
                try {
                  const items = self._pendingAutoConvertItems.slice(); // Copy array
                  self._pendingAutoConvertItems = []; // Clear pending
                  self._autoConvertTimer = null;

                  self.log(`Debounce complete: processing ${items.length} DJVU file(s)`);
                  await self.handleAutoConvert(items);
                } catch (e) {
                  self.log(`Error in auto-convert timer: ${e.message}`);
                }
              }, DEBOUNCE_MS);
            }
          }
        } catch (e) {
          self.log(`Error in notifier callback: ${e.message}`);
        }
      },
    };

    this.notifierID = Zotero.Notifier.registerObserver(callback, ["item"], "djvuConverter");
    this.log(`Notifier registered with ID: ${this.notifierID}`);
  }

  // Check if an item ID is a valid DJVU attachment for auto-conversion
  async getDjvuItemIfValid(id) {
    try {
      // Prevent duplicate processing
      if (this._processingItemIds.has(id)) {
        this.log(`Item ${id} is already being processed, skipping`);
        return null;
      }

      const item = await Zotero.Items.getAsync(id);
      if (!item || item.deleted || !item.isAttachment()) {
        return null;
      }

      // Check if it's a DJVU file
      const filePath = await this.validateDjvuAttachment(item);
      if (!filePath) {
        return null;
      }

      this.log(`DJVU file detected: ${item.getField("title") || this.getBasename(filePath)}`);
      return item;
    } catch (e) {
      this.log(`Error checking item ${id}: ${e.message}`);
      return null;
    }
  }

  // Handle automatic conversion of DJVU files added to library
  async handleAutoConvert(djvuItems) {
    if (djvuItems.length === 0) return;

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

    // Show options dialog (single or batch)
    let options;
    if (djvuItems.length === 1) {
      const item = djvuItems[0];
      const filePath = await item.getFilePathAsync();
      const filename = item.getField("title") || this.getBasename(filePath) || "file.djvu";
      options = await this.showOptionsDialog(filename);
    } else {
      options = await this.showBatchOptionsDialog(djvuItems.length);
    }

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

    this.log(`Auto-convert options: OCR=${options.addOcr}, compressLevel=${options.compressLevel}, deleteOriginal=${options.deleteOriginal}`);

    // Mark items as being processed to prevent duplicate handling
    const itemIds = djvuItems.map(item => item.id);
    for (const id of itemIds) {
      this._processingItemIds.add(id);
    }

    // Queue the conversion operation
    await this.enqueueOperation("convert", djvuItems, options);

    // Clear processing markers after a delay to prevent race conditions
    // The delay ensures the queue has time to start processing before IDs are cleared
    setTimeout(() => {
      for (const id of itemIds) {
        this._processingItemIds.delete(id);
      }
    }, 60000); // 60 seconds should be plenty for queue to pick up items
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

      const S = ZoteroDJVUConverter.STYLES;
      const overlay = this.createOverlay(doc, "djvu-options-dialog");
      const dialog = this.createDialog(doc);

      dialog.appendChild(this.createTitle(doc, "DJVU to PDF Converter"));
      dialog.appendChild(this.createMessage(doc, `Convert "${this.truncateFilename(filename)}" to PDF?`));

      // Options label
      const optLabel = doc.createElement("div");
      optLabel.textContent = "Options:";
      optLabel.style.cssText = S.LABEL;
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
      langContainer.style.cssText = S.INDENT + " display: none;";

      const langLabel = doc.createElement("div");
      langLabel.textContent = "OCR Languages:";
      langLabel.style.cssText = S.LABEL_SMALL;
      langContainer.appendChild(langLabel);

      // Language checkboxes in a grid
      const langGrid = doc.createElement("div");
      langGrid.style.cssText = S.LANG_GRID;

      const languages = this.getOcrLanguages();
      const langChecks = [];

      for (const lang of languages) {
        const langOption = doc.createElement("label");
        langOption.style.cssText = S.LANG_OPTION;
        const check = doc.createElement("input");
        check.type = "checkbox";
        check.value = lang.code;
        check.style.cssText = S.CHECKBOX_SMALL;
        if (lang.code === "eng") check.checked = true;
        langOption.appendChild(check);
        langOption.appendChild(doc.createTextNode(lang.name));
        langGrid.appendChild(langOption);
        langChecks.push(check);
      }

      langContainer.appendChild(langGrid);
      dialog.appendChild(langContainer);

      // Compression dropdown (always visible, independent of OCR)
      const compressContainer = this.createSection(doc);
      const compressAvailable = this.ocrmypdfFound;

      const compressLevelLabel = doc.createElement("div");
      compressLevelLabel.textContent = "PDF Compression:";
      compressLevelLabel.style.cssText = S.LABEL + ` margin-bottom: 8px; ${compressAvailable ? "" : "color: #999;"}`;
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
        compressContainer.appendChild(this.createDisabledNote(doc, "Install ocrmypdf to enable compression"));
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
      afterLabel.style.cssText = S.LABEL;
      dialog.appendChild(afterLabel);

      // Replace/Keep radio group
      const { container: radioContainer, radios } = this.createRadioGroup(doc, "djvu-action", [
        { id: "replace", label: "Replace DJVU with PDF", checked: true },
        { id: "keep", label: "Keep both files", last: true }
      ]);
      radioContainer.style.marginBottom = "20px";
      dialog.appendChild(radioContainer);
      const replaceRadio = radios.replace;

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

    // Create non-blocking floating dialog (no overlay)
    const S = ZoteroDJVUConverter.STYLES;
    const dialog = doc.createElement("div");
    dialog.id = "djvu-progress-dialog";
    dialog.style.cssText = S.PROGRESS_DIALOG;

    // Title
    const title = doc.createElement("div");
    title.textContent = "DJVU to PDF Converter";
    title.style.cssText = S.TITLE_SMALL;
    dialog.appendChild(title);

    // Status text
    const statusText = doc.createElement("div");
    statusText.id = "djvu-progress-status";
    statusText.textContent = message;
    statusText.style.cssText = S.STATUS_TEXT;
    dialog.appendChild(statusText);

    // Queue info (hidden by default, shown when items are queued)
    const queueInfo = doc.createElement("div");
    queueInfo.id = "djvu-queue-info";
    queueInfo.style.cssText = S.QUEUE_INFO;
    dialog.appendChild(queueInfo);

    // Update queue display initially
    if (this._operationQueue.length > 0) {
      queueInfo.textContent = `${this._operationQueue.length} more in queue`;
      queueInfo.style.display = "block";
    }

    // Buttons container
    const buttonsContainer = doc.createElement("div");
    buttonsContainer.style.cssText = "display: flex; gap: 8px;";

    // Cancel Current button
    const cancelBtn = doc.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.style.cssText = S.BUTTON_BASE + S.BUTTON_DANGER + " flex: 1; padding: 8px 16px;";
    cancelBtn.onmouseenter = () => { cancelBtn.style.background = "linear-gradient(to bottom, #ee3333, #aa0000)"; };
    cancelBtn.onmouseleave = () => { cancelBtn.style.background = "linear-gradient(to bottom, #ff4444, #cc0000)"; };
    buttonsContainer.appendChild(cancelBtn);

    // Cancel All button (only visible when queue has items)
    const cancelAllBtn = doc.createElement("button");
    cancelAllBtn.id = "djvu-cancel-all-btn";
    cancelAllBtn.textContent = "Cancel All";
    cancelAllBtn.style.cssText = S.BUTTON_BASE + S.BUTTON_SECONDARY + " padding: 8px 12px; display: none;";
    cancelAllBtn.onmouseenter = () => { cancelAllBtn.style.background = "linear-gradient(to bottom, #e8e8e8, #d8d8d8)"; };
    cancelAllBtn.onmouseleave = () => { cancelAllBtn.style.background = "linear-gradient(to bottom, #f8f8f8, #e8e8e8)"; };
    buttonsContainer.appendChild(cancelAllBtn);

    // Show Cancel All button if queue has items
    if (this._operationQueue.length > 0) {
      cancelAllBtn.style.display = "inline-flex";
    }

    dialog.appendChild(buttonsContainer);

    doc.documentElement.appendChild(dialog);

    // Progress controller object
    const controller = {
      cancelled: false,
      finished: false,
      dialog: dialog,
      updateText: (text) => {
        if (!controller.cancelled && !controller.finished && dialog.parentNode) {
          statusText.textContent = text;
        }
      },
      setProgress: (percent) => {}, // No-op for backward compatibility
      finish: (success, msg) => {
        if (controller.finished || !dialog.parentNode) return;
        controller.finished = true;

        // If cancelled, just close the dialog immediately
        if (controller.cancelled) {
          dialog.remove();
          return;
        }

        statusText.textContent = msg || (success ? "Done!" : "Failed");
        statusText.style.color = success ? "#00aa00" : "#cc0000";

        // Hide queue info and Cancel All button
        queueInfo.style.display = "none";
        cancelAllBtn.style.display = "none";

        // Switch to secondary style - button becomes "Close"
        cancelBtn.textContent = "Close";
        cancelBtn.style.cssText = S.BUTTON_BASE + S.BUTTON_SECONDARY + " flex: 1; padding: 8px 16px;";
        cancelBtn.style.opacity = "1";
        cancelBtn.onmouseenter = () => { cancelBtn.style.background = "linear-gradient(to bottom, #e8e8e8, #d8d8d8)"; };
        cancelBtn.onmouseleave = () => { cancelBtn.style.background = "linear-gradient(to bottom, #f8f8f8, #e8e8e8)"; };
      },
      close: () => { if (dialog.parentNode) dialog.remove(); }
    };

    // Cancel current operation button handler
    cancelBtn.onclick = () => {
      if (!dialog.parentNode) return;
      if (controller.cancelled || controller.finished) {
        dialog.remove();
        return;
      }
      controller.cancelled = true;
      statusText.textContent = "Cancelling...";
      cancelBtn.style.opacity = "0.7";
      this.log("User cancelled current operation");
    };

    // Cancel all operations button handler
    cancelAllBtn.onclick = () => {
      if (!dialog.parentNode) return;
      if (controller.finished) return;

      // Cancel current
      controller.cancelled = true;

      // Clear queue
      const cleared = this.cancelAllOperations();

      statusText.textContent = cleared > 0 ? `Cancelling... (cleared ${cleared} queued)` : "Cancelling...";
      cancelBtn.style.opacity = "0.7";
      cancelAllBtn.style.display = "none";
      queueInfo.style.display = "none";
      this.log("User cancelled all operations");
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

  // Convert a single DJVU file (used by batch conversion)
  async convertSingleDjvu(item, filePath, options, progress, fileNum, getBatchPrefix) {
    const filename = this.getBasename(filePath);
    this.log(`Converting file ${fileNum}: ${filename}`);

    // Step 1: Convert DJVU to PDF
    const tempPdfPath = filePath.replace(/\.(djvu|djv)$/i, ".pdf");
    this.log(`Converting: ${filePath} -> ${tempPdfPath}`);

    await this.runDdjvuWithProgress(filePath, tempPdfPath, progress, getBatchPrefix);

    // Check if output file exists
    let outputExists = false;
    try {
      outputExists = Zotero.File.pathToFile(tempPdfPath).exists();
    } catch (e) {
      this.log(`Error checking output file: ${e.message}`);
    }

    if (!outputExists) {
      throw new Error(`DJVU to PDF conversion failed for ${filename}`);
    }

    // Check if cancelled
    if (progress.cancelled) {
      try { await IOUtils.remove(tempPdfPath); } catch (e) {}
      throw new Error("Cancelled by user");
    }

    // Step 2: Run ocrmypdf for OCR and/or compression
    const needsOcr = options.addOcr;
    const needsCompression = options.compressLevel && options.compressLevel !== "none";
    const optimizeLevel = ZoteroDJVUConverter.getOptimizeLevel(options.compressLevel);

    if ((needsOcr || needsCompression) && this.ocrmypdfFound) {
      const ocrPdfPath = tempPdfPath.replace(/\.pdf$/i, "_ocr.pdf");
      const pageCount = await this.getPdfPageCount(tempPdfPath);

      try {
        const ocrSuccess = await this.runOcrWithProgress(
          tempPdfPath,
          ocrPdfPath,
          progress,
          false,
          options.ocrLanguages || "eng",
          pageCount,
          optimizeLevel,
          !needsOcr,
          getBatchPrefix
        );

        if (ocrSuccess && Zotero.File.pathToFile(ocrPdfPath).exists()) {
          await IOUtils.remove(tempPdfPath);
          await IOUtils.move(ocrPdfPath, tempPdfPath);
        }
      } catch (ocrError) {
        if (ocrError.message.includes("Cancelled by user") || progress.cancelled) {
          try { await IOUtils.remove(tempPdfPath); } catch (e) {}
          try { await IOUtils.remove(ocrPdfPath); } catch (e) {}
          throw new Error("Cancelled by user");
        }
        // Continue with original PDF on OCR failure
        this.log(`Processing failed for ${filename}: ${ocrError.message}`);
        try { await IOUtils.remove(ocrPdfPath); } catch (e) {}
      }
    }

    // Final cancellation check
    if (progress.cancelled) {
      try { await IOUtils.remove(tempPdfPath); } catch (e) {}
      throw new Error("Cancelled by user");
    }

    // Step 3: Update Zotero library
    try {
      const itemStillExists = await Zotero.Items.getAsync(item.id);
      if (!itemStillExists || itemStillExists.deleted) {
        throw new Error("Item was deleted during conversion");
      }
    } catch (e) {
      // Save to temp if item was deleted
      const tempDir = Zotero.getTempDirectory().path;
      const tempDest = PathUtils.join(tempDir, "djvu_conv_converted_" + Date.now() + ".pdf");
      await IOUtils.move(tempPdfPath, tempDest);
      throw new Error(`Item deleted. PDF saved to: ${tempDest}`);
    }

    if (options.deleteOriginal) {
      await this.replaceAttachment(item, tempPdfPath);
    } else {
      await this.addPDFSibling(item, tempPdfPath);
    }

    this.log(`Successfully converted: ${filename}`);
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

  // Clean up OCR marker and log files by tempId
  async cleanupOcrMarkerFiles(tempId) {
    if (!tempId) return;

    const tempDir = Zotero.getTempDirectory().path;
    const files = [
      PathUtils.join(tempDir, `${tempId}.done`),
      PathUtils.join(tempDir, `${tempId}.error`),
      PathUtils.join(tempDir, `${tempId}.log`),
      PathUtils.join(tempDir, `${tempId}.pid`)
    ];
    for (const file of files) {
      try { await IOUtils.remove(file); } catch (e) {}
    }
  }

  async runOcrWithProgress(inputPath, outputPath, progress, forceOcr = false, languages = "eng", pageCount = null, optimizeLevel = 1, skipOcr = false, getBatchPrefix = () => "") {
    const modeDesc = skipOcr ? "compression-only" : (forceOcr ? "force-OCR" : "OCR");
    this.log(`Starting ${modeDesc} process...`);

    // Use temp directory with safe ASCII filenames to avoid shell escaping issues
    // with special characters (brackets, !, Cyrillic, etc.) in original paths
    const tempDir = Zotero.getTempDirectory().path;
    const tempId = `djvu_conv_ocr_${Date.now()}`;
    const tempInputPath = PathUtils.join(tempDir, `${tempId}_input.pdf`);
    const tempOutputPath = PathUtils.join(tempDir, `${tempId}_output.pdf`);
    const errorLogFile = PathUtils.join(tempDir, `${tempId}.log`);
    const pidFile = PathUtils.join(tempDir, `${tempId}.pid`);
    const markerFile = PathUtils.join(tempDir, `${tempId}.done`);
    const errorFile = PathUtils.join(tempDir, `${tempId}.error`);

    // Copy input file to temp location with safe name
    try {
      await IOUtils.copy(inputPath, tempInputPath);
      this.log(`Copied input to temp: ${tempInputPath}`);
    } catch (e) {
      throw new Error(`Failed to copy input file: ${e.message}`);
    }

    // Get page count from temp file (after copy, so path is safe for shell)
    // This overrides any passed pageCount since that may have failed with special chars
    const actualPageCount = await this.getPdfPageCount(tempInputPath);
    if (actualPageCount) {
      pageCount = actualPageCount;
    }
    this.log(`Languages: ${languages}, pages: ${pageCount || "unknown"}, optimize: -O ${optimizeLevel}, skipOcr: ${skipOcr}`);

    // Build command using helper with safe temp paths
    const ocrCmd = this.buildOcrmypdfCommand(tempInputPath, tempOutputPath, errorLogFile, {
      forceOcr, languages, optimizeLevel, skipOcr
    });
    this.log(`OCR command: ${ocrCmd}`);

    // Clean up any leftover files from previous cancelled runs
    await this.cleanupOcrMarkerFiles(tempId);
    try { await IOUtils.remove(tempOutputPath); } catch (e) {}
    try { await IOUtils.remove(outputPath); } catch (e) {}

    // Start background process
    this.startBackgroundProcess(ocrCmd, markerFile, errorFile, pidFile);
    this._activeProcesses.set(pidFile, "ocrmypdf");

    // Helper to clean up all temp files
    const cleanupTempFiles = async () => {
      try { await IOUtils.remove(tempInputPath); } catch (e) {}
      try { await IOUtils.remove(tempOutputPath); } catch (e) {}
      await this.cleanupOcrMarkerFiles(tempId);
    };

    // Poll for completion with progress updates
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const maxWait = ZoteroDJVUConverter.TIMEOUT_OCR;

      const checkInterval = setInterval(async () => {
        try {
          // Check if cancelled
          if (progress.cancelled) {
            clearInterval(checkInterval);
            await this.killBackgroundProcess(pidFile, "ocrmypdf");
            this._activeProcesses.delete(pidFile);
            if (this.isWindows()) {
              try {
                await Zotero.Utilities.Internal.exec("cmd.exe", ["/c", "taskkill /F /IM tesseract.exe 2>nul"]);
              } catch (e) {}
            }
            await cleanupTempFiles();
            this.log("OCR cancelled by user");
            reject(new Error("Cancelled by user"));
            return;
          }

          const elapsed = Date.now() - startTime;
          const elapsedSec = Math.floor(elapsed / 1000);

          // Parse progress from log file using helper
          const { statusText, pageInfo } = await this.parseOcrProgress(errorLogFile, pageCount, skipOcr);
          progress.updateText(`${getBatchPrefix()}${statusText}${pageInfo} • ${elapsedSec}s`);

          // Check if done
          let done = false;
          let error = false;

          try { done = await IOUtils.exists(markerFile); } catch (e) {}
          try { error = await IOUtils.exists(errorFile); } catch (e) {}

          if (done) {
            clearInterval(checkInterval);
            this._activeProcesses.delete(pidFile);
            // Copy temp output to final destination
            try {
              await IOUtils.copy(tempOutputPath, outputPath);
              this.log(`Copied output to: ${outputPath}`);
            } catch (e) {
              await cleanupTempFiles();
              this.log(`Failed to copy output: ${e.message}`);
              reject(new Error(`Failed to save PDF: ${e.message}`));
              return;
            }
            await cleanupTempFiles();
            progress.setProgress(79);
            const completeMsg = skipOcr ? "Compression complete!" :
              optimizeLevel > 0 ? "OCR & optimization complete!" : "OCR complete!";
            progress.updateText(completeMsg);
            this.log(skipOcr ? "Compression completed successfully" : "OCR completed successfully");
            resolve(true);
          } else if (error) {
            clearInterval(checkInterval);
            this._activeProcesses.delete(pidFile);
            const modeLabel = skipOcr ? "Compression" : "OCR";
            let errorMsg = `${modeLabel} processing failed`;
            try {
              const logContent = await Zotero.File.getContentsAsync(errorLogFile);
              if (logContent && logContent.trim()) {
                const lines = logContent.trim().split("\n");
                errorMsg = lines.slice(-3).join(" ").substring(0, 200);
              }
            } catch (e) {}
            await cleanupTempFiles();
            this.log(`${modeLabel} failed: ${errorMsg}`);
            reject(new Error(errorMsg));
          } else if (elapsed >= maxWait) {
            clearInterval(checkInterval);
            await this.killBackgroundProcess(pidFile, "ocrmypdf");
            this._activeProcesses.delete(pidFile);
            if (this.isWindows()) {
              try {
                await Zotero.Utilities.Internal.exec("cmd.exe", ["/c", "taskkill /F /IM tesseract.exe 2>nul"]);
              } catch (e) {}
            }
            await cleanupTempFiles();
            const modeLabel = skipOcr ? "Compression" : "OCR";
            this.log(`${modeLabel} timeout after ${elapsedSec} seconds`);
            reject(new Error(`${modeLabel} timed out after 10 minutes`));
          }
        } catch (e) {
          clearInterval(checkInterval);
          this.log(`Error in OCR polling: ${e.message}`);
          await cleanupTempFiles();
          reject(e);
        }
      }, ZoteroDJVUConverter.POLL_INTERVAL_SLOW);
    });
  }

  async getDjvuPageCount(inputPath) {
    try {
      // Find djvused - try same directory as ddjvu first, then search PATH
      let djvusedPath = this.ddjvuPath.replace(/ddjvu([^\/\\]*)$/, "djvused$1");

      // Check if djvused exists at the guessed path
      let djvusedExists = false;
      try {
        djvusedExists = Zotero.File.pathToFile(djvusedPath).exists();
      } catch (e) {}

      if (!djvusedExists) {
        // Try to find djvused on PATH
        djvusedPath = await this.findExecutable("djvused");
        if (!djvusedPath) {
          this.log("djvused not found, cannot get DJVU page count");
          return null;
        }
      }

      this.log(`Using djvused at: ${djvusedPath}`);

      const tempFile = PathUtils.join(Zotero.getTempDirectory().path, `djvu_conv_pagecount_${Date.now()}.txt`);

      let cmd;
      if (this.isWindows()) {
        const escapedInput = this.escapeWindowsPath(inputPath);
        const escapedTool = this.escapeWindowsPath(djvusedPath);
        const escapedTemp = this.escapeWindowsPath(tempFile);
        cmd = `"${escapedTool}" "${escapedInput}" -e "n" > "${escapedTemp}" 2>&1`;
        await Zotero.Utilities.Internal.exec("cmd.exe", ["/c", cmd]);
      } else {
        // inputPath is now a safe temp path with ASCII-only characters, no escaping needed
        cmd = `export LANG=en_US.UTF-8; "${djvusedPath}" "${inputPath}" -e 'n' > "${tempFile}" 2>&1`;
        await Zotero.Utilities.Internal.exec("/bin/sh", ["-c", cmd]);
      }

      // Small delay to ensure file is written
      await Zotero.Promise.delay(50);

      let pageCount = null;
      try {
        const content = await Zotero.File.getContentsAsync(tempFile);
        this.log(`djvused output: "${content.trim()}"`);
        pageCount = parseInt(content.trim(), 10);
        if (isNaN(pageCount)) pageCount = null;
      } catch (e) {
        this.log(`Failed to read djvused output: ${e.message}`);
      }

      try { await IOUtils.remove(tempFile); } catch (e) {}

      this.log(`DJVU page count: ${pageCount}`);
      return pageCount;
    } catch (e) {
      this.log(`Failed to get DJVU page count: ${e.message}`);
      return null;
    }
  }

  async runDdjvuWithProgress(inputPath, outputPath, progress, getBatchPrefix = () => "") {
    if (!inputPath || !outputPath) {
      throw new Error("Missing input or output path");
    }

    this.log("Starting DJVU conversion...");

    // Use temp directory with safe ASCII filenames to avoid shell escaping issues
    // with special characters (brackets, !, Cyrillic, etc.) in original paths
    const tempDir = Zotero.getTempDirectory().path;
    const tempId = `djvu_conv_${Date.now()}`;
    const tempInputPath = PathUtils.join(tempDir, `${tempId}_input.djvu`);
    const tempOutputPath = PathUtils.join(tempDir, `${tempId}_output.pdf`);
    const markerFile = PathUtils.join(tempDir, `${tempId}.done`);
    const errorFile = PathUtils.join(tempDir, `${tempId}.error`);
    const pidFile = PathUtils.join(tempDir, `${tempId}.pid`);
    const logFile = PathUtils.join(tempDir, `${tempId}.log`);

    // Copy input file to temp location with safe name
    try {
      await IOUtils.copy(inputPath, tempInputPath);
      this.log(`Copied input to temp: ${tempInputPath}`);
    } catch (e) {
      throw new Error(`Failed to copy input file: ${e.message}`);
    }

    // Get page count from temp file (after copy, so path is safe for shell)
    const totalPages = await this.getDjvuPageCount(tempInputPath);
    if (totalPages) {
      this.log(`DJVU has ${totalPages} pages`);
    }

    // Clean up any leftover files from previous cancelled runs
    try { await IOUtils.remove(markerFile); } catch (e) {}
    try { await IOUtils.remove(errorFile); } catch (e) {}
    try { await IOUtils.remove(logFile); } catch (e) {}
    try { await IOUtils.remove(pidFile); } catch (e) {}
    try { await IOUtils.remove(tempOutputPath); } catch (e) {}
    try { await IOUtils.remove(outputPath); } catch (e) {}

    // Build the ddjvu command with -verbose for progress (cross-platform)
    // Using temp paths which only contain safe ASCII characters
    let ddjvuCmd;
    if (this.isWindows()) {
      const escapedInput = this.escapeWindowsPath(tempInputPath);
      const escapedOutput = this.escapeWindowsPath(tempOutputPath);
      const escapedTool = this.escapeWindowsPath(this.ddjvuPath);
      const escapedLog = this.escapeWindowsPath(logFile);
      ddjvuCmd = `"${escapedTool}" -format=pdf -verbose "${escapedInput}" "${escapedOutput}" 2>"${escapedLog}"`;
    } else {
      // Temp paths are safe ASCII, no escaping needed but we still quote them
      ddjvuCmd = `export LANG=en_US.UTF-8; "${this.ddjvuPath}" -format=pdf -verbose "${tempInputPath}" "${tempOutputPath}" 2>"${logFile}"`;
    }

    // Start background process using helper
    this.startBackgroundProcess(ddjvuCmd, markerFile, errorFile, pidFile);
    this._activeProcesses.set(pidFile, "ddjvu");

    // Helper to clean up all temp files
    const cleanupTempFiles = async () => {
      try { await IOUtils.remove(tempInputPath); } catch (e) {}
      try { await IOUtils.remove(tempOutputPath); } catch (e) {}
      try { await IOUtils.remove(markerFile); } catch (e) {}
      try { await IOUtils.remove(errorFile); } catch (e) {}
      try { await IOUtils.remove(logFile); } catch (e) {}
      try { await IOUtils.remove(pidFile); } catch (e) {}
    };

    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const maxWait = ZoteroDJVUConverter.TIMEOUT_CONVERSION;

      const checkInterval = setInterval(async () => {
        try {
          if (progress.cancelled) {
            clearInterval(checkInterval);
            await this.killBackgroundProcess(pidFile, "ddjvu");
            this._activeProcesses.delete(pidFile);
            await cleanupTempFiles();
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

          progress.updateText(`${getBatchPrefix()}Converting DJVU to PDF${pageInfo} • ${elapsedSec}s`);

          let done = false;
          let error = false;

          try { done = await IOUtils.exists(markerFile); } catch (e) {}
          try { error = await IOUtils.exists(errorFile); } catch (e) {}

          if (done) {
            clearInterval(checkInterval);
            this._activeProcesses.delete(pidFile);
            // Copy temp output to final destination
            try {
              await IOUtils.copy(tempOutputPath, outputPath);
              this.log(`Copied output to: ${outputPath}`);
            } catch (e) {
              await cleanupTempFiles();
              this.log(`Failed to copy output: ${e.message}`);
              reject(new Error(`Failed to save PDF: ${e.message}`));
              return;
            }
            await cleanupTempFiles();
            this.log("DJVU conversion complete");
            resolve(true);
          } else if (error) {
            clearInterval(checkInterval);
            this._activeProcesses.delete(pidFile);
            // Log file contents for debugging before cleanup
            try {
              const logContent = await Zotero.File.getContentsAsync(logFile);
              this.log(`DJVU log file content (last 500 chars): ${logContent ? logContent.slice(-500) : 'empty'}`);
            } catch (e) {
              this.log(`Could not read log file: ${e.message}`);
            }
            await cleanupTempFiles();
            this.log("DJVU conversion failed");
            reject(new Error("DJVU conversion failed - check if file is corrupted"));
          } else if (elapsed >= maxWait) {
            clearInterval(checkInterval);
            await this.killBackgroundProcess(pidFile, "ddjvu");
            this._activeProcesses.delete(pidFile);
            await cleanupTempFiles();
            this.log("DJVU conversion timeout");
            reject(new Error("DJVU conversion timed out"));
          }
        } catch (e) {
          clearInterval(checkInterval);
          this.log(`Error in DJVU polling: ${e.message}`);
          await cleanupTempFiles();
          reject(e);
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
