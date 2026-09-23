class ZoteroDJVUConverter {
  // Timeouts (in milliseconds)
  static TIMEOUT_OCR = 1800000;          // 30 minutes for OCR
  static TIMEOUT_CONVERSION = 300000;    // 5 minutes for DJVU conversion
  static TIMEOUT_DOWNSAMPLE = 600000;    // 10 minutes for ghostscript downsampling

  // Lossy downsampling targets (only used when the user opts in)
  static DOWNSAMPLE_COLOR_DPI = 200;     // Color/grayscale images
  static DOWNSAMPLE_MONO_DPI = 300;      // B/W images (kept higher for text legibility)

  // Auto page mode: a page is rendered 1-bit unless its normal and 1-bit
  // thumbnails disagree or it contains colour. Calibrated on 3050 pages of 7
  // books: text pages mismatch <= 0.15%, a grey logo 0.47%, covers 11-98%
  static SCAN_SIZE = 150;                   // Thumbnail bounding box (px)
  static SCAN_MISMATCH_FRACTION = 0.003;    // Pixels black in 1-bit but light in normal render (or vice versa)
  static SCAN_CHROMA = 40;                  // Max-min channel spread above this = coloured pixel
  static SCAN_CHROMA_FRACTION = 0.005;      // Coloured pixels on more than 0.5% of the page

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
    ISSUE_DETAILS: `
      display: none;
      max-width: 420px;
      max-height: 180px;
      overflow-y: auto;
      margin-bottom: 12px;
      padding: 6px 8px;
      background: #f7f7f7;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 12px;
      white-space: pre-wrap;
      word-break: break-word;
      user-select: text;
      -moz-user-select: text;
      cursor: text;
    `,
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

  // Append a hint about missing optional optimizers under compression controls
  // (without them, Medium/Maximum barely outperform Light on scanned books)
  appendCompressionHint(doc, container) {
    const missing = [];
    if (!this.jbig2Found) missing.push("jbig2enc");
    if (!this.pngquantFound) missing.push("pngquant");
    if (missing.length > 0) {
      container.appendChild(this.createDisabledNote(doc, `Tip: install ${missing.join(" and ")} for stronger compression`));
    }
  }

  // Create the page image mode dropdown for DJVU conversion
  // Returns { container, getValue }
  createPageModeSection(doc) {
    const S = ZoteroDJVUConverter.STYLES;
    const container = this.createSection(doc);

    const label = doc.createElement("div");
    label.textContent = "Page images:";
    label.style.cssText = S.LABEL + " margin-bottom: 8px;";
    container.appendChild(label);

    const select = this.createSelect(doc, [
      { value: "auto", label: "Auto: black & white for text pages (recommended)" },
      { value: "color", label: "Colour: every page as scanned (largest)" },
      { value: "bw", label: "Black & white: all pages (smallest, drops pictures)" }
    ], "auto");
    container.appendChild(select);

    return { container, getValue: () => select.value };
  }

  // Create the lossy compression options section (both off by default)
  // Returns { container, getOptions }
  createLossyOptionsSection(doc, idPrefix) {
    const S = ZoteroDJVUConverter.STYLES;
    const container = this.createSection(doc);

    const label = doc.createElement("div");
    label.textContent = "Aggressive compression (lossy):";
    label.style.cssText = S.LABEL_SMALL;
    container.appendChild(label);

    const jbig2Available = this.jbig2Found && this.ocrmypdfFound;
    const { label: jbig2Label, checkbox: jbig2Check } = this.createCheckbox(
      doc, `${idPrefix}-jbig2-lossy`,
      jbig2Available
        ? "Lossy JBIG2 for B/W pages (may alter similar-looking characters)"
        : "Lossy JBIG2 for B/W pages (install jbig2enc to enable)",
      false, !jbig2Available
    );
    container.appendChild(jbig2Label);

    const gsAvailable = !!this.gsPath;
    const { label: dsLabel, checkbox: dsCheck } = this.createCheckbox(
      doc, `${idPrefix}-downsample`,
      gsAvailable
        ? `Downsample images to ${ZoteroDJVUConverter.DOWNSAMPLE_COLOR_DPI} DPI (visibly lossy)`
        : "Downsample images (install ghostscript to enable)",
      false, !gsAvailable
    );
    container.appendChild(dsLabel);

    return {
      container,
      getOptions: () => ({
        jbig2Lossy: jbig2Available && jbig2Check.checked,
        downsample: gsAvailable && dsCheck.checked
      })
    };
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
    let lastSizeInfo = null;
    let totalOriginalSize = 0;
    let totalConvertedSize = 0;
    let totalFinalSize = 0;
    // Per-file problems shown in the progress dialog
    const issues = [];

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
          const { filePath, error } = await this.checkDjvuAttachment(item);
          if (!filePath) {
            issues.push(this.describeIssue(item, null, error));
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

          const sizeInfo = await this.convertSingleDjvu(item, filePath, options, progress, globalFileNum, getBatchPrefix);
          successCount++;
          // Accumulate sizes for completion message
          if (sizeInfo) {
            lastSizeInfo = sizeInfo;
            totalOriginalSize += sizeInfo.originalSize || 0;
            totalConvertedSize += sizeInfo.convertedSize || 0;
            totalFinalSize += sizeInfo.finalSize || 0;
            if (sizeInfo.warning) {
              issues.push(this.describeIssue(item, filePath, sizeInfo.warning, true));
            }
          }
        } catch (e) {
          this.log(`Error converting file ${globalFileNum}: ${e.message}`);
          if (e.message.includes("Cancelled by user") || progress.cancelled) {
            break;
          }
          issues.push(this.describeIssue(item, null, e.message));
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
            // Build size info string: original → converted → final
            let sizeStr = "";
            if (lastSizeInfo && lastSizeInfo.originalSize && lastSizeInfo.finalSize) {
              const { originalSize, convertedSize, finalSize } = lastSizeInfo;
              sizeStr = ` ${this.formatSize(originalSize)} → ${this.formatSize(convertedSize)} → ${this.formatSize(finalSize)}`;
            }
            progress.finish(true, "Done!" + sizeStr, issues);
          } else {
            progress.finish(false, "Conversion failed", issues);
          }
        } else {
          const totalSuccess = globalOffset + successCount;
          // Build total size info string
          let sizeStr = "";
          if (totalOriginalSize && totalFinalSize) {
            sizeStr = ` • ${this.formatSize(totalOriginalSize)} → ${this.formatSize(totalConvertedSize)} → ${this.formatSize(totalFinalSize)}`;
          }
          if (progress.cancelled) {
            progress.finish(false, `Cancelled after ${totalSuccess}/${finalTotal}`);
          } else if (failCount === 0) {
            progress.finish(true, `All ${finalTotal} files converted` + sizeStr, issues);
          } else {
            progress.finish(false, `Done: ${successCount} converted, ${failCount} failed`, issues);
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
    let lastSizeInfo = null;
    let totalInputSize = 0;
    let totalOutputSize = 0;
    // Per-file problems shown in the progress dialog
    const issues = [];

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
            issues.push(this.describeIssue(item, null, "Attachment file not found on disk (not downloaded yet, moved, or a linked file that no longer exists)"));
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

          const sizeInfo = await this.ocrSinglePdf(item, filePath, options, progress, globalFileNum, getBatchPrefix);
          successCount++;
          // Accumulate sizes for completion message
          if (sizeInfo) {
            lastSizeInfo = sizeInfo;
            totalInputSize += sizeInfo.inputSize || 0;
            totalOutputSize += sizeInfo.outputSize || 0;
          }
        } catch (e) {
          this.log(`Error adding OCR to file ${globalFileNum}: ${e.message}`);
          if (e.message.includes("Cancelled by user") || progress.cancelled) {
            break;
          }
          issues.push(this.describeIssue(item, null, e.message));
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
            // Build size info string: input → output
            let sizeStr = "";
            if (lastSizeInfo && lastSizeInfo.inputSize && lastSizeInfo.outputSize) {
              sizeStr = ` ${this.formatSize(lastSizeInfo.inputSize)} → ${this.formatSize(lastSizeInfo.outputSize)}`;
            }
            progress.finish(true, "Done!" + sizeStr);
          } else {
            progress.finish(false, "OCR failed", issues);
          }
        } else {
          const totalSuccess = globalOffset + successCount;
          if (progress.cancelled) {
            progress.finish(false, `Cancelled after ${totalSuccess}/${finalTotal}`);
          } else if (failCount === 0) {
            let sizeStr = "";
            if (totalInputSize && totalOutputSize) {
              sizeStr = ` • ${this.formatSize(totalInputSize)} → ${this.formatSize(totalOutputSize)}`;
            }
            progress.finish(true, `OCR added to all ${finalTotal} files` + sizeStr);
          } else {
            progress.finish(false, `Done: ${successCount} processed, ${failCount} failed`, issues);
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
    let lastSizeInfo = null;
    let totalInputSize = 0;
    let totalOutputSize = 0;
    // Per-file problems shown in the progress dialog
    const issues = [];

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
            issues.push(this.describeIssue(item, null, "Attachment file not found on disk (not downloaded yet, moved, or a linked file that no longer exists)"));
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

          const sizeInfo = await this.compressSinglePdf(item, filePath, options, progress, globalFileNum, getBatchPrefix);
          successCount++;
          if (sizeInfo) {
            lastSizeInfo = sizeInfo;
            totalInputSize += sizeInfo.inputSize || 0;
            totalOutputSize += sizeInfo.outputSize || 0;
          }
        } catch (e) {
          this.log(`Error compressing file ${globalFileNum}: ${e.message}`);
          if (e.message.includes("Cancelled by user") || progress.cancelled) {
            break;
          }
          issues.push(this.describeIssue(item, null, e.message));
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
            // Build size info string: input → output
            let sizeStr = "";
            if (lastSizeInfo && lastSizeInfo.inputSize) {
              if (lastSizeInfo.replaced) {
                sizeStr = ` ${this.formatSize(lastSizeInfo.inputSize)} → ${this.formatSize(lastSizeInfo.outputSize)}`;
              } else {
                sizeStr = ` ${this.formatSize(lastSizeInfo.inputSize)} (kept original)`;
              }
            }
            progress.finish(true, "Done!" + sizeStr);
          } else {
            progress.finish(false, "Compression failed", issues);
          }
        } else {
          const totalSuccess = globalOffset + successCount;
          if (progress.cancelled) {
            progress.finish(false, `Cancelled after ${totalSuccess}/${finalTotal}`);
          } else if (failCount === 0) {
            let sizeStr = "";
            if (totalInputSize && totalOutputSize) {
              sizeStr = ` • ${this.formatSize(totalInputSize)} → ${this.formatSize(totalOutputSize)}`;
            }
            progress.finish(true, `All ${finalTotal} files compressed` + sizeStr);
          } else {
            progress.finish(false, `Done: ${successCount} compressed, ${failCount} failed`, issues);
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
      paths.push("C:\\Program Files (x86)\\DjVuLibre");
      paths.push("C:\\Program Files\\Tesseract-OCR");
      paths.push("C:\\ProgramData\\chocolatey\\bin"); // Chocolatey shims
      // Python Scripts directories (for pip-installed packages like ocrmypdf)
      for (const ver of ["39", "310", "311", "312", "313"]) {
        paths.push(`C:\\Python${ver}\\Scripts`);
        paths.push(`C:\\Program Files\\Python${ver}\\Scripts`);
      }
      try {
        const home = Services.dirsvc.get("Home", Ci.nsIFile).path;
        paths.push(PathUtils.join(home, "scoop", "shims")); // Scoop
        paths.push(PathUtils.join(home, "AppData", "Local", "Programs")); // User installs
        // User-installed Python Scripts
        for (const ver of ["39", "310", "311", "312", "313"]) {
          paths.push(PathUtils.join(home, "AppData", "Local", "Programs", "Python", `Python${ver}`, "Scripts"));
          paths.push(PathUtils.join(home, "AppData", "Roaming", "Python", `Python${ver}`, "Scripts"));
        }
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
        "djvulibre": "choco install djvu-libre",
        "ocrmypdf": "pip install ocrmypdf",
        "tesseract": "choco install tesseract",
        "tesseract-lang": "" // included with tesseract on Windows
      };
      return pkgList.map(p => winMap[p] ? `  ${winMap[p]}` : "").filter(s => s).join("\n");
    }
    return pkgList.join(", ");
  }

  // Build a per-file problem entry for the progress dialog
  describeIssue(item, filePath, message, isWarning = false) {
    let name = "";
    try { name = item.getField("title"); } catch (e) {}
    name = this.truncateFilename(name || this.getBasename(filePath || "") || "file", 50);
    return { name, message, isWarning };
  }

  // Format issues as plain text; the file name is omitted for a single failure
  // since the dialog is already about that file
  formatIssues(issues) {
    return issues.map(({ name, message, isWarning }) => {
      const prefix = isWarning ? "⚠ " : "✗ ";
      return issues.length === 1 && !isWarning ? message : `${prefix}${name}: ${message}`;
    }).join("\n\n");
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
      // The error file records the exit code so failures can be explained
      return `(${cmd} && touch "${escapedMarker}") || (echo $? > "${escapedError}") & echo $! > "${escapedPid}"`;
    }
  }

  // Read the exit code recorded in an error marker file (Unix only), or null
  async readExitCode(errorFile) {
    try {
      const code = parseInt((await Zotero.File.getContentsAsync(errorFile)).trim(), 10);
      return isNaN(code) ? null : code;
    } catch (e) {
      return null;
    }
  }

  // ocrmypdf exit codes (https://ocrmypdf.readthedocs.io/en/latest/advanced.html#return-code-policy)
  static OCRMYPDF_EXIT_CODES = {
    1: "invalid arguments",
    2: "input is not a valid PDF",
    3: "a required program or language pack is missing",
    4: "output PDF is invalid",
    5: "could not read input or write output (file access)",
    6: "PDF already has text (use force OCR to redo it)",
    7: "a helper program (tesseract/ghostscript) failed",
    8: "PDF is encrypted/password-protected",
    9: "invalid tesseract configuration",
    10: "PDF/A conversion failed",
    15: "unexpected internal error",
    130: "interrupted"
  };

  // Pick the most informative line(s) out of an ocrmypdf stderr log
  extractOcrmypdfError(logContent) {
    if (!logContent) return "";
    const lines = logContent.split("\n").map(l => l.trimEnd());

    // Missing tesseract language data - the language codes follow on the next lines
    const langIdx = lines.findIndex(l => l.includes("does not have language data"));
    if (langIdx >= 0) {
      const langs = [];
      for (let i = langIdx + 1; i < lines.length && lines[i].trim() && !lines[i].startsWith("Please"); i++) {
        langs.push(lines[i].trim());
      }
      return `tesseract language data not installed: ${langs.join(", ") || "unknown"}`;
    }

    // Python exception at the end of a traceback, e.g. "ocrmypdf.exceptions.EncryptedPdfError: ..."
    for (let i = lines.length - 1; i >= 0; i--) {
      const m = lines[i].match(/^[\w.]*?(\w+(?:Error|Exception))(?::\s*(.*))?$/);
      if (m && m[1] !== "ExitCodeException") {
        return m[2] ? `${m[1]}: ${m[2]}` : m[1];
      }
    }

    // Otherwise the last unindented line mentioning an error
    for (let i = lines.length - 1; i >= 0; i--) {
      if (/error/i.test(lines[i]) && !/^\s/.test(lines[i])) return lines[i].trim();
    }
    return "";
  }

  // Parse a binary PGM (P5) or PPM (P6) image as written by ddjvu
  parsePnm(bytes) {
    // Header: magic, width, height, maxval as whitespace-separated tokens (with # comments)
    const tokens = [];
    let pos = 0;
    while (tokens.length < 4 && pos < bytes.length) {
      const c = bytes[pos];
      if (c === 0x23) { // '#' comment to end of line
        while (pos < bytes.length && bytes[pos] !== 0x0a) pos++;
      } else if (c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d) {
        pos++;
      } else {
        let tok = "";
        while (pos < bytes.length && bytes[pos] > 0x20) tok += String.fromCharCode(bytes[pos++]);
        tokens.push(tok);
      }
    }
    const [magic, w, h] = tokens;
    if (magic !== "P5" && magic !== "P6") throw new Error(`Unsupported image format ${magic}`);
    const channels = magic === "P6" ? 3 : 1;
    const width = parseInt(w, 10), height = parseInt(h, 10);
    // A single whitespace byte separates the header from the pixel data
    return { width, height, channels, pixels: bytes.subarray(pos + 1, pos + 1 + width * height * channels) };
  }

  // Would rendering this page as 1-bit lose anything? Compares thumbnails of
  // the normal render (PPM) and the 1-bit text mask render (PGM). Grey ink
  // turning black is fine; pictures, grey shapes and colour are not.
  needsColor(full, mask) {
    const C = ZoteroDJVUConverter;
    if (full.width !== mask.width || full.height !== mask.height || full.channels !== 3) return true;
    const n = full.width * full.height;
    let mismatch = 0, coloured = 0;
    for (let i = 0; i < n; i++) {
      const r = full.pixels[3 * i], g = full.pixels[3 * i + 1], b = full.pixels[3 * i + 2];
      const grey = (r * 299 + g * 587 + b * 114) / 1000;
      const m = mask.pixels[i];
      if ((m < 128 && grey > 200) || (m > 200 && grey < 128)) mismatch++;
      if (Math.max(r, g, b) - Math.min(r, g, b) > C.SCAN_CHROMA) coloured++;
    }
    return mismatch > n * C.SCAN_MISMATCH_FRACTION || coloured > n * C.SCAN_CHROMA_FRACTION;
  }

  // Find the pages that need colour/greyscale rendering. DJVU stores text as a
  // separate 1-bit mask, so a page without pictures or colour loses nothing when
  // rendered from the mask alone as pure black & white.
  // Renders thumbnails of all pages in one ddjvu pass per render mode.
  // Returns { colorPages: Set of 1-based page numbers, scanned: pages analyzed }.
  // Pages that could not be analyzed count as colour (the safe choice).
  async findColorPages(djvuPath, totalPages) {
    const C = ZoteroDJVUConverter;
    const scanDir = PathUtils.join(Zotero.getTempDirectory().path, `djvu_conv_scan_${Date.now()}`);
    const colorPages = new Set();
    let scanned = 0;
    try {
      await IOUtils.makeDirectory(scanDir);
      const size = `-size=${C.SCAN_SIZE}x${C.SCAN_SIZE}`;
      const render = (format, mode, name) => Zotero.Utilities.Internal.exec(this.ddjvuPath, [
        `-format=${format}`, `-mode=${mode}`, size, "-eachpage", djvuPath, PathUtils.join(scanDir, name)
      ]).catch(e => this.log(`Page scan (${mode}) incomplete: ${e.message}`));
      await Promise.all([
        render("ppm", "color", "full_%d.ppm"),
        render("pgm", "black", "mask_%d.pgm")
      ]);

      for (let p = 1; p <= totalPages; p++) {
        try {
          const full = this.parsePnm(await IOUtils.read(PathUtils.join(scanDir, `full_${p}.ppm`)));
          const mask = this.parsePnm(await IOUtils.read(PathUtils.join(scanDir, `mask_${p}.pgm`)));
          if (this.needsColor(full, mask)) colorPages.add(p);
          scanned++;
        } catch (e) {
          colorPages.add(p);
        }
      }
    } catch (e) {
      this.log(`Page scan failed: ${e.message}`);
      for (let p = 1; p <= totalPages; p++) colorPages.add(p);
    } finally {
      try { await IOUtils.remove(scanDir, { recursive: true }); } catch (e) {}
    }
    return { colorPages, scanned };
  }

  // Compress sorted page numbers into a ddjvu page spec, e.g. [2,3,4,7] -> "2-4,7"
  formatPageSpec(pages) {
    const parts = [];
    for (let i = 0; i < pages.length; i++) {
      let j = i;
      while (j + 1 < pages.length && pages[j + 1] === pages[j] + 1) j++;
      parts.push(i === j ? `${pages[i]}` : `${pages[i]}-${pages[j]}`);
      i = j;
    }
    return parts.join(",");
  }

  // Check a DJVU file's IFF header against its size to catch truncated
  // downloads and non-DJVU files. Returns an error message, or null if OK.
  async checkDjvuFile(filePath) {
    let header, size;
    try {
      header = await IOUtils.read(filePath, { maxBytes: 12 });
      size = (await IOUtils.stat(filePath)).size;
    } catch (e) {
      return `Cannot read file: ${e.message}`;
    }
    const magic = String.fromCharCode(...header.slice(0, 8));
    if (magic !== "AT&TFORM") {
      return "Not a valid DJVU file (the file header is wrong - it may be an HTML page or another format saved as .djvu)";
    }
    // FORM chunk length (big-endian) + 12 header bytes = expected file size
    const expected = ((header[8] << 24) >>> 0) + (header[9] << 16) + (header[10] << 8) + header[11] + 12;
    if (size < expected) {
      return `DJVU file is incomplete: ${this.formatSize(size)} of ${this.formatSize(expected)} ` +
        `(${Math.round(100 * size / expected)}%). It was probably an interrupted download - re-download it.`;
    }
    return null;
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

      // Optional optimizers that greatly improve ocrmypdf compression
      // (jbig2enc for scanned B/W pages, pngquant for PNG quantization)
      this.pngquantFound = !!(await this.findExecutable("pngquant"));
      this.jbig2Found = !!(await this.findExecutable("jbig2"));
      this.log(`Optional optimizers: pngquant=${this.pngquantFound}, jbig2=${this.jbig2Found}`);

      // Also check for qpdf/ghostscript (used for removing cover page from PDFs)
      this.qpdfPath = await this.findExecutable("qpdf");
      if (this.qpdfPath) this.log(`Found qpdf at: ${this.qpdfPath}`);
      this.gsPath = await this.findExecutable("gs");
      if (!this.gsPath && this.isWindows()) {
        this.gsPath = (await this.findExecutable("gswin64c")) || (await this.findExecutable("gswin32c"));
      }
      if (this.gsPath) this.log(`Found ghostscript at: ${this.gsPath}`);

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

  // Check if cover page removal is available for existing PDFs
  canRemovePdfCover() {
    return !!(this.qpdfPath || this.gsPath);
  }

  // Remove the first page (cover) from a PDF in place using qpdf or ghostscript
  // Returns true if the page was removed, false if skipped or failed
  async removeFirstPdfPage(pdfPath) {
    if (!this.canRemovePdfCover()) {
      this.log("Cannot remove cover: qpdf/ghostscript not found");
      return false;
    }

    const pageCount = await this.getPdfPageCount(pdfPath);
    if (pageCount !== null && pageCount <= 1) {
      this.log("Skipping cover removal: PDF has only one page");
      return false;
    }

    // Use temp paths with safe ASCII names to avoid shell escaping issues
    const tempDir = Zotero.getTempDirectory().path;
    const tempId = `djvu_conv_cover_${Date.now()}`;
    const tempInput = PathUtils.join(tempDir, `${tempId}_in.pdf`);
    const tempOutput = PathUtils.join(tempDir, `${tempId}_out.pdf`);

    try {
      await IOUtils.copy(pdfPath, tempInput);

      let cmd;
      if (this.qpdfPath) {
        // qpdf keeps pages 2 to last (z) without re-encoding images
        cmd = `"${this.qpdfPath}" "${tempInput}" --pages . 2-z -- "${tempOutput}"`;
      } else {
        cmd = `"${this.gsPath}" -q -dNOPAUSE -dBATCH -sDEVICE=pdfwrite -dFirstPage=2 -sOutputFile="${tempOutput}" "${tempInput}"`;
      }

      if (this.isWindows()) {
        await Zotero.Utilities.Internal.exec("cmd.exe", ["/c", `${cmd} 2>nul`]);
      } else {
        await Zotero.Utilities.Internal.exec("/bin/sh", ["-c", `export LANG=en_US.UTF-8; ${cmd} 2>/dev/null`]);
      }

      // Verify output before replacing the original
      let outputSize = 0;
      try {
        const stat = await IOUtils.stat(tempOutput);
        outputSize = stat.size;
      } catch (e) {}

      if (outputSize > 0) {
        // Copy (not move) - temp dir may be on a different volume; temps are removed in finally
        await IOUtils.copy(tempOutput, pdfPath);
        this.log(`Removed cover page from PDF: ${this.getBasename(pdfPath)}`);
        return true;
      }

      this.log("Cover removal produced no output, keeping original");
      return false;
    } catch (e) {
      this.log(`Cover removal failed: ${e.message}`);
      return false;
    } finally {
      try { await IOUtils.remove(tempInput); } catch (e) {}
      try { await IOUtils.remove(tempOutput); } catch (e) {}
    }
  }

  // Rewrite a PDF in place via a Ghostscript pdfwrite pass
  // opts: { flags, trailingFile, statusText, shouldReplace(inputSize, outputSize) }
  // Replaces the original only if shouldReplace returns true. Returns true if replaced.
  async runGsRewrite(pdfPath, opts, progress, getBatchPrefix = () => "") {
    const statusText = opts.statusText || "Processing PDF";
    if (!this.gsPath) {
      this.log(`${statusText}: ghostscript not found, skipping`);
      return false;
    }

    const inputSize = this.getFileSize(pdfPath);

    // Use temp paths with safe ASCII names to avoid shell escaping issues
    const tempDir = Zotero.getTempDirectory().path;
    const tempId = `djvu_conv_gs_${Date.now()}`;
    const tempInput = PathUtils.join(tempDir, `${tempId}_in.pdf`);
    const tempOutput = PathUtils.join(tempDir, `${tempId}_out.pdf`);
    const markerFile = PathUtils.join(tempDir, `${tempId}.done`);
    const errorFile = PathUtils.join(tempDir, `${tempId}.error`);
    const pidFile = PathUtils.join(tempDir, `${tempId}.pid`);

    try {
      await IOUtils.copy(pdfPath, tempInput);
    } catch (e) {
      this.log(`${statusText}: failed to copy input: ${e.message}`);
      return false;
    }

    const trailing = opts.trailingFile ? ` "${opts.trailingFile}"` : "";
    const gsCmd = `"${this.gsPath}" -q -dNOPAUSE -dBATCH -sDEVICE=pdfwrite ${opts.flags || ""} ` +
      `-sOutputFile="${tempOutput}" "${tempInput}"${trailing}`;

    // Process pattern for kill on Windows (gswin64c) vs Unix (gs)
    const gsPattern = this.getBasename(this.gsPath).replace(/\.(exe|bat|cmd)$/i, "");

    this.startBackgroundProcess(gsCmd, markerFile, errorFile, pidFile);
    this._activeProcesses.set(pidFile, gsPattern);

    const cleanup = async () => {
      for (const f of [tempInput, tempOutput, markerFile, errorFile, pidFile]) {
        try { await IOUtils.remove(f); } catch (e) {}
      }
    };

    return new Promise((resolve) => {
      const startTime = Date.now();

      const checkInterval = setInterval(async () => {
        try {
          if (progress.cancelled) {
            clearInterval(checkInterval);
            await this.killBackgroundProcess(pidFile, gsPattern);
            this._activeProcesses.delete(pidFile);
            await cleanup();
            this.log(`${statusText}: cancelled`);
            resolve(false);
            return;
          }

          const elapsedSec = Math.floor((Date.now() - startTime) / 1000);
          progress.updateText(`${getBatchPrefix()}${statusText} • ${elapsedSec}s`);

          let done = false;
          let error = false;
          try { done = await IOUtils.exists(markerFile); } catch (e) {}
          try { error = await IOUtils.exists(errorFile); } catch (e) {}

          if (done) {
            clearInterval(checkInterval);
            this._activeProcesses.delete(pidFile);
            const outputSize = this.getFileSize(tempOutput);
            let replaced = false;
            if (outputSize > 0 && opts.shouldReplace(inputSize, outputSize)) {
              try {
                await IOUtils.copy(tempOutput, pdfPath);
                this.log(`${statusText}: ${this.formatSize(inputSize)} -> ${this.formatSize(outputSize)}`);
                replaced = true;
              } catch (e) {
                this.log(`${statusText}: failed to replace original: ${e.message}`);
              }
            } else {
              this.log(`${statusText}: keeping original (output was ${this.formatSize(outputSize)})`);
            }
            await cleanup();
            resolve(replaced);
          } else if (error) {
            clearInterval(checkInterval);
            this._activeProcesses.delete(pidFile);
            await cleanup();
            this.log(`${statusText}: failed, keeping original`);
            resolve(false);
          } else if (Date.now() - startTime >= ZoteroDJVUConverter.TIMEOUT_DOWNSAMPLE) {
            clearInterval(checkInterval);
            await this.killBackgroundProcess(pidFile, gsPattern);
            this._activeProcesses.delete(pidFile);
            await cleanup();
            this.log(`${statusText}: timed out, keeping original`);
            resolve(false);
          }
        } catch (e) {
          clearInterval(checkInterval);
          this.log(`${statusText}: polling error: ${e.message}`);
          await cleanup();
          resolve(false);
        }
      }, ZoteroDJVUConverter.POLL_INTERVAL_FAST);
    });
  }

  // Downsample images in a PDF in place using Ghostscript (lossy, opt-in)
  // Only replaces the file if the result is smaller. Returns true if replaced.
  async downsamplePdfImages(pdfPath, progress, getBatchPrefix = () => "") {
    const colorDpi = ZoteroDJVUConverter.DOWNSAMPLE_COLOR_DPI;
    const monoDpi = ZoteroDJVUConverter.DOWNSAMPLE_MONO_DPI;
    // /ebook preset provides sane image re-encoding settings; explicit flags
    // after it override its resolutions. Threshold 1.0 downsamples any image
    // above the target resolution.
    const flags = `-dPDFSETTINGS=/ebook ` +
      `-dColorImageResolution=${colorDpi} -dColorImageDownsampleThreshold=1.0 ` +
      `-dGrayImageResolution=${colorDpi} -dGrayImageDownsampleThreshold=1.0 ` +
      `-dMonoImageResolution=${monoDpi} -dMonoImageDownsampleThreshold=1.0`;

    return this.runGsRewrite(pdfPath, {
      flags,
      statusText: "Downsampling images",
      shouldReplace: (inputSize, outputSize) => outputSize < inputSize
    }, progress, getBatchPrefix);
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
        message += "  choco install djvu-libre\n";
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

    this.log(`Options: OCR=${options.addOcr}, compressLevel=${options.compressLevel}, deleteOriginal=${options.deleteOriginal}, removeCover=${options.removeCover}, pageMode=${options.pageMode}`);

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

      // Remove cover checkbox (covers are often heavy scanned images)
      const { label: coverLabel, checkbox: coverCheckbox } = this.createCheckbox(
        doc, "djvu-batch-remove-cover", "Remove cover (first page) from each file", false
      );
      dialog.appendChild(coverLabel);

      // Page image mode (black & white vs colour)
      const pageModeSection = this.createPageModeSection(doc);
      dialog.appendChild(pageModeSection.container);

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
      } else {
        this.appendCompressionHint(doc, compressContainer);
      }
      dialog.appendChild(compressContainer);

      // Lossy compression options (off by default)
      const lossySection = this.createLossyOptionsSection(doc, "djvu-batch-convert");
      dialog.appendChild(lossySection.container);

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
          deleteOriginal: replaceRadio.checked,
          removeCover: coverCheckbox.checked,
          pageMode: pageModeSection.getValue(),
          ...lossySection.getOptions()
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

    // Get input file size
    let inputSize = 0;
    try {
      const stat = await IOUtils.stat(filePath);
      inputSize = stat.size;
    } catch (e) {}

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

        // Get output file size
        let outputSize = 0;
        try {
          const stat = await IOUtils.stat(ocrPdfPath);
          outputSize = stat.size;
        } catch (e) {}

        // Replace original with OCR version
        await IOUtils.remove(filePath);
        await IOUtils.move(ocrPdfPath, filePath);
        this.log(`Successfully added OCR to: ${filename}`);

        return { inputSize, outputSize };
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
      this.appendCompressionHint(doc, compressContainer);
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
    let options;
    if (pdfItems.length === 1) {
      const item = pdfItems[0];
      const filePath = await item.getFilePathAsync();
      const filename = item.getField("title") || this.getBasename(filePath) || "file.pdf";
      const fileSize = this.getFileSize(filePath);
      options = await this.showCompressionOptionsDialog(filename, fileSize);
    } else {
      options = await this.showBatchCompressionOptionsDialog(pdfItems.length);
    }

    if (!options) {
      this.log("User cancelled compression");
      return;
    }

    this.log(`Compression level: ${options.compressLevel}, removeCover=${options.removeCover}`);

    // Queue or execute the compression operation
    await this.enqueueOperation("compress", pdfItems, options);
  }

  async compressSinglePdf(item, filePath, options, progress, fileNum, getBatchPrefix) {
    const filename = this.getBasename(filePath);
    this.log(`Compressing file ${fileNum}: ${filename}`);

    // Size before any modification, so reported savings include cover removal
    const originalSize = this.getFileSize(filePath);

    // Remove cover first so compression runs on the final page set
    let coverRemoved = false;
    if (options.removeCover) {
      progress.updateText(`${getBatchPrefix()}Removing cover: ${this.truncateFilename(filename, 30)}`);
      coverRemoved = await this.removeFirstPdfPage(filePath);
    }

    // Optional lossy image downsampling (off by default)
    let downsampled = false;
    if (options.downsample && !progress.cancelled) {
      downsampled = await this.downsamplePdfImages(filePath, progress, getBatchPrefix);
    }

    const optimizeLevel = ZoteroDJVUConverter.getOptimizeLevel(options.compressLevel);
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
        getBatchPrefix,
        options.jbig2Lossy
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
          return { inputSize: originalSize || inputSize, outputSize, replaced: true };
        } else {
          // Compressed file is same size or larger - keep original
          // (still counts as replaced if the cover was removed or images downsampled)
          try { await IOUtils.remove(compressedPath); } catch (err) {}
          this.log(`Skipped ${filename}: compression would not reduce size`);
          return { inputSize: originalSize || inputSize, outputSize: inputSize, replaced: coverRemoved || downsampled };
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
        { value: "maximum", label: "Maximum (smallest files)" }
      ];
      const levelSelect = this.createSelect(doc, levels, "medium");
      compressContainer.appendChild(levelSelect);
      this.appendCompressionHint(doc, compressContainer);
      dialog.appendChild(compressContainer);

      // Lossy compression options (off by default)
      const lossySection = this.createLossyOptionsSection(doc, "djvu-batch-compress");
      dialog.appendChild(lossySection.container);

      // Remove cover checkbox (covers are often heavy scanned images)
      const coverAvailable = this.canRemovePdfCover();
      const { label: coverLabel, checkbox: coverCheck } = this.createCheckbox(
        doc, "djvu-compress-remove-cover", "Remove cover (first page) from each file", false, !coverAvailable
      );
      dialog.appendChild(coverLabel);
      if (!coverAvailable) {
        dialog.appendChild(this.createDisabledNote(doc, "Install qpdf to enable cover removal"));
      }

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
        resolve({
          compressLevel: levelSelect.value,
          removeCover: coverCheck.checked,
          ...lossySection.getOptions()
        });
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
      this.appendCompressionHint(doc, dialog);

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
      levelSelect.style.marginBottom = "16px";
      dialog.appendChild(levelSelect);
      this.appendCompressionHint(doc, dialog);

      // Lossy compression options (off by default)
      const lossySection = this.createLossyOptionsSection(doc, "djvu-compress");
      dialog.appendChild(lossySection.container);

      // Remove cover checkbox (covers are often heavy scanned images)
      const coverAvailable = this.canRemovePdfCover();
      const { label: coverLabel, checkbox: coverCheck } = this.createCheckbox(
        doc, "djvu-compress-remove-cover", "Remove cover (first page)", false, !coverAvailable
      );
      coverLabel.style.marginBottom = "20px";
      dialog.appendChild(coverLabel);
      if (!coverAvailable) {
        dialog.appendChild(this.createDisabledNote(doc, "Install qpdf to enable cover removal"));
      }

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
        resolve({
          compressLevel: levelSelect.value,
          removeCover: coverCheck.checked,
          ...lossySection.getOptions()
        });
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

    this.log(`Auto-convert options: OCR=${options.addOcr}, compressLevel=${options.compressLevel}, deleteOriginal=${options.deleteOriginal}, removeCover=${options.removeCover}, pageMode=${options.pageMode}`);

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

      // Remove cover checkbox (covers are often heavy scanned images)
      const { label: coverLabel, checkbox: coverCheck } = this.createCheckbox(
        doc, "djvu-remove-cover", "Remove cover (first page)", false
      );
      dialog.appendChild(coverLabel);

      // Page image mode (black & white vs colour)
      const pageModeSection = this.createPageModeSection(doc);
      dialog.appendChild(pageModeSection.container);

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
      } else {
        this.appendCompressionHint(doc, compressContainer);
      }

      dialog.appendChild(compressContainer);

      // Lossy compression options (off by default)
      const lossySection = this.createLossyOptionsSection(doc, "djvu-convert");
      dialog.appendChild(lossySection.container);

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
          ocrLanguages: ocrLangs,
          removeCover: coverCheck.checked,
          pageMode: pageModeSection.getValue(),
          ...lossySection.getOptions()
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
        finish: (success, msg, issues = []) => {
          if (success) {
            progress.setProgress(100);
            progress.setText(msg || "Done!");
          } else {
            progress.setError();
            progress.setText(msg || "Failed");
          }
          if (issues.length > 0) {
            // Keep the window open so the reasons can be read
            progressWin.addDescription(this.formatIssues(issues));
          } else {
            progressWin.startCloseTimer(ZoteroDJVUConverter.PROGRESS_CLOSE_DELAY);
          }
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

    // Failure/warning reasons, filled in by finish() (selectable for copying)
    const issueDetails = doc.createElement("div");
    issueDetails.id = "djvu-issue-details";
    issueDetails.style.cssText = S.ISSUE_DETAILS;
    dialog.appendChild(issueDetails);

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
      finish: (success, msg, issues = []) => {
        if (controller.finished || !dialog.parentNode) return;
        controller.finished = true;

        // If cancelled, just close the dialog immediately
        if (controller.cancelled) {
          dialog.remove();
          return;
        }

        statusText.textContent = msg || (success ? "Done!" : "Failed");
        statusText.style.color = success ? "#00aa00" : "#cc0000";

        if (issues.length > 0) {
          issueDetails.textContent = this.formatIssues(issues);
          issueDetails.style.color = issues.every(i => i.isWarning) ? "#8a5a00" : "#a00000";
          issueDetails.style.display = "block";
        }

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

    // Get original file size
    let originalSize = 0;
    try {
      const stat = await IOUtils.stat(filePath);
      originalSize = stat.size;
    } catch (e) {}

    // Catch truncated downloads / non-DJVU files up front with a clear reason
    const fileProblem = await this.checkDjvuFile(filePath);
    if (fileProblem) {
      throw new Error(fileProblem);
    }

    // Non-fatal problems to report alongside a successful conversion
    const warnings = [];

    // Step 1: Convert DJVU to PDF
    const tempPdfPath = filePath.replace(/\.(djvu|djv)$/i, ".pdf");
    this.log(`Converting: ${filePath} -> ${tempPdfPath}`);

    const ddjvuResult = await this.runDdjvuWithProgress(filePath, tempPdfPath, progress, getBatchPrefix, options.removeCover, options.pageMode);
    if (ddjvuResult.warning) warnings.push(ddjvuResult.warning);

    // Get converted PDF size
    let convertedSize = 0;
    try {
      const stat = await IOUtils.stat(tempPdfPath);
      convertedSize = stat.size;
    } catch (e) {}

    // Check if output file exists
    let outputExists = false;
    try {
      outputExists = Zotero.File.pathToFile(tempPdfPath).exists();
    } catch (e) {
      this.log(`Error checking output file: ${e.message}`);
    }

    if (!outputExists) {
      throw new Error("ddjvu finished but the PDF was not created");
    }

    // Check if cancelled
    if (progress.cancelled) {
      try { await IOUtils.remove(tempPdfPath); } catch (e) {}
      throw new Error("Cancelled by user");
    }

    // Step 1.5: Optional lossy image downsampling (off by default)
    // Done before OCR/compression so jbig2/pngquant optimization survives in the final file
    if (options.downsample && !progress.cancelled) {
      await this.downsamplePdfImages(tempPdfPath, progress, getBatchPrefix);
    }

    // Step 1.6: Carry over the DJVU outline as PDF bookmarks and set
    // title/author from the Zotero item (ocrmypdf preserves both downstream)
    if (this.gsPath && !progress.cancelled) {
      let outline = ddjvuResult.outline || [];
      if (ddjvuResult.coverRemoved && outline.length > 0) {
        // Page 1 was dropped - shift all bookmark targets
        const shift = (nodes) => nodes.forEach(n => {
          n.page = Math.max(1, n.page - 1);
          shift(n.children);
        });
        shift(outline);
      }
      const maxPage = ddjvuResult.pageCount
        ? (ddjvuResult.coverRemoved ? ddjvuResult.pageCount - 1 : ddjvuResult.pageCount)
        : null;
      const marks = this.buildPdfmarks(outline, this.getItemMetadata(item), maxPage);
      if (marks) {
        await this.applyPdfmarksToPdf(tempPdfPath, marks, progress, getBatchPrefix);
      }
    }

    // Step 2: Run ocrmypdf for OCR and/or compression
    const needsOcr = options.addOcr;
    const needsCompression = options.compressLevel && options.compressLevel !== "none";
    const optimizeLevel = ZoteroDJVUConverter.getOptimizeLevel(options.compressLevel);

    if ((needsOcr || needsCompression) && this.ocrmypdfFound) {
      const ocrPdfPath = tempPdfPath.replace(/\.pdf$/i, "_ocr.pdf");
      const pageCount = await this.getPdfPageCount(tempPdfPath);
      // Baseline for the keep-smaller check (after possible downsampling)
      const preOptimizeSize = this.getFileSize(tempPdfPath);

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
          getBatchPrefix,
          options.jbig2Lossy
        );

        if (ocrSuccess && Zotero.File.pathToFile(ocrPdfPath).exists()) {
          const processedSize = this.getFileSize(ocrPdfPath);
          if (!needsOcr && processedSize > 0 && preOptimizeSize > 0 && processedSize >= preOptimizeSize) {
            // Compression-only: "optimized" file is not smaller, keep the unprocessed PDF
            this.log(`Discarding compression result for ${filename}: ${this.formatSize(processedSize)} >= ${this.formatSize(preOptimizeSize)}`);
            try { await IOUtils.remove(ocrPdfPath); } catch (e) {}
          } else {
            // OCR output is kept even if larger - the text layer is the point
            if (needsOcr && processedSize >= preOptimizeSize && needsCompression) {
              this.log(`OCR output larger than input (${this.formatSize(preOptimizeSize)} -> ${this.formatSize(processedSize)}), keeping for text layer`);
            }
            await IOUtils.remove(tempPdfPath);
            await IOUtils.move(ocrPdfPath, tempPdfPath);
          }
        }
      } catch (ocrError) {
        if (ocrError.message.includes("Cancelled by user") || progress.cancelled) {
          try { await IOUtils.remove(tempPdfPath); } catch (e) {}
          try { await IOUtils.remove(ocrPdfPath); } catch (e) {}
          throw new Error("Cancelled by user");
        }
        // Continue with original PDF on OCR failure
        this.log(`Processing failed for ${filename}: ${ocrError.message}`);
        warnings.push(`Converted without ${needsOcr ? "OCR" : "compression"}. ${ocrError.message}`);
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

    // Get final size (after OCR/compression if applied)
    let finalSize = 0;
    try {
      const stat = await IOUtils.stat(tempPdfPath);
      finalSize = stat.size;
    } catch (e) {}

    if (options.deleteOriginal) {
      await this.replaceAttachment(item, tempPdfPath);
    } else {
      await this.addPDFSibling(item, tempPdfPath);
    }

    this.log(`Successfully converted: ${filename}`);

    // Return size info for completion message
    return { originalSize, convertedSize, finalSize, warning: warnings.join(" ") || null };
  }

  // Validate attachment is a DJVU file and get its path
  async validateDjvuAttachment(item) {
    return (await this.checkDjvuAttachment(item)).filePath;
  }

  // Returns { filePath } for a usable DJVU attachment, or { filePath: null, error }
  async checkDjvuAttachment(item) {
    const fail = (error) => {
      this.log(error);
      return { filePath: null, error };
    };
    if (!item) return fail("No item provided");
    if (item.deleted) return fail("Item is in the trash");

    let filePath;
    try {
      filePath = await item.getFilePathAsync();
    } catch (e) {
      return fail(`Could not get file path: ${e.message}`);
    }

    if (!filePath) {
      return fail("Attachment file not found on disk (not downloaded yet, moved, or a linked file that no longer exists)");
    }

    const lowerPath = filePath.toLowerCase();
    if (!lowerPath.endsWith(".djvu") && !lowerPath.endsWith(".djv")) {
      return fail(`Not a DJVU file: ${this.getBasename(filePath)}`);
    }

    return { filePath };
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
    const { forceOcr = false, languages = 'eng', optimizeLevel = 1, skipOcr = false, jbig2Lossy = false } = options;

    // Validate language string (only allow alphanumeric, underscore, plus)
    let safeLangs = (languages || 'eng').replace(/[^a-zA-Z0-9_+]/g, '');
    if (!safeLangs || safeLangs === '+') safeLangs = 'eng';

    const ocrMode = forceOcr ? "--force-ocr" : "--skip-text";
    const skipBig = ZoteroDJVUConverter.OCR_SKIP_BIG_MB;
    const tessTimeout = skipOcr ? 0 : ZoteroDJVUConverter.OCR_TESSERACT_TIMEOUT;
    const optLevel = optimizeLevel >= 0 && optimizeLevel <= 3 ? optimizeLevel : 1;
    // Compression-only: skip PDF/A conversion, which can inflate scanned files
    // (older ocrmypdf versions run the file through Ghostscript by default)
    const outputType = skipOcr ? "--output-type pdf " : "";
    // Lossy JBIG2 only applies when the optimizer runs and jbig2enc is present
    const jbig2Flag = (jbig2Lossy && this.jbig2Found && optLevel >= 1) ? "--jbig2-lossy " : "";

    if (this.isWindows()) {
      const escapedInput = this.escapeWindowsPath(inputPath);
      const escapedOutput = this.escapeWindowsPath(outputPath);
      const escapedLogFile = this.escapeWindowsPath(errorLogFile);
      const escapedTool = this.escapeWindowsPath(this.ocrmypdfPath);
      return `"${escapedTool}" -O ${optLevel} ${outputType}${jbig2Flag}${ocrMode} --skip-big ${skipBig} --tesseract-timeout ${tessTimeout} -v 1 -l ${safeLangs} "${escapedInput}" "${escapedOutput}" 2>"${escapedLogFile}"`;
    } else {
      const pathExport = this.getPathExport();
      const escapedInput = this.escapeShellPath(inputPath);
      const escapedOutput = this.escapeShellPath(outputPath);
      const escapedLogFile = this.escapeShellPath(errorLogFile);
      return `${pathExport} "${this.ocrmypdfPath}" -O ${optLevel} ${outputType}${jbig2Flag}${ocrMode} --skip-big ${skipBig} --tesseract-timeout ${tessTimeout} -v 1 -l ${safeLangs} "${escapedInput}" "${escapedOutput}" 2>"${escapedLogFile}"`;
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

  async runOcrWithProgress(inputPath, outputPath, progress, forceOcr = false, languages = "eng", pageCount = null, optimizeLevel = 1, skipOcr = false, getBatchPrefix = () => "", jbig2Lossy = false) {
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
      forceOcr, languages, optimizeLevel, skipOcr, jbig2Lossy
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
            const exitCode = await this.readExitCode(errorFile);
            let detail = "";
            try {
              detail = this.extractOcrmypdfError(await Zotero.File.getContentsAsync(errorLogFile));
            } catch (e) {}
            const codeDesc = ZoteroDJVUConverter.OCRMYPDF_EXIT_CODES[exitCode];
            let errorMsg = `${modeLabel} failed`;
            if (codeDesc) errorMsg += `: ${codeDesc}`;
            if (exitCode !== null) errorMsg += ` (ocrmypdf exit ${exitCode})`;
            if (detail) errorMsg += ` - ${detail.substring(0, 200)}`;
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

  // Find djvused (ships with djvulibre alongside ddjvu), cached
  async getDjvusedPath() {
    if (this._djvusedPath !== undefined) return this._djvusedPath;

    // Try same directory as ddjvu first, then search PATH
    let djvusedPath = this.ddjvuPath ? this.ddjvuPath.replace(/ddjvu([^\/\\]*)$/, "djvused$1") : null;
    let djvusedExists = false;
    if (djvusedPath) {
      try {
        djvusedExists = Zotero.File.pathToFile(djvusedPath).exists();
      } catch (e) {}
    }
    if (!djvusedExists) {
      djvusedPath = await this.findExecutable("djvused");
    }

    this._djvusedPath = djvusedPath || null;
    if (this._djvusedPath) this.log(`Using djvused at: ${this._djvusedPath}`);
    return this._djvusedPath;
  }

  async getDjvuPageCount(inputPath) {
    try {
      const djvusedPath = await this.getDjvusedPath();
      if (!djvusedPath) {
        this.log("djvused not found, cannot get DJVU page count");
        return null;
      }

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

  // Extract the document outline (table of contents) from a DJVU file
  // Returns a tree of {title, page, children} with 1-based pages, or []
  async getDjvuOutline(djvuPath) {
    try {
      const djvusedPath = await this.getDjvusedPath();
      if (!djvusedPath) return [];

      const tempFile = PathUtils.join(Zotero.getTempDirectory().path, `djvu_conv_outline_${Date.now()}.txt`);

      // `ls` provides the page-id -> page-number map for named outline refs
      if (this.isWindows()) {
        const escapedTool = this.escapeWindowsPath(djvusedPath);
        const escapedInput = this.escapeWindowsPath(djvuPath);
        const escapedTemp = this.escapeWindowsPath(tempFile);
        const cmd = `"${escapedTool}" "${escapedInput}" -e "ls; print-outline" > "${escapedTemp}" 2>nul`;
        await Zotero.Utilities.Internal.exec("cmd.exe", ["/c", cmd]);
      } else {
        // djvuPath is a safe ASCII temp path
        await Zotero.Utilities.Internal.exec("/bin/sh", ["-c",
          `export LANG=en_US.UTF-8; "${djvusedPath}" "${djvuPath}" -e 'ls; print-outline' > "${tempFile}" 2>/dev/null`
        ]);
      }

      await Zotero.Promise.delay(100);

      let content = "";
      try {
        content = await Zotero.File.getContentsAsync(tempFile);
      } catch (e) {}
      try { await IOUtils.remove(tempFile); } catch (e) {}
      if (!content) return [];

      const outlineStart = content.indexOf("(bookmarks");
      if (outlineStart < 0) return [];

      const pageIndexByName = {};
      for (const line of content.slice(0, outlineStart).split(/\r?\n/)) {
        const m = line.match(/^\s*(\d+)\s+P\s+\d+\s+(.+?)\s*$/);
        if (m) pageIndexByName[m[2]] = parseInt(m[1], 10);
      }

      const outline = this.parseDjvuOutline(content.slice(outlineStart), pageIndexByName);
      this.log(`DJVU outline: ${outline.length} top-level entries`);
      return outline;
    } catch (e) {
      this.log(`Failed to extract DJVU outline: ${e.message}`);
      return [];
    }
  }

  // Parse djvused print-outline S-expression: (bookmarks ("title" "#ref" children...) ...)
  // Strings contain UTF-8 bytes as octal escapes. Returns [{title, page, children}]
  parseDjvuOutline(sexpr, pageIndexByName = {}) {
    // Tokenize into "(", ")" and decoded strings; bare atoms (bookmarks) are skipped
    const tokens = [];
    const encoder = new TextEncoder();
    let i = 0;
    while (i < sexpr.length) {
      const c = sexpr[i];
      if (c === "(" || c === ")") {
        tokens.push(c);
        i++;
      } else if (c === '"') {
        i++;
        const bytes = [];
        while (i < sexpr.length && sexpr[i] !== '"') {
          if (sexpr[i] === "\\") {
            const next = sexpr[i + 1];
            if (next >= "0" && next <= "7") {
              let oct = "";
              let j = i + 1;
              while (j < sexpr.length && oct.length < 3 && sexpr[j] >= "0" && sexpr[j] <= "7") {
                oct += sexpr[j];
                j++;
              }
              bytes.push(parseInt(oct, 8));
              i = j;
            } else {
              const map = { n: 10, t: 9, r: 13 };
              if (map[next]) bytes.push(map[next]);
              else encoder.encode(next).forEach(b => bytes.push(b));
              i += 2;
            }
          } else {
            encoder.encode(sexpr[i]).forEach(b => bytes.push(b));
            i++;
          }
        }
        i++; // closing quote
        tokens.push({ str: new TextDecoder("utf-8").decode(new Uint8Array(bytes)) });
      } else {
        i++;
      }
    }

    // Recursive descent: node = ( "title" "url" node* )
    let pos = 0;
    const parseNode = () => {
      pos++; // consume "("
      const node = { title: "", page: null, children: [] };
      if (tokens[pos] && tokens[pos].str !== undefined) {
        node.title = tokens[pos].str;
        pos++;
      }
      if (tokens[pos] && tokens[pos].str !== undefined) {
        node.page = this.resolveDjvuPageRef(tokens[pos].str, pageIndexByName);
        pos++;
      }
      while (pos < tokens.length && tokens[pos] === "(") {
        node.children.push(parseNode());
      }
      if (tokens[pos] === ")") pos++;
      return node;
    };

    const roots = [];
    if (tokens[pos] === "(") {
      pos++;
      while (pos < tokens.length && tokens[pos] === "(") {
        roots.push(parseNode());
      }
    }

    // Drop entries without a resolvable page, inheriting from first child when possible
    const fix = (nodes) => nodes
      .map(n => {
        n.children = fix(n.children);
        if (n.page === null && n.children.length > 0) n.page = n.children[0].page;
        return n;
      })
      .filter(n => n.page !== null && n.title);
    return fix(roots);
  }

  // Resolve a DJVU outline ref ("#12" or "#page_id") to a 1-based page number
  resolveDjvuPageRef(url, pageIndexByName) {
    if (!url || !url.startsWith("#")) return null;
    const ref = url.slice(1);
    if (/^\d+$/.test(ref)) return parseInt(ref, 10);
    return pageIndexByName[ref] || null;
  }

  // Encode a string as a UTF-16BE hex string for pdfmarks (handles any language)
  toUtf16BeHex(str) {
    let hex = "FEFF";
    for (let i = 0; i < str.length; i++) {
      hex += str.charCodeAt(i).toString(16).toUpperCase().padStart(4, "0");
    }
    return hex;
  }

  // Build pdfmarks content for bookmarks and document metadata
  // Returns null if there is nothing to add
  buildPdfmarks(outline, metadata, maxPage = null) {
    const lines = ["/pdfmark where {pop} {userdict /pdfmark /cleartomark load put} ifelse"];

    const emit = (node) => {
      let page = node.page;
      if (maxPage && page > maxPage) page = maxPage;
      if (page < 1) page = 1;
      let mark = `[/Title <${this.toUtf16BeHex(node.title)}> /Page ${page}`;
      if (node.children.length > 0) mark += ` /Count ${node.children.length}`;
      mark += " /OUT pdfmark";
      lines.push(mark);
      node.children.forEach(emit);
    };
    (outline || []).forEach(emit);

    const info = [];
    if (metadata && metadata.title) info.push(`/Title <${this.toUtf16BeHex(metadata.title)}>`);
    if (metadata && metadata.author) info.push(`/Author <${this.toUtf16BeHex(metadata.author)}>`);
    if (info.length > 0) lines.push(`[${info.join(" ")} /DOCINFO pdfmark`);

    return lines.length > 1 ? lines.join("\n") + "\n" : null;
  }

  // Get title/author for PDF metadata from the attachment's parent item
  getItemMetadata(item) {
    try {
      const parent = item.parentItem;
      if (!parent) return {};
      const title = parent.getField("title") || "";
      let author = "";
      try {
        author = parent.getCreators()
          .map(c => [c.firstName, c.lastName].filter(Boolean).join(" "))
          .filter(Boolean)
          .join("; ");
      } catch (e) {}
      return { title, author };
    } catch (e) {
      return {};
    }
  }

  // Add bookmarks/metadata to a PDF in place via a pdfmarks file
  // Accepts modest growth - the navigation/metadata justifies it
  async applyPdfmarksToPdf(pdfPath, marksContent, progress, getBatchPrefix = () => "") {
    const marksFile = PathUtils.join(Zotero.getTempDirectory().path, `djvu_conv_marks_${Date.now()}.ps`);
    try {
      await Zotero.File.putContentsAsync(marksFile, marksContent);
      return await this.runGsRewrite(pdfPath, {
        flags: "-dPassThroughJPEGImages=true",
        trailingFile: marksFile,
        statusText: "Adding bookmarks & metadata",
        shouldReplace: (inputSize, outputSize) => outputSize < inputSize * 1.25
      }, progress, getBatchPrefix);
    } finally {
      try { await IOUtils.remove(marksFile); } catch (e) {}
    }
  }

  async runDdjvuWithProgress(inputPath, outputPath, progress, getBatchPrefix = () => "", removeCover = false, pageMode = "color") {
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

    // Extract the outline (table of contents) while the safe temp copy exists
    const outline = await this.getDjvuOutline(tempInputPath);

    // Clean up any leftover files from previous cancelled runs
    try { await IOUtils.remove(markerFile); } catch (e) {}
    try { await IOUtils.remove(errorFile); } catch (e) {}
    try { await IOUtils.remove(logFile); } catch (e) {}
    try { await IOUtils.remove(pidFile); } catch (e) {}
    try { await IOUtils.remove(tempOutputPath); } catch (e) {}
    try { await IOUtils.remove(outputPath); } catch (e) {}

    // Skip the first page (cover) when requested - needs a known page count for the range
    let coverRemoved = false;
    let firstPage = 1;
    if (removeCover) {
      if (totalPages && totalPages > 1) {
        coverRemoved = true;
        firstPage = 2;
        this.log("Removing cover: converting pages 2-" + totalPages);
      } else {
        this.log("Cannot remove cover: page count unknown or single page, converting all pages");
      }
    }
    const pagesToConvert = totalPages ? totalPages - firstPage + 1 : null;

    // Decide which pages are rendered 1-bit ("black") and which in colour.
    // A null page list means "all pages" (no -page option needed).
    let colorPages = null;
    let blackPages = [];
    let warning = null;
    if (pageMode === "bw") {
      colorPages = [];
      blackPages = null;
    } else if (pageMode === "auto") {
      if (!totalPages) {
        warning = "Auto black & white skipped: page count unknown, converted in colour.";
      } else {
        progress.updateText(`${getBatchPrefix()}Analyzing pages for black & white conversion...`);
        const scan = await this.findColorPages(tempInputPath, totalPages);
        const all = [];
        for (let p = firstPage; p <= totalPages; p++) all.push(p);
        colorPages = all.filter(p => scan.colorPages.has(p));
        blackPages = all.filter(p => !scan.colorPages.has(p));
        this.log(`Page analysis (${scan.scanned}/${totalPages} scanned): ${blackPages.length} black & white, ${colorPages.length} colour [${this.formatPageSpec(colorPages)}]`);
        if (scan.scanned === 0) {
          warning = "Auto black & white skipped: page analysis failed, converted in colour.";
        }
        if (colorPages.length > 0 && blackPages.length > 0 && !this.qpdfPath) {
          // Mixing both kinds of pages needs qpdf to merge them in order
          warning = "Auto black & white skipped: install qpdf to combine black & white and colour pages.";
          colorPages = all;
          blackPages = [];
        }
      }
    }
    if (progress.cancelled) {
      try { await IOUtils.remove(tempInputPath); } catch (e) {}
      throw new Error("Cancelled by user");
    }

    // Build the ddjvu command(s) with -verbose for progress (cross-platform).
    // Temp paths only contain safe ASCII characters; Windows gets extra escaping.
    const win = this.isWindows();
    const q = (p) => `"${win ? this.escapeWindowsPath(p) : p}"`;
    const allPagesSpec = firstPage > 1 ? `${firstPage}-${totalPages}` : null;
    const ddjvuRun = (pages, black, out, append) => {
      const pageOpt = pages ? ` -page=${this.formatPageSpec(pages)}` : (allPagesSpec ? ` -page=${allPagesSpec}` : "");
      return `${q(this.ddjvuPath)} -format=pdf${black ? " -mode=black" : ""}${pageOpt} -verbose ${q(tempInputPath)} ${q(out)} 2${append ? ">>" : ">"}${q(logFile)}`;
    };

    let ddjvuCmd;
    const colorPath = PathUtils.join(tempDir, `${tempId}_color.pdf`);
    const blackPath = PathUtils.join(tempDir, `${tempId}_black.pdf`);
    if (colorPages === null || blackPages === null || colorPages.length === 0 || blackPages.length === 0) {
      // Single pass: every page rendered the same way
      const black = blackPages === null || (colorPages !== null && colorPages.length === 0);
      ddjvuCmd = ddjvuRun(null, black, tempOutputPath, false);
    } else {
      // Mixed: render each kind in one pass, then interleave the pages in
      // document order with qpdf (copies page content without re-encoding)
      const selection = [];
      let ci = 0, bi = 0;
      for (let p = firstPage; p <= totalPages; p++) {
        const fromColor = colorPages[ci] === p;
        const file = fromColor ? colorPath : blackPath;
        const index = fromColor ? ++ci : ++bi;
        const last = selection[selection.length - 1];
        if (last && last.file === file && last.to === index - 1) {
          last.to = index;
        } else {
          selection.push({ file, from: index, to: index });
        }
      }
      const pagesArg = selection.map(s => `${q(s.file)} ${s.from === s.to ? s.from : `${s.from}-${s.to}`}`).join(" ");
      ddjvuCmd = `${ddjvuRun(colorPages, false, colorPath, false)} && ` +
        `${ddjvuRun(blackPages, true, blackPath, true)} && ` +
        `${q(this.qpdfPath)} --warning-exit-0 --empty --pages ${pagesArg} -- ${q(tempOutputPath)} 2>>${q(logFile)}`;
    }
    if (!win) {
      ddjvuCmd = `export LANG=en_US.UTF-8; ${ddjvuCmd}`;
    }

    // Start background process using helper
    this.startBackgroundProcess(ddjvuCmd, markerFile, errorFile, pidFile);
    this._activeProcesses.set(pidFile, "ddjvu");

    // Helper to clean up all temp files
    const cleanupTempFiles = async () => {
      try { await IOUtils.remove(tempInputPath); } catch (e) {}
      try { await IOUtils.remove(tempOutputPath); } catch (e) {}
      try { await IOUtils.remove(colorPath); } catch (e) {}
      try { await IOUtils.remove(blackPath); } catch (e) {}
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
            // Count pages started (page numbers jump when colour and
            // black & white pages are rendered in separate passes)
            const pageMatches = logContent.match(/-------- page (\d+) -------/g);
            if (pageMatches && pageMatches.length > 0) {
              const done = pageMatches.length;
              pageInfo = pagesToConvert ? ` • page ${done}/${pagesToConvert}` : ` • page ${done}`;
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
            resolve({
              outline,
              coverRemoved,
              pageCount: totalPages,
              warning
            });
          } else if (error) {
            clearInterval(checkInterval);
            this._activeProcesses.delete(pidFile);
            const exitCode = await this.readExitCode(errorFile);
            // ddjvu reports errors as "ddjvu: <message>" lines amid its verbose output
            let ddjvuErrors = [];
            try {
              const logContent = await Zotero.File.getContentsAsync(logFile);
              this.log(`DJVU log file content (last 500 chars): ${logContent ? logContent.slice(-500) : 'empty'}`);
              ddjvuErrors = [...new Set((logContent || "").split("\n")
                .filter(l => l.startsWith("ddjvu:"))
                .map(l => l.slice(6).trim()))];
            } catch (e) {
              this.log(`Could not read log file: ${e.message}`);
            }
            await cleanupTempFiles();
            this.log("DJVU conversion failed");
            let errorMsg = "ddjvu failed";
            if (exitCode !== null) errorMsg += ` (exit ${exitCode})`;
            errorMsg += ddjvuErrors.length > 0
              ? `: ${ddjvuErrors.slice(-3).join(" ")}`
              : " with no error output - the file may be damaged";
            reject(new Error(errorMsg));
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
