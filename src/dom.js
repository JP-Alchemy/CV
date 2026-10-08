// The canvas is decorative; this layer mirrors the scene as real, positioned
// HTML so links are clickable/focusable and screen readers get the content.

export class DomMirror {
  constructor(docEl, fixedEl, cb) {
    this.doc = docEl;
    this.fixed = fixedEl;
    this.cb = cb;
    this.nodes = new Map();
  }

  make(tag, key) {
    const node = document.createElement(tag);
    node.className = 'm';
    node.dataset.key = key;
    node.dataset.tag = tag;
    if (tag === 'a' || tag === 'button') {
      node.classList.add('hit');
      node.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') this.cb.hover(key, true); });
      node.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') this.cb.hover(key, false); });
      node.addEventListener('focus', () => { if (node.matches(':focus-visible')) this.cb.hover(key, true); });
      node.addEventListener('blur', () => this.cb.hover(key, false));
      node.addEventListener('click', (e) => this.cb.click(key, node, e));
      if (tag === 'button') node.type = 'button';
    }
    if (tag === 'h1') node.tabIndex = -1; // focus target after keyboard navigation
    return node;
  }

  sync(scene) {
    const want = scene.elements.filter((e) => e.hit || e.a11y);
    const seen = new Set();
    const order = { doc: [], fixed: [] };
    for (const e of want) {
      const h = e.hit;
      const tag = h ? (h.href ? 'a' : 'button') : e.a11y.tag === 'img' ? 'div' : e.a11y.tag;
      let node = this.nodes.get(e.key);
      if (!node || node.dataset.tag !== tag) {
        node?.remove();
        node = this.make(tag, e.key);
        this.nodes.set(e.key, node);
      }
      seen.add(e.key);
      if (h) {
        if (h.href) {
          if (node.getAttribute('href') !== h.href) node.setAttribute('href', h.href);
          if (h.external || /^https?:/.test(h.href)) { node.target = '_blank'; node.rel = 'noopener'; }
          else { node.removeAttribute('target'); node.removeAttribute('rel'); }
          if (h.download) node.setAttribute('download', ''); else node.removeAttribute('download');
          if (h.current) node.setAttribute('aria-current', 'page'); else node.removeAttribute('aria-current');
        }
        if (h.expanded !== undefined) node.setAttribute('aria-expanded', String(!!h.expanded));
        if (node.textContent !== h.label) node.textContent = h.label;
        node.dataset.action = h.action || '';
      } else if (tag === 'div') {
        node.setAttribute('role', 'img');
        node.setAttribute('aria-label', e.a11y.text);
      } else if (node.textContent !== e.a11y.text) {
        node.textContent = e.a11y.text;
      }
      const p = h ? 4 : 0;
      const st = node.style;
      st.left = `${e.x - p}px`;
      st.top = `${e.y - p}px`;
      st.width = `${e.w + p * 2}px`;
      st.height = `${e.h + p * 2}px`;
      order[e.fixed ? 'fixed' : 'doc'].push(node);
    }
    for (const [k, node] of this.nodes) {
      if (!seen.has(k)) { node.remove(); this.nodes.delete(k); }
    }
    // Keep DOM order == reading order (only touch the DOM if it differs, so
    // focus survives hover re-renders).
    for (const [which, parent] of [['doc', this.doc], ['fixed', this.fixed]]) {
      const list = order[which];
      const kids = parent.children;
      let same = kids.length === list.length;
      for (let i = 0; same && i < list.length; i++) same = kids[i] === list[i];
      if (!same) for (const n of list) parent.appendChild(n);
    }
  }
}
