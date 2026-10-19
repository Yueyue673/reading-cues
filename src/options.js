(() => {
  'use strict';
  const UI = ReadingCuesUI;
  let settings;
  function renderList(name, items) {
    const list = document.getElementById(`${name}-list`);
    list.replaceChildren();
    if (!items.length) { const p = document.createElement('li'); p.className = 'empty'; p.textContent = '还没有词条。'; list.append(p); }
    for (const term of items) {
      const li = document.createElement('li'), span = document.createElement('span'), button = document.createElement('button');
      span.className = 'term'; span.textContent = term;
      button.textContent = '移除'; button.setAttribute('aria-label', `移除${term}`);
      button.addEventListener('click', () => void UI.act(async () => {
        await UI.send({type: 'remove-term', list: name, term});
        await refresh(); UI.announce(`已移除“${term}”。`);
        document.getElementById(`${name}-term`).focus();
      }));
      li.append(span, button); list.append(li);
    }
    document.getElementById(`${name}-count`).textContent = `${items.length} / 300 条 · 每条 2–40 个字符`;
  }
  async function refresh() {
    const data = await UI.load(); settings = data.settings;
    UI.showPreferences(settings);
    renderList('personal', settings.personal); renderList('ignored', settings.ignored);
    const list = document.getElementById('sites-list'); list.replaceChildren();
    if (!data.sites.length) { const li = document.createElement('li'); li.className = 'empty'; li.textContent = '还没有启用的网站。'; list.append(li); }
    for (const site of data.sites) {
      const li = document.createElement('li'), span = document.createElement('span'), button = document.createElement('button');
      span.textContent = site; button.textContent = '关闭并撤回权限'; button.setAttribute('aria-label', `关闭${site}并撤回权限`);
      button.addEventListener('click', () => void UI.act(async () => {
        await UI.send({type: 'site', url: site, enabled: false});
        await chrome.permissions.remove({origins: [site]});
        await refresh(); UI.announce('网站已关闭，访问权限已撤回。');
      }));
      li.append(span, button); list.append(li);
    }
  }
  for (const name of ['personal', 'ignored']) {
    document.getElementById(`${name}-form`).addEventListener('submit', event => {
      event.preventDefault(); const input = document.getElementById(`${name}-term`);
      void UI.act(async () => {
        await UI.send({type: 'add-term', list: name, term: input.value}); input.value = '';
        await refresh(); UI.announce(name === 'personal' ? '已加入个人词库。' : '已设为不再提示。'); input.focus();
      });
    });
  }
  UI.bindPreferences(async () => { await refresh(); UI.announce('偏好已保存，已启用的网页会自动更新。'); });
  document.getElementById('export').addEventListener('click', () => {
    const blob = new Blob([ReadingCues.exportDictionary(settings)], {type: 'application/json'});
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = 'reading-cues-personal.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); UI.announce('个人词库已导出。');
  });
  document.getElementById('import-file').addEventListener('change', event => {
    const file = event.target.files[0]; if (!file) return;
    void UI.act(async () => {
      try {
        if (file.size > ReadingCues.LIMITS.importBytes) throw new Error('文件超过 100 KB，未导入。');
        await UI.send({type: 'import', text: await file.text()}); await refresh(); UI.announce('词库已合并；重复词条已跳过。');
      } finally { event.target.value = ''; }
    });
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes.settings || changes.sites)) void UI.act(refresh);
  });
  void UI.act(refresh);
})();
