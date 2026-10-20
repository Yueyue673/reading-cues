(() => {
  'use strict';
  const UI = ReadingCuesUI;
  UI.mountCategories('category-choices');
  UI.mountReaderControls();
  const button = document.getElementById('site-toggle');
  const scanStatus = document.getElementById('scan-status');
  let tab, pattern, active = true, poll = 0;
  async function refresh() {
    const data = await UI.load();
    UI.showPreferences(data.settings);
    document.getElementById('sample-cue').className = UI.styleClass(data.settings.style);
    active = !data.excludedSites.includes(pattern);
    button.textContent = !pattern ? '这个页面由浏览器保护' : active ? '仅暂停这个网站' : '恢复这个网站的自动提示';
    button.disabled = !pattern;
    button.classList.toggle('primary', !active);
    document.getElementById('site-label').textContent = active && data.settings.enabled ? '全局自动运行中' : '提示已暂停';
    if (!pattern) { scanStatus.textContent = '普通网页会自动提示；浏览器内置页、商店和 PDF 等页面不支持。'; return; }
    if (!active) { scanStatus.textContent = '仅这个网站已暂停，其他网页继续自动运行。'; return; }
    if (!data.settings.enabled) { scanStatus.textContent = '所有网站的提示已暂停。'; return; }
    let statuses = [];
    try {
      const frames = await chrome.scripting.executeScript({target:{tabId:tab.id, allFrames:true},
        func:() => globalThis.__readingCuesGetStatus?.()});
      statuses = frames.map(x => x.result).filter(Boolean);
    } catch {}
    const groups = statuses.reduce((n,x) => n+x.groups,0);
    const busy = statuses.some(x => x.busy);
    scanStatus.textContent = !statuses.length ? '已自动开启。刚安装或更新时，请刷新当前网页。' :
      statuses.every(x => !x.supported) ? '请升级到支持文字高亮的 Chrome / Edge。' :
      data.settings.mode==='words' && statuses.some(x=>x.segmentationSupported===false) ? '此浏览器不支持本地分词。请升级浏览器，或选择逻辑提示模式。' :
      busy ? '正在更新正文提示…' : `当前页面提示 ${groups} 组表达${statuses.some(x => x.limited) ? '；长页面仅处理了部分正文' : ''}。`;
    if (busy && poll++ < 12) setTimeout(() => void UI.act(refresh), 250);
  }
  button.addEventListener('click', () => {
    if (!pattern) return;
    button.disabled = true;
    void UI.act(async () => {
      try {
        await UI.send({type:'site', url:tab.url, enabled:!active});
        UI.announce(active ? '这个网站已暂停。' : '已恢复自动提示。'); poll = 0;
      } finally { await refresh(); }
    });
  });
  UI.bindPreferences(refresh);
  void UI.act(async () => {
    [tab] = await chrome.tabs.query({active:true, currentWindow:true});
    pattern = ReadingCues.sitePattern(tab?.url);
    document.getElementById('site-name').textContent = pattern ? new URL(tab.url).hostname : '无需在这里操作';
    await refresh();
  });
})();
