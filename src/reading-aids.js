/* Optional visual aids. Pointer coordinates are transient; no content is saved. */
(() => {
  'use strict';
  const cssText = `
    [data-reading-cues-aids]{position:fixed!important;inset:0!important;pointer-events:none!important;z-index:2147483645!important;contain:strict!important;}
    [data-reading-cues-aids][hidden],[data-reading-cues-aids] [hidden]{display:none!important;}
    [data-reading-cues-aids]>div{position:absolute!important;pointer-events:none!important;box-sizing:border-box!important;margin:0!important;}
    [data-reading-cues-aids] .reading-cues-ruler{left:0!important;width:100%!important;height:48px!important;background:rgb(255 213 111 / .13)!important;border-block:1px solid rgb(96 119 66 / .28)!important;}
    [data-reading-cues-aids] .reading-cues-shade{background:rgb(12 25 18 / .25)!important;}
    @media(forced-colors:active){[data-reading-cues-aids] .reading-cues-shade{display:none!important;}[data-reading-cues-aids] .reading-cues-ruler{background:transparent!important;border-color:CanvasText!important;}}
  `;
  const EXCLUDED = 'a,button,input,textarea,select,nav,header,footer,aside,pre,code,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="button"],[role="dialog"],[aria-live]:not([aria-live="off"])';

  function create({document: doc = globalThis.document, managedStyles = false} = {}) {
    const win = doc.defaultView;
    let config = ReadingCues.normalizeSettings({}), root, style, band, masks;
    let frame = 0, point = null, active = null, updates = 0, listening = false, disposed = false, visible = false;
    const observer = new win.MutationObserver(() => schedule());

    function hide() { if (root) root.style.visibility = 'hidden'; visible = false; }
    function blockAt(element) {
      if (!element || element.closest(EXCLUDED)) return null;
      if (element.closest('[data-reading-cues-ignore]') && !element.closest('[data-reading-cues-aid-allow]')) return null;
      for (let el = element; el && !['BODY', 'HTML', 'MAIN'].includes(el.tagName); el = el.parentElement) {
        if (el.matches('p,li,dd,blockquote,article,div') && el.textContent.trim().length >= 8 && el.getBoundingClientRect().width > 60) return el;
      }
      return null;
    }
    function elementAtPoint() {
      if (!point) return null;
      let el = doc.elementFromPoint(point.x, point.y);
      for (let n = 0; n < 32 && el?.shadowRoot; n++) {
        const inner = el.shadowRoot.elementFromPoint(point.x, point.y);
        if (!inner || inner === el) break;
        el = inner;
      }
      return el;
    }
    function build() {
      if (root) return;
      root = doc.createElement('div'); root.dataset.readingCuesAids = ''; root.dataset.readingCuesIgnore = ''; root.setAttribute('aria-hidden', 'true');
      band = doc.createElement('div'); band.className = 'reading-cues-ruler'; root.append(band);
      masks = Array.from({length: 4}, () => { const el = doc.createElement('div'); el.className = 'reading-cues-shade'; root.append(el); return el; });
      if (!managedStyles) { style = doc.createElement('style'); style.dataset.readingCuesIgnore = ''; style.textContent = cssText; doc.documentElement.append(style); }
      root.style.visibility = 'hidden'; (doc.body || doc.documentElement).append(root);
    }
    function rect(el, x, y, width, height) {
      Object.assign(el.style, {left: `${x}px`, top: `${y}px`, width: `${Math.max(0, width)}px`, height: `${Math.max(0, height)}px`});
    }
    function draw() {
      frame = 0;
      if (disposed || !config.enabled || config.aidMode === 'off' || !point || doc.hidden) { hide(); return; }
      const block = blockAt(elementAtPoint());
      if (!block) { hide(); return; }
      if (block !== active) {
        observer.disconnect(); active = block;
        if (active.parentNode) observer.observe(active.parentNode, {childList: true});
      }
      if (!active.isConnected) { hide(); return; }
      build(); updates++; root.style.visibility = 'visible'; visible = true; root.dataset.mode = config.aidMode;
      band.style.display = config.aidMode === 'ruler' ? 'block' : 'none'; masks.forEach(el => { el.style.display = config.aidMode === 'focus' ? 'block' : 'none'; });
      if (config.aidMode === 'ruler') { band.style.top = `${Math.max(0, Math.min(win.innerHeight - 48, point.y - 24))}px`; return; }
      const r = active.getBoundingClientRect(), width = win.innerWidth, height = win.innerHeight;
      const left = Math.max(0, r.left - 10), right = Math.min(width, r.right + 10);
      const top = Math.max(0, r.top - 8), bottom = Math.min(height, r.bottom + 8);
      if (bottom <= top || right <= left) { hide(); return; }
      rect(masks[0], 0, 0, width, top); rect(masks[1], 0, bottom, width, height - bottom);
      rect(masks[2], 0, top, left, bottom - top); rect(masks[3], right, top, width - right, bottom - top);
    }
    function schedule() { if (!frame && listening) frame = win.requestAnimationFrame(draw); }
    function pointer(event) {
      if (event.type === 'pointermove' && event.pointerType === 'touch') return;
      point = {x: event.clientX, y: event.clientY}; schedule();
    }
    function leave(event) { if (!event.relatedTarget) { point = null; hide(); } }
    function blur() { point = null; hide(); }
    function focus(event) { if (event.target?.matches?.(EXCLUDED)) { point = null; hide(); } }
    function stop() {
      if (listening) {
        doc.removeEventListener('pointermove', pointer); doc.removeEventListener('pointerdown', pointer);
        doc.removeEventListener('pointerout', leave); doc.removeEventListener('focusin', focus);
        win.removeEventListener('scroll', schedule, true); win.removeEventListener('resize', schedule); win.removeEventListener('blur', blur);
      }
      listening = false; visible = false; point = null; active = null; observer.disconnect(); win.cancelAnimationFrame(frame); frame = 0;
      root?.remove(); style?.remove(); root = style = band = masks = null;
    }
    return {
      setSettings(settings) {
        if (disposed) return;
        config = ReadingCues.normalizeSettings(settings);
        if (!config.enabled || config.aidMode === 'off') { stop(); return; }
        if (!listening) {
          listening = true;
          doc.addEventListener('pointermove', pointer, {passive: true}); doc.addEventListener('pointerdown', pointer, {passive: true});
          doc.addEventListener('pointerout', leave); doc.addEventListener('focusin', focus);
          win.addEventListener('scroll', schedule, {passive: true, capture: true}); win.addEventListener('resize', schedule); win.addEventListener('blur', blur);
        }
        schedule();
      },
      getSnapshot: () => ({mode: config.aidMode, visible, updates}),
      destroy() { stop(); disposed = true; }
    };
  }
  globalThis.ReadingCuesAids = Object.freeze({create, cssText});
})();
