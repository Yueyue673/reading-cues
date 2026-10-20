(() => {
  'use strict';
  const VERSION = '0.6.1';
  if (globalThis.__readingCuesVersion === VERSION) return;
  globalThis.__readingCuesController?.dispose();
  globalThis.__readingCuesVersion = VERSION;
  const core = globalThis.ReadingCues;
  let renderer, aids, revision = 0, topPattern;
  const pageContext = chrome.runtime.sendMessage({type:'page-context'}).then(result => {
    topPattern = result?.topPattern;
  }).catch(() => {});

  async function refresh() {
    const ticket = ++revision;
    try {
      await pageContext;
      const data = await chrome.storage.local.get(['settings', 'excludedSites']);
      if (ticket !== revision) return;
      const settings = core.normalizeSettings(data.settings);
      settings.enabled = core.isSiteEnabled(location.href, settings, data.excludedSites || [], topPattern || location.href);
      if (!renderer && settings.enabled) renderer = globalThis.ReadingCuesRenderer.create({settings, managedStyles:true});
      await renderer?.setSettings(settings);
      if (ticket !== revision) return;
      if (!aids && settings.enabled) aids = ReadingCuesAids.create({managedStyles:true});
      aids?.setSettings(settings);
    } catch {
      renderer?.destroy(); aids?.destroy(); renderer = aids = null;
    }
  }
  const storageListener = (changes, area) => {
    if (area === 'local' && (changes.settings || changes.excludedSites)) void refresh();
  };
  const getStatus = () => renderer?.getSnapshot() || {supported:true, busy:false, groups:0, ranges:0};
  const messageListener = (message, _sender, reply) => {
    if (message?.type === 'status') reply(getStatus());
    if (message?.type === 'refresh') { void refresh().then(() => reply(getStatus())); return true; }
  };
  chrome.storage.onChanged.addListener(storageListener);
  chrome.runtime.onMessage.addListener(messageListener);
  globalThis.__readingCuesGetStatus = getStatus;
  globalThis.__readingCuesController = {dispose() {
    revision++; renderer?.destroy(); aids?.destroy();
    chrome.storage.onChanged.removeListener(storageListener);
    chrome.runtime.onMessage.removeListener(messageListener);
  }};
  void refresh();
})();
