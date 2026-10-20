(() => {
  'use strict';
  const samples = globalThis.ReadingCuesComparisonData;
  const byId = id => document.getElementById(id);
  const select = byId('compare-sample'), article = byId('compare-article');
  const reviews = ReadingCuesAnnotations.create();
  const renderer = ReadingCuesRenderer.create();
  const aids = ReadingCuesAids.create({managedStyles: true});
  const addButton = byId('annotation-add'), dialog = byId('custom-dialog');
  const titles = ['日常叙述', '操作说明', '科学解释'];
  let selected = samples[0], customSample = null, plan = 'chunks', revision = 0, selection = null;

  const sampleTitle = sample => sample.title?.split('·').at(-1).trim() || titles[samples.indexOf(sample)] || '自己的文字';
  const notice = (message, error = false) => {
    byId('annotation-status').textContent = message;
    byId('annotation-status').classList.toggle('error', error);
  };
  const groups = [document.createElement('optgroup'), document.createElement('optgroup')];
  groups[0].label = '最初的示例'; groups[1].label = '更多练习';
  samples.forEach((sample, i) => {
    const option = document.createElement('option');
    option.value = i; option.textContent = `${String(i + 1).padStart(2, '0')} · ${sampleTitle(sample)}`;
    groups[i < 3 ? 0 : 1].append(option);
  });
  select.append(...groups);

  function resetSelection() {
    selection = null; addButton.disabled = true;
    byId('annotation-actions').classList.remove('has-selection');
    byId('selection-label').textContent = '先选中一个词组';
    byId('selected-phrase').textContent = '拖选正文中的文字';
  }

  function drawReview() {
    for (let i = 0; i < 6; i++) CSS.highlights.delete(`reading-cues-review-${i}`);
    if (!['annotate', 'compare'].includes(plan)) return;
    const target = plan === 'compare' ? byId('compare-mine') : article;
    const highlights = Array.from({length: 6}, () => new Highlight());
    for (const span of reviews.get(selected.text).spans) {
      const range = new Range();
      range.setStart(target.firstChild, span.start); range.setEnd(target.firstChild, span.end);
      highlights[ReadingCues.colorIndex(span.text, ReadingCues.DEFAULTS.colorSeed)].add(range);
    }
    highlights.forEach((highlight, i) => CSS.highlights.set(`reading-cues-review-${i}`, highlight));
  }

  function reviewControls() {
    const data = reviews.get(selected.text), hasReview = data.spans.length > 0 || data.reviewed;
    byId('annotation-count').textContent = `本段 ${data.spans.length} 处 · ${data.reviewed ? '已确认完成' : '尚未确认完成'}`;
    byId('annotation-copy').disabled = !hasReview;
    byId('annotation-export').disabled = !reviews.size;
    byId('annotation-clear').disabled = !hasReview;
    byId('annotation-undo').disabled = !reviews.canUndo(selected.text);
    byId('review-plan').hidden = !hasReview;
    byId('session-count').textContent = reviews.size ? `${reviews.size} 段已记录` : '尚未开始';
    byId('own-review-state').textContent = data.reviewed ? '已确认的读法' : '尚未确认的草稿';
    byId('mine-empty').hidden = data.spans.length > 0;
    byId('annotation-complete').firstChild.textContent = data.spans.length ? '完成，看看对比' : '这段无需标记';
  }

  function materialInfo() {
    const index = samples.indexOf(selected), custom = index < 0;
    byId('sample-title').textContent = sampleTitle(selected);
    byId('text-length').textContent = `${[...selected.text].length} 字`;
    byId('sample-position').textContent = custom ? '自定义' : `${String(index + 1).padStart(2, '0')} / ${samples.length}`;
    byId('material-tag').textContent = custom ? '自己的文字' : `${index < 3 ? '初始示例' : '阅读练习'} · ${String(index + 1).padStart(2, '0')}`;
    byId('sample-note').textContent = selected.marks ? '这段有你最初的参考标注，可在“更多对照”中查看。' : '可以先自己标注，再查看自动标记。';
    byId('sample-previous').disabled = select.selectedIndex <= 0;
    byId('sample-next').disabled = select.selectedIndex >= select.options.length - 1;
  }

  async function render() {
    const own = reviews.get(selected.text);
    if (plan === 'compare' && !own.spans.length && !own.reviewed) plan = 'chunks';
    const ticket = ++revision, text = selected.text, currentPlan = plan;
    const comparing = currentPlan === 'compare', annotating = currentPlan === 'annotate';
    resetSelection(); for (let i = 0; i < 6; i++) CSS.highlights.delete(`reading-cues-review-${i}`);
    article.textContent = text; byId('compare-mine').textContent = comparing ? text : '';
    document.body.dataset.mode = currentPlan;
    byId('paper-grid').classList.toggle('is-comparing', comparing);
    byId('own-sheet').hidden = !comparing; byId('auto-label').hidden = !comparing;
    byId('annotation-panel').hidden = !annotating; byId('annotation-actions').hidden = !annotating;
    byId('density-control').hidden = !['chunks', 'compare'].includes(currentPlan);
    byId('compare-density').disabled = !['chunks', 'compare'].includes(currentPlan);
    byId('manual-plan').disabled = !selected.marks;
    byId('pieces-details').hidden = currentPlan === 'original';
    document.querySelectorAll('[data-plan]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.plan === currentPlan)));
    byId('mode-instruction').textContent = {
      original: '先完整读一遍，再试试不同标记。',
      chunks: '先读一遍，感受词组边界。',
      annotate: '拖选你想连在一起读的词组，再点「标记」。',
      compare: '同一段文字，看看哪里与你的读法不同。',
      words: '旧版逐词标记，留作对照。',
      personal: '你最初为这段文字提供的参考标注。'
    }[currentPlan];
    byId('mode-caption').textContent = ['chunks', 'compare'].includes(currentPlan) ? ({light: '少一些', balanced: '适中', more: '多一些'}[byId('compare-density').value]) : '';
    byId('compare-status').textContent = '正在准备…';
    byId('reading-footnote').textContent = annotating ? 'Ctrl / ⌘ + Enter 快速标记' : '原文与换行保持不变';
    materialInfo(); reviewControls();

    const settings = ReadingCues.normalizeSettings({
      enabled: !['original', 'annotate'].includes(currentPlan),
      mode: currentPlan === 'personal' ? 'personal' : currentPlan === 'words' ? 'words' : 'chunks',
      chunkDensity: byId('compare-density').value,
      personal: currentPlan === 'personal' ? selected.marks || [] : []
    });
    await renderer.setSettings(settings); await renderer.scan();
    if (ticket !== revision) return;
    const matches = annotating ? own.spans.map(span => ({spans: [span]})) : currentPlan === 'original' ? [] : ReadingCues.createReader(ReadingCuesLexicon, settings).match(text);
    const pieces = byId('chosen-pieces'); pieces.replaceChildren();
    for (const group of matches) {
      const word = group.spans.map(span => text.slice(span.start, span.end)).join(' … ');
      const el = document.createElement(annotating ? 'button' : 'span'); el.textContent = word;
      if (annotating) {
        el.type = 'button'; el.setAttribute('aria-label', `移除标注：${word}`);
        el.addEventListener('click', () => { reviews.remove(text, group.spans[0].start, group.spans[0].end); notice('已移除，可以撤销。'); void render(); });
      }
      pieces.append(el);
    }
    byId('pieces-heading').textContent = annotating ? '你的词组 · 点一下可移除' : comparing ? '自动标记的词组' : '标记的词组';
    byId('pieces-count').textContent = `${matches.length} 处`;
    byId('pieces-empty').hidden = matches.length > 0;
    byId('pieces-empty').textContent = annotating ? '还没有标注。先在正文中选一个词组。' : '这段没有标记，也可以试试其他密度。';
    drawReview(); reviewControls();
    byId('compare-status').textContent = currentPlan === 'original' ? '原文，没有标记。' : annotating ? `自行标注 · ${own.spans.length} 处` : `当前 ${matches.length} 组`;
  }

  function setPlan(next) {
    plan = next; byId('more-schemes').open = false; void render();
  }
  function changeSample() {
    selected = select.value === 'custom' ? customSample : samples[Number(select.value)];
    if (plan === 'personal' && !selected.marks) plan = 'chunks';
    notice(''); void render();
  }
  function addSelection() {
    if (plan !== 'annotate' || !selection) return;
    try { reviews.add(selected.text, selection.start, selection.end, selected); notice('已标记。选中重叠内容可调整边界。'); window.getSelection()?.removeAllRanges(); void render(); }
    catch (error) { notice(error.message, true); }
  }
  function undo() {
    reviews.undo(selected.text); notice('已撤销上一步。'); void render();
  }
  document.addEventListener('selectionchange', () => {
    resetSelection(); if (plan !== 'annotate') return;
    const sel = window.getSelection(); if (!sel?.rangeCount || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    if (!article.contains(range.startContainer) || !article.contains(range.endContainer)) return;
    const before = new Range(); before.selectNodeContents(article); before.setEnd(range.startContainer, range.startOffset);
    const start = before.toString().length, end = start + range.toString().length;
    const word = selected.text.slice(start, end).trim(), length = [...word].length;
    if (length < 2 || length > 80) {
      byId('selected-phrase').textContent = '请选择 2–80 个字符'; return;
    }
    selection = {start, end}; addButton.disabled = false;
    byId('annotation-actions').classList.add('has-selection');
    byId('selection-label').textContent = `选中了 ${length} 个字`;
    byId('selected-phrase').textContent = word;
  });
  document.addEventListener('keydown', event => {
    if (dialog.open || /^(?:INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) return;
    if ((event.ctrlKey || event.metaKey) && plan === 'annotate') {
      if (event.key === 'Enter' && selection) { event.preventDefault(); addSelection(); }
      if (event.key.toLowerCase() === 'z' && !event.shiftKey && reviews.canUndo(selected.text)) { event.preventDefault(); undo(); }
    }
    if (event.key === 'Escape') byId('more-schemes').open = false;
  });
  document.addEventListener('pointerdown', event => { if (!byId('more-schemes').contains(event.target)) byId('more-schemes').open = false; });
  addButton.addEventListener('pointerdown', event => { if (event.pointerType !== 'touch') event.preventDefault(); });
  addButton.addEventListener('click', addSelection);
  byId('annotation-undo').addEventListener('click', undo);
  byId('annotation-clear').addEventListener('click', () => { reviews.clear(selected.text); notice('已清空本段，可以撤销。'); void render(); });
  byId('annotation-complete').addEventListener('click', () => {
    try { reviews.complete(selected.text, selected); notice('已完成这一段。你的标注已保留在右侧对照。'); setPlan('compare'); }
    catch (error) { notice(error.message, true); }
  });
  byId('annotation-edit').addEventListener('click', () => setPlan('annotate'));
  byId('annotation-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(reviews.exportJSON(selected.text)); notice('已复制本段标注，可以粘贴回聊天。'); }
    catch { notice('浏览器未允许复制，请用“导出标注文件”。', true); }
  });
  byId('annotation-export').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([reviews.exportJSON()], {type: 'application/json;charset=utf-8'}));
    const link = document.createElement('a'); link.href = url; link.download = 'reading-cues-annotations.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); notice('已导出全部标注，草稿也一起保留。');
  });
  document.querySelectorAll('[data-plan]').forEach(button => button.addEventListener('click', () => setPlan(button.dataset.plan)));
  select.addEventListener('change', changeSample);
  byId('sample-previous').addEventListener('click', () => { select.selectedIndex--; changeSample(); });
  byId('sample-next').addEventListener('click', () => { select.selectedIndex++; changeSample(); });
  byId('compare-density').addEventListener('change', () => void render());
  byId('studio-aid').addEventListener('change', () => aids.setSettings({aidMode: byId('studio-aid').value}));
  byId('custom-open').addEventListener('click', () => { dialog.showModal(); byId('compare-custom').focus(); });
  for (const id of ['custom-close', 'custom-cancel']) byId(id).addEventListener('click', () => dialog.close());
  byId('compare-custom').addEventListener('input', () => {
    const text = byId('compare-custom').value;
    byId('custom-length').textContent = `${text.length} / 8000`; byId('compare-use').disabled = !text.trim(); byId('custom-error').textContent = '';
  });
  byId('compare-use').addEventListener('click', () => {
    const text = byId('compare-custom').value.trim();
    if (!text) return;
    selected = customSample = {id: 'local-custom', title: '我的文字', text};
    if (!select.querySelector('[value=custom]')) { const option = document.createElement('option'); option.value = 'custom'; option.textContent = '我的文字'; select.append(option); }
    select.value = 'custom';
    if (['personal', 'compare'].includes(plan)) plan = 'chunks';
    notice(''); dialog.close(); void render();
  });
  globalThis.readingCuesComparison = renderer;
  document.documentElement.style.setProperty('--review-opacity', ReadingCues.DEFAULTS.intensity / 100);
  ReadingCues.PALETTE.forEach((color, i) => document.documentElement.style.setProperty(`--review-${i}`, [1, 3, 5].map(n => parseInt(color.slice(n, n + 2), 16)).join(' ')));
  void render();
})();
