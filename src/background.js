/* Global-by-default MV3 worker. Settings writes are serialized. */
importScripts('core.js');
const Core = globalThis.ReadingCues;
const FILES = ['core.js', 'lexicon.js', 'renderer.js', 'content.js'];
let queue = Promise.resolve();
function serialized(task) {
  const result = queue.then(task, task);
  queue = result.catch(() => {});
  return result;
}

async function migrateStorage() {
  const data = await chrome.storage.local.get(['settings', 'excludedSites', 'storageVersion']);
  if (data.storageVersion === 3) return;
  const settings = Core.normalizeSettings(data.settings);
  if (data.storageVersion !== 2 && data.settings?.categories) {
    const old = ['restriction', 'condition', 'contrast'];
    settings.categories = [...new Set([...settings.categories, ...Core.CATEGORIES.filter(x => !old.includes(x))])];
  }
  if (!data.settings || (data.storageVersion !== 2 && data.settings.maxGroups === 2)) settings.maxGroups = 0;
  await chrome.storage.local.set({settings, excludedSites:data.excludedSites || [], storageVersion:3});
  await chrome.storage.local.remove('sites');
}

async function cleanupLegacyScripts() {
  const scripts = await chrome.scripting.getRegisteredContentScripts({ids:['reading-cues-sites']});
  if (scripts.length) await chrome.scripting.unregisterContentScripts({ids:['reading-cues-sites']});
}

async function injectExistingTabs() {
  const tabs = await chrome.tabs.query({url:['http://*/*', 'https://*/*']});
  for (const tab of tabs) {
    const target = {tabId:tab.id, allFrames:true};
    try {
      await chrome.scripting.removeCSS({target, files:['highlights.css']});
      await chrome.scripting.insertCSS({target, files:['highlights.css']});
      await chrome.scripting.executeScript({target, files:FILES});
    } catch { /* Browser-protected pages stay untouched; no page notifications. */ }
  }
}

async function mutate(message) {
  const data = await chrome.storage.local.get(['settings', 'excludedSites']);
  const settings = Core.normalizeSettings(data.settings);
  switch (message.type) {
    case 'settings': {
      const allowed = ['enabled', 'mode', 'style', 'maxGroups', 'categories', 'wordStep', 'lightColor', 'darkColor', 'intensity'];
      const patch = Object.fromEntries(allowed.filter(k => Object.hasOwn(message.patch || {}, k)).map(k => [k, message.patch[k]]));
      await chrome.storage.local.set({settings:Core.normalizeSettings({...settings, ...patch})});
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
      const next = {personal:[...new Set([...settings.personal, ...lists.personal])], ignored:[...new Set([...settings.ignored, ...lists.ignored])]};
      if (next.personal.length > 300 || next.ignored.length > 300) throw new Error('合并后超过 300 条上限，未导入。');
      await chrome.storage.local.set({settings:{...settings, ...next}});
      break;
    }
    case 'site': {
      const pattern = Core.sitePattern(message.url);
      if (!pattern) throw new Error('这个页面不支持提示。');
      const excludedSites = (data.excludedSites || []).filter(x => x !== pattern);
      if (!message.enabled) excludedSites.push(pattern);
      await chrome.storage.local.set({excludedSites});
      break;
    }
    default: throw new Error('不支持的操作。');
  }
  return {};
}

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id) return;
  if (message?.type === 'page-context' && sender.tab) {
    reply({topPattern:Core.sitePattern(sender.tab.url)});
    return;
  }
  if (!sender.url?.startsWith(chrome.runtime.getURL(''))) return;
  serialized(() => mutate(message)).then(result => reply({ok:true, ...result}), error => reply({ok:false, error:error.message}));
  return true;
});
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({id:'reading-cues-add', title:'轻读：以后提示“%s”', contexts:['selection'], documentUrlPatterns:['http://*/*', 'https://*/*']});
  });
  void serialized(async () => { await migrateStorage(); await cleanupLegacyScripts(); await injectExistingTabs(); }).catch(console.error);
});
chrome.runtime.onStartup.addListener(() => {
  void serialized(async () => { await migrateStorage(); await cleanupLegacyScripts(); }).catch(console.error);
});
chrome.contextMenus.onClicked.addListener(info => {
  if (info.menuItemId !== 'reading-cues-add') return;
  const term = info.selectionText?.trim();
  if (!Core.safeTerm(term)) { void chrome.runtime.openOptionsPage(); return; }
  void serialized(() => mutate({type:'add-term', term})).catch(() => chrome.runtime.openOptionsPage());
});
