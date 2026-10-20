(() => {
  'use strict';
  const article = document.getElementById('reading-article');
  const original = [...article.childNodes].map(n => n.cloneNode(true));
  let settings = ReadingCues.normalizeSettings();
  ReadingCuesUI.mountReaderControls();ReadingCuesUI.showPreferences(settings);
  const renderer = ReadingCuesRenderer.create({settings, onUpdate: status => {
    document.getElementById('demo-status').textContent = !status.supported ? '请使用新版 Chrome / Edge。' : !settings.enabled ? '正在阅读原文。' : status.busy ? '正在检查文字…' :
      `轻轻提示了 ${status.groups} 组表达。${status.limited ? '长文仅处理了部分内容。' : ''}`;
  }});
  // Exposed on this local demo only, for reproducible renderer testing.
  globalThis.readingCuesDemo = renderer;
  for (const input of document.querySelectorAll('[name=demo-style]')) input.addEventListener('change', () => {
    settings = {...settings, enabled: input.value !== 'original', style: input.value === 'underline' ? 'underline' : 'background'};
    ReadingCuesUI.showPreferences(settings);
    void renderer.setSettings(settings);
  });
  ReadingCuesUI.bindReaderControls(async patch=>{
    settings=ReadingCues.normalizeSettings({...settings,...patch});ReadingCuesUI.showPreferences(settings);await renderer.setSettings(settings);
  });
  document.getElementById('demo-personal-form').addEventListener('submit', event => {
    event.preventDefault(); const input = document.getElementById('demo-term'); const term = input.value.trim();
    const status = document.getElementById('demo-personal-status');
    if (!ReadingCues.safeTerm(term)) { status.textContent = '请输入 2–40 个字符的完整词语。'; return; }
    if (settings.personal.length >= 300) { status.textContent = '本次试读已达到 300 条上限。'; return; }
    settings = {...settings, personal: [...new Set([...settings.personal, term])]};
    status.textContent = `已加入“${term}”。`; input.value = ''; void renderer.setSettings(settings);
  });
  document.getElementById('use-custom').addEventListener('click', () => {
    const input = document.getElementById('custom-text').value.trim();
    if (!input) { document.getElementById('custom-status').textContent = '先粘贴一段文字。'; return; }
    article.replaceChildren(...input.split(/\n\s*\n/u).map(text => { const p = document.createElement('p'); p.textContent = text; return p; }));
    document.getElementById('custom-status').textContent = '试读文字已放到上方；可以切换样式比较。';
    void renderer.scan();
  });
  document.getElementById('restore-sample').addEventListener('click', () => {
    article.replaceChildren(...original.map(n => n.cloneNode(true))); document.getElementById('custom-text').value = '';
    document.getElementById('custom-status').textContent = '已恢复示例。'; void renderer.scan();
  });
  void renderer.scan();
})();
