var DJVUConverter;

function log(msg) {
  Zotero.debug(`[DJVU Converter] ${msg}`);
  // Also log to console for easier debugging
  dump(`[DJVU Converter] ${msg}\n`);
}

async function startup({ id, version, resourceURI, rootURI }) {
  log(`Starting DJVU Converter v${version}`);

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
}

function shutdown({ id, version, resourceURI, rootURI }, reason) {
  log("Shutting down DJVU Converter");

  if (DJVUConverter) {
    // Remove context menu from all windows
    const windows = Zotero.getMainWindows();
    for (const win of windows) {
      DJVUConverter.onMainWindowUnload(win);
    }
    DJVUConverter.shutdown();
    DJVUConverter = null;
  }
}

function onMainWindowLoad({ window }) {
  log("Main window loaded");
  if (DJVUConverter) {
    DJVUConverter.onMainWindowLoad(window);
  }
}

function onMainWindowUnload({ window }) {
  log("Main window unloaded");
  if (DJVUConverter) {
    DJVUConverter.onMainWindowUnload(window);
  }
}
