(() => {
  'use strict';
  async function send(message) {
    const result = await chrome.runtime.sendMessage(message);
    if (!result?.ok) throw new Error(result?.error || '操作未完成，请重新打开轻读后再试。');
    return result;
  }
  async function load() {
    const data = await chrome.storage.local.get(['settings', 'excludedSites']);
    return {settings: ReadingCues.normalizeSettings(data.settings), excludedSites: data.excludedSites || []};
  }
  function announce(text, error = false) {
    const el = document.getElementById('message');
    el.textContent = text;
    el.classList.toggle('error', error);
  }
  async function act(fn) {
    try { return await fn(); } catch (error) { announce(error.message, true); }
  }
  function bindPreferences(onChange) {
    document.querySelectorAll('[name=style]').forEach(input => input.addEventListener('change', () => {
      if (input.checked) void act(() => send({type: 'settings', patch: {style: input.value}}).then(onChange));
    }));
    document.querySelectorAll('[name=category]').forEach(input => input.addEventListener('change', () => {
      const categories = [...document.querySelectorAll('[name=category]:checked')].map(x => x.value);
      void act(() => send({type: 'settings', patch: {categories}}).then(onChange));
    }));
    document.getElementById('density')?.addEventListener('change', event => {
      void act(() => send({type: 'settings', patch: {maxGroups: Number(event.target.value)}}).then(onChange));
    });
    document.getElementById('global-pause')?.addEventListener('change', event => {
      void act(() => send({type: 'settings', patch: {enabled: !event.target.checked}}).then(onChange));
    });
  }
  function mountCategories(id) {
    const root = document.getElementById(id);
    if (!root) return;
    for (const [category, title] of Object.entries(ReadingCues.CATEGORY_LABELS)) {
      const label = document.createElement('label'), input = document.createElement('input');
      input.type = 'checkbox'; input.name = 'category'; input.value = category;
      label.append(input, document.createTextNode(title)); root.append(label);
    }
  }
  function showPreferences(settings) {
    for (const input of document.querySelectorAll('[name=style]')) input.checked = settings.style === input.value;
    for (const input of document.querySelectorAll('[name=category]')) input.checked = settings.categories.includes(input.value);
    if (document.getElementById('density')) document.getElementById('density').value = settings.maxGroups;
    if (document.getElementById('global-pause')) document.getElementById('global-pause').checked = !settings.enabled;
  }
  globalThis.ReadingCuesUI = {send, load, announce, act, bindPreferences, showPreferences, mountCategories};
})();
