(() => {
  'use strict';
  const UI = ReadingCuesUI;
  const button = document.getElementById('site-toggle');
  const scanStatus = document.getElementById('scan-status');
  let tab, pattern, enabled = false, poll = 0;
  async function refresh() {
    const data = await UI.load();
    UI.showPreferences(data.settings);
    document.getElementById('sample-cue').className = data.settings.style === 'background' ? 'preview-mark' : 'preview-line';
    enabled = data.sites.includes(pattern);
    button.textContent = !pattern ? '请先打开普通网页' : enabled ? '在这个网站关闭' : '在这个网站启用';
    button.disabled = !pattern;
    button.classList.toggle('primary', !enabled);
    document.getElementById('site-label').textContent = enabled ? '已启用的网站' : '当前网站';
    if (!pattern) { scanStatus.textContent = '浏览器设置页、扩展商店和 PDF 等页面可能不支持。'; return; }
    if (!enabled) { scanStatus.textContent = '启用时，浏览器会请求这个网站的访问权限。'; return; }
    if (!data.settings.enabled) { scanStatus.textContent = '所有网站的提示已暂停。'; return; }
    let status;
    try { status = await chrome.tabs.sendMessage(tab.id, {type: 'status'}); } catch {}
    scanStatus.textContent = !status ? '请刷新网页；部分受保护页面无法提示。' : !status.supported ? '当前浏览器不支持文字高亮，请升级 Chrome / Edge。' :
      status.busy ? '正在检查正文…' : `当前页面提示 ${status.groups} 组表达${status.limited ? '；长页面仅处理了部分正文' : ''}。`;
    if (status?.busy && poll++ < 8) setTimeout(() => void UI.act(refresh), 250);
  }
  button.addEventListener('click', () => {
    if (!pattern) return;
    const next = !enabled;
    button.disabled = true;
    // This request is directly inside the user's click, before any other async work.
    const grant = next ? chrome.permissions.request({origins: [pattern]}) : Promise.resolve(true);
    void UI.act(async () => {
      try {
        if (!await grant) { UI.announce('没有获得权限，网站保持关闭。'); return; }
        const result = await UI.send({type: 'site', url: tab.url, enabled: next, tabId: tab.id});
        UI.announce(result.warning || (next ? '已启用；以后访问这个网站也会生效。' : '这个网站的提示已关闭。'));
        poll = 0;
      } finally { await refresh(); }
    });
  });
  UI.bindPreferences(refresh);
  void UI.act(async () => {
    [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    pattern = ReadingCues.sitePattern(tab?.url);
    document.getElementById('site-name').textContent = pattern ? new URL(tab.url).hostname : '暂不支持这个页面';
    await refresh();
  });
})();
