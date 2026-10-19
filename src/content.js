(() => {
  'use strict';
  if (globalThis.__readingCuesContent) return;
  globalThis.__readingCuesContent = true;
  const core = globalThis.ReadingCues;
  let renderer;
  let revision = 0;
  const pattern = core.sitePattern(location.href);
  async function refresh() {
    const ticket = ++revision;
    try {
      const data = await chrome.storage.local.get(['settings', 'sites']);
      if (ticket !== revision) return;
      const settings = core.normalizeSettings(data.settings);
      settings.enabled = settings.enabled && (data.sites || []).includes(pattern);
      if (!renderer) renderer = globalThis.ReadingCuesRenderer.create({settings, managedStyles: true});
      await renderer.setSettings(settings);
    } catch {
      // An extension reload invalidates old isolated contexts; remove stale decoration.
      renderer?.destroy(); renderer = null;
    }
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes.settings || changes.sites)) void refresh();
  });
  chrome.runtime.onMessage.addListener((message, _sender, reply) => {
    if (message?.type === 'status') reply(renderer?.getSnapshot() || {supported: true, busy: true, groups: 0});
    if (message?.type === 'refresh') { void refresh().then(() => reply(renderer?.getSnapshot())); return true; }
  });
  void refresh();
})();
