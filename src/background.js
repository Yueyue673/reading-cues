/* MV3 worker: all writes are serialized to avoid lost personal-word / settings updates. */
importScripts('core.js');
const Core = globalThis.ReadingCues;
const SCRIPT_ID = 'reading-cues-sites';
const FILES = ['core.js', 'lexicon.js', 'renderer.js', 'content.js'];
let queue = Promise.resolve();
function serialized(task) {
  const result = queue.then(task, task);
  queue = result.catch(() => {});
  return result;
}
async function syncSites() {
  const data = await chrome.storage.local.get('sites');
  const sites = [];
  for (const pattern of data.sites || []) {
    if (Core.sitePattern(pattern) === pattern && await chrome.permissions.contains({origins: [pattern]})) sites.push(pattern);
  }
  const existing = await chrome.scripting.getRegisteredContentScripts({ids: [SCRIPT_ID]});
  if (sites.length) {
    const script = {id: SCRIPT_ID, matches: sites, js: FILES, css: ['highlights.css'], runAt: 'document_idle', persistAcrossSessions: true};
    if (existing.length) await chrome.scripting.updateContentScripts([script]);
    else await chrome.scripting.registerContentScripts([script]);
  } else if (existing.length) await chrome.scripting.unregisterContentScripts({ids: [SCRIPT_ID]});
  if (JSON.stringify(sites) !== JSON.stringify(data.sites || [])) await chrome.storage.local.set({sites});
  return sites;
}
async function mutate(message) {
  const data = await chrome.storage.local.get(['settings', 'sites']);
  const settings = Core.normalizeSettings(data.settings);
  switch (message.type) {
    case 'settings': {
      const allowed = ['enabled', 'style', 'maxGroups', 'categories'];
      const patch = Object.fromEntries(allowed.filter(k => Object.hasOwn(message.patch || {}, k)).map(k => [k, message.patch[k]]));
      await chrome.storage.local.set({settings: Core.normalizeSettings({...settings, ...patch})});
      break;
    }
    case 'add-term':
    case 'remove-term': {
      const list = message.list === 'ignored' ? 'ignored' : 'personal';
      const term = typeof message.term === 'string' ? message.term.trim() : '';
      if (!Core.safeTerm(term)) throw new Error('请输入 2–40 个字符的完整词语或短语。');
      if (message.type === 'add-term') {
        if (!settings[list].includes(term) && settings[list].length >= Core.LIMITS.terms) throw new Error('词库已达到 300 条上限，请先移除一些词条。');
        settings[list] = [...new Set([...settings[list], term])];
      } else settings[list] = settings[list].filter(x => x !== term);
      await chrome.storage.local.set({settings});
      break;
    }
    case 'import': {
      const lists = Core.parseImport(message.text);
      const next = {personal: [...new Set([...settings.personal, ...lists.personal])], ignored: [...new Set([...settings.ignored, ...lists.ignored])]};
      if (next.personal.length > 300 || next.ignored.length > 300) throw new Error('合并后超过 300 条上限，未导入。');
      await chrome.storage.local.set({settings: {...settings, ...next}});
      break;
    }
    case 'site': {
      const pattern = Core.sitePattern(message.url);
      if (!pattern) throw new Error('这个页面暂不支持提示，请打开普通网页。');
      let sites = (data.sites || []).filter(x => x !== pattern);
      if (message.enabled) {
        if (!await chrome.permissions.contains({origins: [pattern]})) throw new Error('需要先允许访问这个网站。');
        sites.push(pattern);
      }
      await chrome.storage.local.set({sites});
      try { await syncSites(); }
      catch (error) {
        await chrome.storage.local.set({sites: data.sites || []});
        try { await syncSites(); } catch { /* Surface the original registration failure. */ }
        throw new Error('网站设置未完成，已恢复原来的启用列表。请重新打开轻读后再试。', {cause: error});
      }
      if (message.enabled && Number.isInteger(message.tabId)) {
        // An already-open page needs immediate injection; subsequent visits use the registration.
        try {
          const target = {tabId: message.tabId};
          await chrome.scripting.removeCSS({target, files: ['highlights.css']});
          await chrome.scripting.insertCSS({target, files: ['highlights.css']});
          await chrome.scripting.executeScript({target, files: FILES});
        }
        catch { return {warning: '网站已启用；当前页面无法注入，请刷新网页后重试。'}; }
      }
      break;
    }
    default: throw new Error('不支持的操作。');
  }
  return {};
}
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  // Content scripts may query status themselves, but settings writes only come from extension pages.
  if (sender.id !== chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL(''))) return;
  serialized(() => mutate(message)).then(result => reply({ok: true, ...result}), error => reply({ok: false, error: error.message}));
  return true;
});
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({id: 'reading-cues-add', title: '轻读：以后提示“%s”', contexts: ['selection'], documentUrlPatterns: ['http://*/*', 'https://*/*']});
  });
  void serialized(syncSites).catch(console.error);
});
chrome.runtime.onStartup.addListener(() => { void serialized(syncSites).catch(console.error); });
chrome.permissions.onRemoved.addListener(() => { void serialized(syncSites).catch(console.error); });
chrome.contextMenus.onClicked.addListener(info => {
  if (info.menuItemId !== 'reading-cues-add') return;
  const term = info.selectionText?.trim();
  if (!Core.safeTerm(term)) { void chrome.runtime.openOptionsPage(); return; }
  void serialized(() => mutate({type: 'add-term', term})).catch(() => chrome.runtime.openOptionsPage());
});
