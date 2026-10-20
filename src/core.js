/* Pure matching and settings logic. No DOM, network or browser extension APIs. */
(() => {
  'use strict';
  const CATEGORY_LABELS = Object.freeze({restriction:'否定、范围与不确定性', condition:'条件与例外',
    contrast:'转折与让步', cause:'因果与推论', addition:'递进与并列', sequence:'顺序与时间',
    explanation:'解释、举例与归纳', quantity:'数值、日期与时长', concept:'完整概念'});
  const CATEGORIES = Object.keys(CATEGORY_LABELS);
  const DEFAULTS = Object.freeze({
    enabled: true, style: 'background', maxGroups: 0,
    categories: Object.freeze([...CATEGORIES]), personal: Object.freeze([]), ignored: Object.freeze([])
  });
  const LIMITS = Object.freeze({ terms: 300, termLength: 40, importBytes: 100000, paragraph: 8000 });
  const BREAK = /[。！？!?；;\n\r]/u;
  const UNSAFE = ['差点没', '差點沒', '差一点没', '差一點沒', '不但', '不仅', '不僅', '不得不'];
  const safeTerm = value => typeof value === 'string' && value === value.trim() &&
    [...value].length >= 2 && [...value].length <= LIMITS.termLength && !/[\p{C}\n\r<>]/u.test(value);

  function terms(value, strict = false) {
    if (!Array.isArray(value) || value.length > LIMITS.terms || value.some(x => !safeTerm(x))) {
      if (strict) throw new Error('词条须为 2–40 个字符，最多 300 条；不能包含控制字符或尖括号。');
      return [];
    }
    return [...new Set(value)];
  }

  function normalizeSettings(raw = {}) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) raw = {};
    return {
      enabled: typeof raw.enabled === 'boolean' ? raw.enabled : true,
      style: ['background', 'underline'].includes(raw.style) ? raw.style : DEFAULTS.style,
      maxGroups: [0, 1, 2, 3, 5, 8].includes(raw.maxGroups) ? raw.maxGroups : DEFAULTS.maxGroups,
      categories: Array.isArray(raw.categories) ? CATEGORIES.filter(x => raw.categories.includes(x)) : [...CATEGORIES],
      personal: terms(raw.personal), ignored: terms(raw.ignored)
    };
  }

  function parseImport(input) {
    if (typeof input !== 'string' || new TextEncoder().encode(input).length > LIMITS.importBytes) {
      throw new Error('导入文件过大，请使用小于 100 KB 的 JSON 文件。');
    }
    let raw;
    try { raw = JSON.parse(input); } catch { throw new Error('这不是有效的 JSON 文件。'); }
    if (!raw || raw.schemaVersion !== 1 || !Array.isArray(raw.personal) || !Array.isArray(raw.ignored)) {
      throw new Error('文件格式不支持，需要轻读 schemaVersion: 1 的个人词库。');
    }
    // Import only two explicit lists. Never accept sites, permissions or arbitrary settings.
    return { personal: terms(raw.personal, true), ignored: terms(raw.ignored, true) };
  }

  function exportDictionary(settings) {
    const {personal, ignored} = normalizeSettings(settings);
    return JSON.stringify({ schemaVersion: 1, personal, ignored }, null, 2) + '\n';
  }

  function sitePattern(input) {
    try {
      const url = new URL(input);
      if (!['http:', 'https:'].includes(url.protocol)) return null;
      // Browser match patterns cannot restrict ports. No wildcard subdomains.
      return `${url.protocol}//${url.hostname}/*`;
    } catch { return null; }
  }

  function isSiteEnabled(input, settings = {}, excludedSites = [], topInput = input) {
    const pattern = sitePattern(input), top = sitePattern(topInput);
    return !!pattern && normalizeSettings(settings).enabled &&
      !excludedSites.includes(pattern) && !(top && excludedSites.includes(top));
  }

  function paragraphBudget(text, maxGroups = DEFAULTS.maxGroups) {
    const length = text.replace(/\s/gu, '').length;
    return {groups: maxGroups || Math.min(16, Math.max(2, Math.ceil(length / 100) * 2)),
      characters: Math.max(12, Math.floor(length * .22))};
  }

  function occurrences(text, form) {
    const spans = [];
    for (let i = text.indexOf(form); i !== -1; i = text.indexOf(form, i + form.length)) {
      spans.push({start: i, end: i + form.length});
    }
    return spans;
  }
  const intersects = (a, b) => a.start < b.end && b.start < a.end;
  const overlaps = (a, b) => a.spans.some(x => b.spans.some(y => intersects(x, y)));
  const spanSize = item => item.spans.reduce((sum, x) => sum + x.end - x.start, 0);

  function validateLexicon(data) {
    if (!data || data.schemaVersion !== 1 || !Array.isArray(data.entries)) throw new Error('Invalid lexicon');
    const ids = new Set();
    for (const e of data.entries) {
      if (!e.id || ids.has(e.id) || !CATEGORIES.includes(e.category) ||
          !['literal', 'pair', 'pattern'].includes(e.kind) || !Number.isFinite(e.priority) ||
          !e.source || !Array.isArray(e.examples?.positive) || !e.examples.positive.length ||
          !Array.isArray(e.examples?.negative) || !e.examples.negative.length) {
        throw new Error(`Invalid entry: ${e.id}`);
      }
      ids.add(e.id);
      if (e.kind === 'literal' && (!e.forms?.length || e.forms.some(x => !safeTerm(x)))) throw new Error(`Invalid forms: ${e.id}`);
      if (e.kind === 'pair' && (!e.pairs?.length || e.pairs.some(x => !Array.isArray(x) || x.length !== 2 || x.some(y => typeof y !== 'string' || !y.length)) ||
          !Number.isInteger(e.maxGap) || e.maxGap < 1 || e.maxGap > 120)) throw new Error(`Invalid pairs: ${e.id}`);
      if (e.kind === 'pattern') {
        // Patterns are shipped code-reviewed rules, never accepted from personal imports.
        if (typeof e.pattern !== 'string' || e.pattern.length > 500) throw new Error(`Invalid pattern: ${e.id}`);
        const expression = new RegExp(e.pattern, 'gu');
        if (expression.test('')) throw new Error(`Empty pattern: ${e.id}`);
      }
    }
    return data;
  }

  function createMatcher(lexicon, rawSettings = {}) {
    validateLexicon(lexicon);
    const settings = normalizeSettings(rawSettings);
    const entries = lexicon.entries.filter(e => settings.categories.includes(e.category));
    // Trie avoids scanning every personal word against every text character.
    const trie = new Map();
    const add = (form, entry) => {
      let branch = trie;
      for (let i = 0; i < form.length; i++) {
        if (!branch.has(form[i])) branch.set(form[i], new Map());
        branch = branch.get(form[i]);
      }
      if (!branch.has(null)) branch.set(null, []);
      branch.get(null).push({...entry, form});
    };
    for (const e of entries.filter(x => x.kind === 'literal')) for (const form of e.forms) add(form, e);
    for (const form of settings.personal) add(form, {id: `personal:${form}`, category: 'personal', priority: 1000});
    const pairs = entries.filter(e => e.kind === 'pair');
    const patterns = entries.filter(e => e.kind === 'pattern').map(e => ({...e, expression:new RegExp(e.pattern, 'gu')}));

    function match(text, {budget = true} = {}) {
      if (typeof text !== 'string' || !settings.enabled) return [];
      text = text.slice(0, LIMITS.paragraph);
      const ignored = settings.ignored.flatMap(form => occurrences(text, form));
      const unsafe = UNSAFE.flatMap(form => occurrences(text, form));
      const candidates = [];
      const accept = candidate => {
        if (candidate.spans.some(span => ignored.some(x => intersects(span, x)))) return;
        if (!candidate.allowUnsafe && candidate.category !== 'personal' && candidate.spans.some(span => unsafe.some(x => intersects(span, x)))) return;
        candidates.push(candidate);
      };

      for (let start = 0; start < text.length; start++) {
        let branch = trie;
        for (let end = start; end < text.length && branch.has(text[end]); end++) {
          branch = branch.get(text[end]);
          for (const entry of branch.get(null) || []) {
            const span = {start, end: end + 1};
            const excluded = (entry.excludePhrases || []).some(form => occurrences(text, form).some(x => intersects(span, x)));
            const before = text[start - 1] || '', after = text[end + 1] || '';
            const invalidBoundary = entry.boundary === 'word' && /[A-Za-z0-9_]/u.test(before + after);
            if (!excluded && !invalidBoundary) accept({id: entry.id, category: entry.category, priority: entry.priority,
              spans: [span], label: entry.label || entry.form, oncePerBlock:entry.oncePerBlock, allowUnsafe:entry.allowUnsafe});
          }
        }
      }

      for (const entry of pairs) {
        for (const [left, right] of entry.pairs) {
          const openers = occurrences(text, left);
          const closers = occurrences(text, right);
          const used = new Set();
          // Closest compatible opener first: never join a pair across sentence boundaries.
          for (const closer of closers) {
            const opener = openers.findLast(x => x.end <= closer.start && !used.has(x.start) &&
              closer.start - x.end <= entry.maxGap && !BREAK.test(text.slice(x.end, closer.start)));
            if (!opener || (entry.rightExcludes || []).some(suffix => text.startsWith(right + suffix, closer.start)) ||
              (entry.rightPrecludes || []).some(prefix => text.slice(0,closer.start).endsWith(prefix))) continue;
            used.add(opener.start);
            accept({id: entry.id, category: entry.category, priority: entry.priority + 20,
              spans: [opener, closer], label: entry.label, allowUnsafe:entry.allowUnsafe});
          }
        }
      }

      for (const entry of patterns) {
        entry.expression.lastIndex = 0;
        for (const found of text.matchAll(entry.expression)) {
          const start = found.index, end = start + found[0].length;
          if (/[\d.]/u.test(text[start - 1] || '') ||
            (/[\d.]$/u.test(found[0]) && /[\d.]/u.test(text[end] || ''))) continue;
          if ((entry.rightExcludes || []).some(suffix => text.startsWith(suffix, end))) continue;
          accept({id:entry.id, category:entry.category, priority:entry.priority, spans:[{start,end}], label:entry.label});
        }
      }

      const resolved = [];
      candidates.sort((a, b) => Number(b.category === 'personal')-Number(a.category === 'personal') ||
        b.spans.length-a.spans.length || spanSize(b)-spanSize(a) || b.priority-a.priority || a.spans[0].start-b.spans[0].start);
      for (const item of candidates) if (!resolved.some(x => overlaps(x, item))) resolved.push(item);
      if (!budget) return resolved.sort((a, b) => a.spans[0].start - b.spans[0].start);
      const limits = paragraphBudget(text, settings.maxGroups);
      let size = 0;
      const selected = [];
      const remaining = [...resolved];
      while (remaining.length && selected.length < limits.groups) {
        // Spread cues across the paragraph, instead of spending the budget at its start.
        const score = item => item.priority - selected.reduce((penalty, chosen) =>
          penalty + (Math.abs(chosen.spans[0].start - item.spans[0].start) < 28 ? 35 : 0), 0);
        remaining.sort((a,b) => score(b)-score(a) || spanSize(b)-spanSize(a) || a.spans[0].start-b.spans[0].start);
        const item = remaining.shift();
        if (item.oncePerBlock && selected.some(x => x.id === item.id)) continue;
        if (size + spanSize(item) <= limits.characters) { selected.push(item); size += spanSize(item); }
      }
      return selected.sort((a, b) => a.spans[0].start - b.spans[0].start);
    }
    return {match, settings};
  }

  globalThis.ReadingCues = Object.freeze({DEFAULTS, LIMITS, CATEGORIES, CATEGORY_LABELS, safeTerm, normalizeSettings,
    parseImport, exportDictionary, sitePattern, isSiteEnabled, paragraphBudget, validateLexicon, createMatcher});
})();
