var DJVUConverter;

function log(msg) {
  Zotero.debug(`[DJVU Converter] ${msg}`);
  // Also log to console for easier debugging
  dump(`[DJVU Converter] ${msg}\n`);
}

async function startup({ id, version, resourceURI, rootURI }) {
  log(`Starting DJVU Converter v${version}`);

  try {
    // Wait for Zotero to be ready
    await Zotero.uiReadyPromise;

    Services.scriptloader.loadSubScript(rootURI + "src/djvu-converter.js");

    DJVUConverter = new ZoteroDJVUConverter();
    await DJVUConverter.init();

    // Register notifier immediately on startup
    DJVUConverter.registerNotifier();

    // Add context menu to existing windows
    const windows = Zotero.getMainWindows();
    for (const win of windows) {
      DJVUConverter.onMainWindowLoad(win);
    }

    log("Startup complete - notifier and context menu registered");
  } catch (e) {
    log(`Startup error: ${e.message}`);
    Zotero.debug(`[DJVU Converter] Startup error stack: ${e.stack}`);
  }
}

function shutdown({ id, version, resourceURI, rootURI }, reason) {
  log("Shutting down DJVU Converter");

  try {
    if (DJVUConverter) {
      // Remove context menu from all windows
      const windows = Zotero.getMainWindows();
      for (const win of windows) {
        try {
          DJVUConverter.onMainWindowUnload(win);
        } catch (e) {
          log(`Error unloading window: ${e.message}`);
        }
      }
      DJVUConverter.shutdown();
      DJVUConverter = null;
    }
  } catch (e) {
    log(`Shutdown error: ${e.message}`);
  }
}

function onMainWindowLoad({ window }) {
  try {
    if (DJVUConverter) {
      DJVUConverter.onMainWindowLoad(window);
    }
  } catch (e) {
    log(`Window load error: ${e.message}`);
  }
}

function onMainWindowUnload({ window }) {
  try {
    if (DJVUConverter) {
      DJVUConverter.onMainWindowUnload(window);
    }
  } catch (e) {
    log(`Window unload error: ${e.message}`);
  }
}
