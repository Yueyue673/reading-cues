(() => {
  'use strict';
  const CORE = globalThis.ReadingCues;
  const BLOCKS = new Set('ADDRESS ARTICLE ASIDE BLOCKQUOTE DD DIV DL DT FIGCAPTION FIGURE FOOTER H1 H2 H3 H4 H5 H6 HEADER LI MAIN OL P SECTION TABLE TBODY TD TH THEAD TR UL'.split(' '));
  const SKIP = 'script,style,noscript,template,svg,math,canvas,iframe,object,embed,pre,code,kbd,samp,textarea,input,select,button,nav,header,footer,aside,a,strong,b,em,mark,h1,h2,h3,h4,h5,h6,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="button"],[role="navigation"],[role="menu"],[role="dialog"],[role="alert"],[aria-live]:not([aria-live="off"]),[aria-hidden="true"],[hidden],[inert],[data-reading-cues-ignore]';
  const NAMES = ['reading-cues-light', 'reading-cues-dark', 'reading-cues-line'];
  const CSS_TEXT = `
    ::highlight(reading-cues-light) { background-color: rgba(181,142,38,.17); }
    ::highlight(reading-cues-dark) { background-color: rgba(109,176,144,.18); }
    ::highlight(reading-cues-line) { text-decoration-line: underline; text-decoration-style: solid; text-decoration-color: currentColor; text-decoration-thickness: 1.5px; }
    @media (forced-colors: active) {
      ::highlight(reading-cues-light), ::highlight(reading-cues-dark) { background-color: transparent; text-decoration: underline; }
    }`;

  function* tokens(root, win) {
    const stack = [{node: root}];
    let visited = 0;
    while (stack.length) {
      const item = stack.pop();
      if (item.boundary) { yield {boundary: true}; continue; }
      const node = item.node;
      if (++visited > 60000) { yield {limit: true}; return; }
      if (node.nodeType === 3) { yield {node, text: node.data}; continue; }
      if (node.nodeType !== 1) continue;
      if (node.matches(SKIP)) { yield {boundary: true}; continue; }
      const style = win.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || style.contentVisibility === 'hidden') {
        yield {boundary: true}; continue;
      }
      if (node.tagName === 'BR' || node.tagName === 'HR') { yield {boundary: true}; continue; }
      const block = BLOCKS.has(node.tagName) || ['block', 'list-item', 'table-cell', 'flex', 'grid'].includes(style.display);
      if (block) { yield {boundary: true}; stack.push({boundary: true}); }
      for (let i = node.childNodes.length - 1; i >= 0; i--) stack.push({node: node.childNodes[i]});
    }
  }

  function toRange(doc, pieces, span) {
    const first = pieces.find(p => p.end > span.start);
    const last = pieces.find(p => p.end >= span.end);
    if (!first || !last || !first.node.isConnected || !last.node.isConnected) return null;
    const range = doc.createRange();
    range.setStart(first.node, span.start - first.start);
    range.setEnd(last.node, span.end - last.start);
    return range;
  }

  function parseColor(input) {
    const channels = input.match(/[\d.]+/g)?.map(Number);
    return channels?.length >= 3 ? channels : [0, 0, 0, 0];
  }
  function luminance(color) {
    return color.slice(0, 3).map(n => n / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4)
      .reduce((sum, n, i) => sum + n * [.2126, .7152, .0722][i], 0);
  }
  function contrast(a, b) {
    const x = luminance(a), y = luminance(b);
    return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
  }
  function bucket(range, win, cache) {
    const el = range.startContainer.parentElement;
    if (cache.has(el)) return cache.get(el);
    const fg = parseColor(win.getComputedStyle(el).color);
    const layers = [];
    let parent = el;
    let image = false;
    while (parent) {
      const style = win.getComputedStyle(parent);
      if (style.backgroundImage !== 'none') image = true;
      const color = parseColor(style.backgroundColor);
      layers.push(color);
      if ((color[3] ?? 1) >= .99) break;
      parent = parent.parentElement;
    }
    let bg = win.matchMedia('(prefers-color-scheme: dark)').matches ? [24, 24, 24] : [255, 255, 255];
    for (const color of layers.reverse()) {
      const alpha = color[3] ?? 1;
      bg = bg.map((n, i) => color[i] * alpha + n * (1 - alpha));
    }
    const dark = luminance(bg) < .2;
    const paint = dark ? [109,176,144,.18] : [181,142,38,.17];
    const result = bg.map((n, i) => paint[i] * paint[3] + n * (1 - paint[3]));
    // Fall back to a non-color cue if the background is uncertain or contrast would fall below its existing level / AA.
    const name = image || contrast(fg, result) + .01 < Math.min(4.5, contrast(fg, bg)) ? NAMES[2] : NAMES[dark ? 1 : 0];
    cache.set(el, name);
    return name;
  }

  function create({document: doc = document, lexicon = globalThis.ReadingCuesLexicon,
    settings = {}, onUpdate = () => {}, managedStyles = false} = {}) {
    const win = doc.defaultView;
    const supported = !!(win.CSS?.highlights && win.Highlight);
    let config = CORE.normalizeSettings(settings);
    let matcher = CORE.createMatcher(lexicon, config);
    let generation = 0, destroyed = false, timer = null, firstDirty = 0, observer;
    let snapshot = {supported, groups: 0, ranges: 0, limited: false, busy: false, milliseconds: 0};
    let styleNode;
    const publish = data => { snapshot = {...snapshot, ...data}; onUpdate({...snapshot}); };
    const clear = () => { for (const name of NAMES) win.CSS?.highlights?.delete(name); };
    const idle = () => new Promise(resolve => win.setTimeout(resolve, 0));

    async function scan() {
      const ticket = ++generation;
      if (destroyed) return;
      win.clearTimeout(timer); firstDirty = 0;
      // A full scan includes all mutations already queued before it begins.
      observer?.takeRecords();
      if (!supported || !config.enabled || !doc.body) { clear(); publish({groups: 0, ranges: 0, busy: false}); return; }
      const started = win.performance.now();
      publish({busy: true});
      if (!managedStyles && !styleNode?.isConnected) {
        styleNode = doc.createElement('style');
        styleNode.dataset.readingCuesStyle = '';
        styleNode.textContent = CSS_TEXT;
        (doc.head || doc.documentElement).append(styleNode);
      }
      const buckets = new Map(NAMES.map(n => [n, []]));
      const cache = new WeakMap();
      let text = '', pieces = [], groups = 0, ranges = 0, total = 0, limited = false, overflow = false;
      let sliceStarted = win.performance.now();
      const flush = () => {
        if (text && /\S/u.test(text)) {
          for (const group of matcher.match(text)) {
            if (groups >= 2000) { limited = true; break; }
            const pairRanges = group.spans.map(span => toRange(doc, pieces, span));
            if (pairRanges.some(x => !x)) continue;
            groups++;
            for (const range of pairRanges) {
              buckets.get(config.style === 'underline' ? NAMES[2] : bucket(range, win, cache)).push(range);
              ranges++;
            }
          }
        }
        text = ''; pieces = []; overflow = false;
      };
      for (const token of tokens(doc.body, win)) {
        if (ticket !== generation || destroyed) return;
        if (token.limit) { limited = true; break; }
        if (token.boundary) flush();
        else if (!overflow) {
          if (total + token.text.length > 300000 || groups >= 2000) { limited = true; break; }
          total += token.text.length;
          if (text.length + token.text.length > CORE.LIMITS.paragraph) {
            const keep = token.text.slice(0, CORE.LIMITS.paragraph - text.length);
            pieces.push({node: token.node, start: text.length, end: text.length + keep.length});
            text += keep; overflow = true; limited = true;
          } else {
            pieces.push({node: token.node, start: text.length, end: text.length + token.text.length});
            text += token.text;
          }
        }
        if (win.performance.now() - sliceStarted > 8) { await idle(); sliceStarted = win.performance.now(); }
      }
      flush();
      if (ticket !== generation || destroyed) return;
      clear();
      for (const [name, spans] of buckets) {
        const highlight = new win.Highlight();
        // Avoid spreading thousands of ranges into one function call.
        for (const range of spans) highlight.add(range);
        win.CSS.highlights.set(name, highlight);
      }
      publish({groups, ranges, limited, busy: false, milliseconds: Math.round(win.performance.now() - started)});
    }

    function schedule() {
      if (destroyed || !config.enabled) return;
      if (!firstDirty) firstDirty = Date.now();
      win.clearTimeout(timer);
      timer = win.setTimeout(() => { firstDirty = 0; void scan(); }, Math.max(0, Math.min(180, 1000 - (Date.now() - firstDirty))));
    }
    observer = new win.MutationObserver(pending => {
      // Filter our own style per record: it can share a batch with a status update.
      const records = pending.filter(r => !(r.target === styleNode || (r.type === 'childList' &&
        [...r.addedNodes, ...r.removedNodes].every(n => n === styleNode))));
      if (!records.length) return;
      // Edits inside excluded controls do not require rescanning the article.
      const relevant = records.some(r => {
        const element = r.target.nodeType === 1 ? r.target : r.target.parentElement;
        // Hiding or making a previously highlighted subtree editable must clear its ranges.
        if (r.type === 'attributes' && ['hidden', 'aria-hidden', 'contenteditable', 'data-reading-cues-ignore'].includes(r.attributeName)) return true;
        return !element?.closest(SKIP);
      });
      if (relevant) { generation++; clear(); publish({busy: config.enabled}); schedule(); }
    });
    observer.observe(doc.documentElement, {subtree: true, childList: true, characterData: true,
      attributes: true, attributeFilter: ['class', 'style', 'hidden', 'aria-hidden', 'contenteditable', 'data-reading-cues-ignore']});
    const theme = win.matchMedia('(prefers-color-scheme: dark)');
    theme.addEventListener('change', schedule);
    win.addEventListener('pageshow', schedule);

    return {
      scan,
      getSnapshot: () => ({...snapshot}),
      async setSettings(next) {
        config = CORE.normalizeSettings(next); matcher = CORE.createMatcher(lexicon, config);
        generation++; win.clearTimeout(timer); firstDirty = 0; clear();
        return scan();
      },
      destroy() {
        destroyed = true; generation++; win.clearTimeout(timer); observer.disconnect();
        theme.removeEventListener('change', schedule); win.removeEventListener('pageshow', schedule);
        clear(); styleNode?.remove(); publish({groups: 0, ranges: 0, busy: false});
      }
    };
  }
  globalThis.ReadingCuesRenderer = Object.freeze({create, cssText: CSS_TEXT});
})();
