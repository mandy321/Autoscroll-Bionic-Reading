// ==UserScript==
// @name         Comfortable Reading Auto-Scroll
// @namespace    https://github.com/mandeep
// @version      2.2
// @description  Premium reading companion – auto-scroll with continuous mouse movement support, bionic reading, focus lane, progress bar.
// @author       You
// @match        *://*/*
// @license      MIT
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-end
// @noframes
// ==/UserScript==

(function () {
  'use strict';
  if (window.self !== window.top) return;

  // ── Preferences ──────────────────────────────────────────────────────────────
  let speed = 2, minimized = false, maskOn = false, bionicOn = false, laneH = 120;
  try {
    speed = GM_getValue('cr_speed', 2);
    minimized = GM_getValue('cr_min', false);
    maskOn = GM_getValue('cr_mask', false);
    bionicOn = GM_getValue('cr_bio', false);
    laneH = GM_getValue('cr_lane', 120);
  } catch (_) { }

  // ── Inline-style helper ───────────────────────────────────────────────────────
  function s(el, props) {
    for (const [k, v] of Object.entries(props))
      el.style.setProperty(k, String(v), 'important');
  }

  // ── CSS tag injection ────────────────────────────────────────────────────────
  const styleTag = document.createElement('style');
  styleTag.textContent = `
    #cr-pill {
      transition: width 0.46s cubic-bezier(0.34,1.56,0.64,1), opacity 0.26s cubic-bezier(0.2,0,0,1), box-shadow 0.26s ease !important;
      will-change: width, opacity;
      contain: paint;
    }
    #cr-ctrl {
      transition: transform 0.4s cubic-bezier(0.34,1.56,0.64,1), opacity 0.22s cubic-bezier(0.2,0,0,1) !important;
      will-change: transform, opacity;
    }
    #cr-slider-wrap {
      transition: max-width 0.3s cubic-bezier(0.2,0,0,1), opacity 0.22s ease !important;
    }
    .cr-pip {
      transition: background 0.18s ease, transform 0.18s ease !important;
    }
    .cr-ic:hover { background: rgba(255,255,255,0.12) !important; }
    .cr-ic:active { transform: scale(0.84) !important; }
    #cr-main-btn:active { transform: scale(0.88) !important; }
    #cr-lane-slider::-webkit-slider-thumb {
      -webkit-appearance: none !important;
      width: 14px; height: 14px;
      background: #0A84FF !important;
      border-radius: 50% !important;
      cursor: pointer !important;
      border: 1.5px solid rgba(255,255,255,0.5) !important;
      box-shadow: 0 1px 5px rgba(0,0,0,0.35) !important;
    }
    #cr-lane-slider::-moz-range-thumb {
      width: 14px; height: 14px;
      background: #0A84FF !important;
      border-radius: 50% !important;
      cursor: pointer !important;
      border: 1.5px solid rgba(255,255,255,0.5) !important;
    }
    .cr-bion b { font-weight: 800 !important; display: inline !important; color: inherit !important; }
    #cr-bar { transition: width 0.1s linear !important; }
    #cr-mt, #cr-mb { transition: opacity 0.35s ease !important; }
    #cr-mt { border-bottom: 1px dashed rgba(10,132,255,0.18) !important; }
    #cr-mb { border-top:    1px dashed rgba(10,132,255,0.18) !important; }
  `;
  (document.head || document.documentElement).appendChild(styleTag);

  // ── Palette & Measurements ───────────────────────────────────────────────────
  const BLUE = '#0A84FF';
  const BG_IDLE = 'rgba(22,22,26,0.65)';
  const BG_HOVER = 'rgba(18,18,22,0.90)';
  const SHADOW_I = '0 2px 16px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.07)';
  const SHADOW_H = '0 10px 48px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.10)';
  const SHADOW_A = '0 6px 32px rgba(10,132,255,0.26), inset 0 1px 0 rgba(255,255,255,0.08)';

  const W_COL = 44;
  const W_EXP = 300;
  const W_SLD = 366;

  // ── UI Generation ────────────────────────────────────────────────────────────
  const pill = document.createElement('div');
  pill.id = 'cr-pill';
  s(pill, {
    position: 'fixed', bottom: '20px', right: '20px', 'z-index': '2147483646',
    display: 'flex', 'align-items': 'center', height: W_COL + 'px', width: W_COL + 'px',
    overflow: 'hidden', 'border-radius': (W_COL / 2) + 'px', background: BG_IDLE,
    'backdrop-filter': 'blur(28px) saturate(180%)', '-webkit-backdrop-filter': 'blur(28px) saturate(180%)',
    border: '1px solid rgba(255,255,255,0.11)', 'box-shadow': SHADOW_I, cursor: 'pointer', opacity: '0.13',
    'font-family': '-apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif', color: '#fff',
    'user-select': 'none', '-webkit-user-select': 'none', 'pointer-events': 'auto', boxSizing: 'border-box'
  });

  const mainBtn = document.createElement('button');
  mainBtn.id = 'cr-main-btn'; mainBtn.type = 'button'; mainBtn.title = 'Play / Pause (Alt+S)';
  mainBtn.innerHTML = `
    <svg id="cr-play" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7 4.5v15L20 12z"/></svg>
    <svg id="cr-pause" viewBox="0 0 24 24" width="15" height="15" fill="currentColor" style="display:none"><rect x="5" y="4.5" width="4.5" height="15" rx="2"/><rect x="14.5" y="4.5" width="4.5" height="15" rx="2"/></svg>`;
  s(mainBtn, {
    width: W_COL + 'px', height: W_COL + 'px', 'flex-shrink': '0', border: 'none', background: 'transparent',
    cursor: 'pointer', display: 'flex', 'align-items': 'center', 'justify-content': 'center',
    'border-radius': (W_COL / 2) + 'px', outline: 'none', padding: '0', color: 'rgba(255,255,255,0.88)',
    '-webkit-tap-highlight-color': 'transparent', transition: 'transform 0.13s ease, color 0.13s ease'
  });

  const ctrl = document.createElement('div');
  ctrl.id = 'cr-ctrl';
  s(ctrl, { display: 'flex', 'align-items': 'center', gap: '4px', 'padding-right': '8px', 'flex-shrink': '0', opacity: '0', transform: 'translateX(14px)', 'pointer-events': 'none' });

  function mkIcBtn(title, svgBody, opts = {}) {
    const b = document.createElement('button');
    b.type = 'button'; b.title = title; b.className = 'cr-ic';
    b.innerHTML = `<svg viewBox="0 0 24 24" width="${opts.sw || 12}" height="${opts.sw || 12}" fill="${opts.fill ? 'currentColor' : 'none'}" stroke="${opts.fill ? 'none' : 'currentColor'}" stroke-width="${opts.strokeW || 1.6}" stroke-linecap="round" stroke-linejoin="round">${svgBody}</svg>`;
    s(b, {
      width: '24px', height: '24px', border: '1px solid rgba(255,255,255,0.1)',
      background: opts.active ? 'rgba(10,132,255,0.18)' : 'rgba(255,255,255,0.07)',
      'border-color': opts.active ? 'rgba(10,132,255,0.45)' : 'rgba(255,255,255,0.1)',
      color: opts.active ? BLUE : 'rgba(255,255,255,0.78)', cursor: 'pointer', display: 'flex', 'align-items': 'center',
      'justify-content': 'center', 'border-radius': '7px', outline: 'none', padding: '0', 'flex-shrink': '0',
      transition: 'transform 0.13s ease, color 0.14s ease, background 0.14s ease'
    });
    return b;
  }

  const btnMinus = mkIcBtn('Slower', '<line x1="5" y1="12" x2="19" y2="12"/>');
  const btnPlus = mkIcBtn('Faster', '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>');

  const pipsRow = document.createElement('div');
  s(pipsRow, { display: 'flex', gap: '3px', 'align-items': 'center', 'flex-shrink': '0', padding: '0 3px' });
  const pips = [];
  for (let i = 0; i < 5; i++) {
    const p = document.createElement('div'); p.className = 'cr-pip';
    s(p, { width: '5px', height: '5px', 'border-radius': '50%', background: (i < speed) ? BLUE : 'rgba(255,255,255,0.2)', 'flex-shrink': '0' });
    pips.push(p); pipsRow.appendChild(p);
  }

  function refreshPips() {
    pips.forEach((p, i) => p.style.setProperty('background', i < speed ? BLUE : 'rgba(255,255,255,0.2)', 'important'));
  }

  const btnFocus = mkIcBtn('Reading Focus Lane', '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3.2"/>', { active: maskOn });

  const sliderWrap = document.createElement('div');
  sliderWrap.id = 'cr-slider-wrap';
  s(sliderWrap, { display: 'flex', 'align-items': 'center', 'max-width': maskOn ? '64px' : '0', overflow: 'hidden', 'flex-shrink': '0', opacity: maskOn ? '1' : '0', 'pointer-events': maskOn ? 'auto' : 'none' });

  const laneSlider = document.createElement('input');
  laneSlider.id = 'cr-lane-slider'; laneSlider.type = 'range'; laneSlider.min = 60; laneSlider.max = 280; laneSlider.value = laneH;
  s(laneSlider, { '-webkit-appearance': 'none', appearance: 'none', width: '58px', height: '3px', 'border-radius': '2px', background: 'rgba(255,255,255,0.15)', outline: 'none', cursor: 'pointer', margin: '0 3px' });
  sliderWrap.appendChild(laneSlider);

  const btnBionic = document.createElement('button');
  btnBionic.type = 'button'; btnBionic.title = 'Bionic Speed Reading'; btnBionic.className = 'cr-ic';
  btnBionic.textContent = 'B';
  s(btnBionic, {
    width: '24px', height: '24px', border: `1px solid ${bionicOn ? 'rgba(10,132,255,0.45)' : 'rgba(255,255,255,0.1)'}`,
    background: bionicOn ? 'rgba(10,132,255,0.18)' : 'rgba(255,255,255,0.07)', color: bionicOn ? BLUE : 'rgba(255,255,255,0.78)',
    cursor: 'pointer', display: 'flex', 'align-items': 'center', 'justify-content': 'center', 'border-radius': '7px', outline: 'none',
    padding: '0', 'font-weight': '900', 'font-size': '12px', 'font-style': 'italic', 'font-family': '-apple-system,BlinkMacSystemFont,sans-serif',
    'flex-shrink': '0', transition: 'transform 0.13s ease, color 0.14s ease, background 0.14s ease'
  });

  const btnClose = mkIcBtn('Minimise', '<line x1="17" y1="7" x2="7" y2="17"/><line x1="7" y1="7" x2="17" y2="17"/>', { strokeW: 2 });

  function mkSep() {
    const d = document.createElement('div');
    s(d, { width: '1px', height: '15px', background: 'rgba(255,255,255,0.09)', 'flex-shrink': '0' });
    return d;
  }

  [btnMinus, pipsRow, btnPlus, mkSep(), btnFocus, sliderWrap, mkSep(), btnBionic, mkSep(), btnClose].forEach(el => ctrl.appendChild(el));
  pill.appendChild(mainBtn); pill.appendChild(ctrl);

  const bar = document.createElement('div');
  bar.id = 'cr-bar';
  s(bar, { position: 'fixed', top: '0', left: '0', height: '2px', width: '0%', background: 'linear-gradient(90deg, #30D158, #0A84FF)', 'z-index': '2147483647', 'pointer-events': 'none', 'border-radius': '0 2px 2px 0', 'box-shadow': '0 0 6px rgba(10,132,255,0.4)' });

  // ── Focus Mask Management ───────────────────────────────────────────────────
  let mt = null, mb = null;
  function mkMasks() {
    if (mt) return;
    mt = document.createElement('div'); mt.id = 'cr-mt';
    mb = document.createElement('div'); mb.id = 'cr-mb';
    const maskStyles = { position: 'fixed', left: '0', width: '100vw', 'pointer-events': 'none', 'z-index': '2147483640', opacity: '0' };
    s(mt, maskStyles); s(mb, maskStyles);
    document.body.appendChild(mt); document.body.appendChild(mb);
    calcMasks();
  }

  function calcMasks() {
    if (!mt) return;
    const half = laneH / 2;
    const viewH = window.innerHeight;
    const centerLine = viewH / 2;
    const band = Math.max(0, Math.round(centerLine - half));
    const blur = Math.round(laneH / 28);
    const base = +(0.58 - (laneH / 280) * 0.26).toFixed(3);

    const maxScroll = document.documentElement.scrollHeight - viewH;
    const prog = maxScroll > 0 ? Math.min(1, window.scrollY / Math.min(maxScroll, laneH * 1.5)) : 1;
    const topH = Math.round(band * prog);

    s(mt, { height: topH + 'px', top: '0', background: `rgba(0,0,0,${+(base * prog).toFixed(3)})`, 'backdrop-filter': `blur(${Math.round(blur * prog)}px)`, '-webkit-backdrop-filter': `blur(${Math.round(blur * prog)}px)` });
    s(mb, { height: band + 'px', bottom: '0', background: `rgba(0,0,0,${base})`, 'backdrop-filter': `blur(${blur}px)`, '-webkit-backdrop-filter': `blur(${blur}px)` });
  }

  function showMasks(on) {
    if (!mt) return;
    mt.style.setProperty('opacity', on ? '1' : '0', 'important');
    mb.style.setProperty('opacity', on ? '1' : '0', 'important');
  }

  // ── Engine Parameters ────────────────────────────────────────────────────────
  const SPD = [null, [45, 1], [28, 1], [17, 1], [12, 2], [8, 2]];
  let scrolling = false, paused = false, lastTick = 0, raf = null, resumeTmr = null;

  function scrollLoop(now) {
    if (!scrolling) return;
    if (!paused) {
      const [ms, px] = SPD[speed];
      const dt = now - lastTick;
      if (dt >= ms) {
        window.scrollBy(0, px);
        lastTick = now - (dt % ms);
        if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 3) {
          doStop(); return;
        }
      }
    }
    raf = requestAnimationFrame(scrollLoop);
  }

  function doStart() {
    if (scrolling) return;
    scrolling = true; paused = false; lastTick = performance.now();
    document.getElementById('cr-play').style.display = 'none';
    document.getElementById('cr-pause').style.display = 'block';
    s(pill, { 'box-shadow': SHADOW_A, 'border-color': 'rgba(10,132,255,0.32)' });
    raf = requestAnimationFrame(scrollLoop);
  }

  function doStop() {
    scrolling = false;
    if (raf) { cancelAnimationFrame(raf); raf = null; }
    clearTimeout(resumeTmr);
    document.getElementById('cr-play').style.display = 'block';
    document.getElementById('cr-pause').style.display = 'none';
    if (!hovered) s(pill, { 'box-shadow': SHADOW_I, 'border-color': 'rgba(255,255,255,0.11)' });
  }

  function toggleScroll() { scrolling ? doStop() : doStart(); }
  function setSpeed(n) { speed = Math.max(1, Math.min(5, n)); refreshPips(); try { GM_setValue('cr_speed', speed); } catch (_) { } }

  // Pause is exclusively triggered by active user navigation inputs (Wheel, Keys, Touch moves)
  function pauseTemp() {
    if (!scrolling) return;
    paused = true;
    clearTimeout(resumeTmr);
    resumeTmr = setTimeout(() => { paused = false; lastTick = performance.now(); }, 1200);
  }

  let barPending = false;
  function updBar() {
    if (barPending) return;
    barPending = true;
    requestAnimationFrame(() => {
      barPending = false;
      const total = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.setProperty('width', (total > 0 ? window.scrollY / total * 100 : 0) + '%', 'important');
    });
  }

  let maskPending = false;
  function schedMask() { if (!maskOn || maskPending) return; maskPending = true; requestAnimationFrame(() => { maskPending = false; calcMasks(); }); }

  function toggleMask() {
    maskOn = !maskOn; mkMasks(); showMasks(maskOn); setIcActive(btnFocus, maskOn);
    s(sliderWrap, { 'max-width': maskOn ? '64px' : '0', opacity: maskOn ? '1' : '0', 'pointer-events': maskOn ? 'auto' : 'none' });
    if (!minimized && hovered) s(pill, { width: (maskOn ? W_SLD : W_EXP) + 'px' });
    try { GM_setValue('cr_mask', maskOn); } catch (_) { }
  }

  // ── Shadow-DOM Aware Bionic Parsing Engine ──────────────────────────────────
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'KBD', 'SAMP', 'MATH', 'SVG', 'TEXTAREA', 'INPUT', 'SELECT', 'CANVAS', 'AUDIO', 'VIDEO', 'NOSCRIPT']);
  let bObs = null;

  function bionicText(text) {
    return text.replace(/\S+/g, w => {
      if (w.includes('<') || w.includes('>')) return w;
      const n = Math.max(1, Math.ceil(w.length * 0.45));
      return `<b>${w.slice(0, n)}</b>${w.slice(n)}`;
    });
  }

  function walkBionic(root) {
    if (!root) return;
    if (root.shadowRoot) walkBionic(root.shadowRoot);

    const tw = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (n.nodeType === 1) {
          if (SKIP.has(n.tagName) || n.getAttribute && n.getAttribute('data-b') === '1') return NodeFilter.FILTER_REJECT;
          if (n.shadowRoot) walkBionic(n.shadowRoot);
          return NodeFilter.FILTER_SKIP;
        }
        const p = n.parentNode;
        if (!n.nodeValue || !n.nodeValue.trim() || !p) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    const nodes = []; let nd;
    while ((nd = tw.nextNode())) nodes.push(nd);
    if (nodes.length === 0) return;

    requestAnimationFrame(() => {
      nodes.forEach(n => {
        if (!n.parentNode || n.parentNode.getAttribute && n.parentNode.getAttribute('data-b') === '1') return;
        const val = n.nodeValue;
        const sp = document.createElement('span');
        sp.className = 'cr-bion'; sp.setAttribute('data-b', '1'); sp.dataset.o = val;
        sp.innerHTML = bionicText(val);
        try { n.parentNode.replaceChild(sp, n); } catch (_) { }
      });
    });
  }

  function applyBionic() {
    walkBionic(document.body);
    if (!bObs) {
      bObs = new MutationObserver(ms => {
        if (!bionicOn) return;
        for (const m of ms) {
          if (m.type === 'childList') {
            for (const n of m.addedNodes) walkBionic(n);
          } else if (m.type === 'characterData') {
            const p = m.target.parentNode;
            if (p && (!p.getAttribute || p.getAttribute('data-b') !== '1')) walkBionic(p);
          }
        }
      });
      bObs.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
  }

  function removeBionic() {
    if (bObs) { bObs.disconnect(); bObs = null; }
    const cleanNodes = (root) => {
      if (!root) return;
      const elements = root.querySelectorAll ? root.querySelectorAll('.cr-bion') : [];
      elements.forEach(s => {
        if (s.dataset.o != null && s.parentNode) {
          try { s.parentNode.replaceChild(document.createTextNode(s.dataset.o), s); } catch (_) { }
        }
      });
      const all = root.querySelectorAll ? root.querySelectorAll('*') : [];
      all.forEach(el => { if (el.shadowRoot) cleanNodes(el.shadowRoot); });
    };
    cleanNodes(document.body);
  }

  function toggleBionic() {
    bionicOn = !bionicOn; setIcActive(btnBionic, bionicOn);
    bionicOn ? applyBionic() : removeBionic();
    try { GM_setValue('cr_bio', bionicOn); } catch (_) { }
  }

  function setIcActive(btn, on) {
    s(btn, {
      background: on ? 'rgba(10,132,255,0.18)' : 'rgba(255,255,255,0.07)',
      'border-color': on ? 'rgba(10,132,255,0.45)' : 'rgba(255,255,255,0.10)',
      color: on ? BLUE : 'rgba(255,255,255,0.78)',
    });
  }

  // ── Hover UX Animations ──────────────────────────────────────────────────────
  let hovered = false;
  function onEnter() {
    if (minimized) return; hovered = true;
    s(pill, { width: (maskOn ? W_SLD : W_EXP) + 'px', opacity: '1', background: BG_HOVER, 'box-shadow': SHADOW_H });
    s(ctrl, { opacity: '1', transform: 'translateX(0)', 'pointer-events': 'auto' });
  }

  function onLeave() {
    if (minimized) return; hovered = false;
    s(pill, { width: W_COL + 'px', opacity: scrolling ? '0.32' : '0.13', background: BG_IDLE, 'box-shadow': scrolling ? SHADOW_A : SHADOW_I });
    s(ctrl, { opacity: '0', transform: 'translateX(14px)', 'pointer-events': 'none' });
  }

  pill.addEventListener('mouseenter', onEnter);
  pill.addEventListener('mouseleave', onLeave);

  // ── Window Controls ──────────────────────────────────────────────────────────
  function doMinimize() {
    minimized = true; hovered = false; doStop();
    s(pill, { width: '10px', height: '10px', 'border-radius': '50%', background: 'rgba(10,132,255,0.45)', opacity: '0.45', bottom: '14px', right: '14px', overflow: 'hidden', 'box-shadow': '0 0 12px rgba(10,132,255,0.35)', 'border-color': 'rgba(10,132,255,0.3)' });
    s(mainBtn, { display: 'none' }); s(ctrl, { display: 'none', opacity: '0', 'pointer-events': 'none' });
    try { GM_setValue('cr_min', true); } catch (_) { }
  }

  function doRestore() {
    minimized = false;
    s(pill, { width: W_COL + 'px', height: W_COL + 'px', 'border-radius': (W_COL / 2) + 'px', background: BG_IDLE, opacity: '0.13', bottom: '20px', right: '20px', overflow: 'hidden', 'box-shadow': SHADOW_I, 'border-color': 'rgba(255,255,255,0.11)' });
    s(mainBtn, { display: 'flex' }); s(ctrl, { display: 'flex', opacity: '0', transform: 'translateX(14px)', 'pointer-events': 'none' });
    try { GM_setValue('cr_min', false); } catch (_) { }
  }

  // ── Bindings & System Handlers ───────────────────────────────────────────────
  mainBtn.onclick = e => { e.stopPropagation(); toggleScroll(); };
  btnMinus.onclick = e => { e.stopPropagation(); setSpeed(speed - 1); };
  btnPlus.onclick = e => { e.stopPropagation(); setSpeed(speed + 1); };
  btnFocus.onclick = e => { e.stopPropagation(); toggleMask(); };
  btnBionic.onclick = e => { e.stopPropagation(); toggleBionic(); };
  btnClose.onclick = e => { e.stopPropagation(); doMinimize(); };
  pill.onclick = () => { if (minimized) doRestore(); };

  laneSlider.oninput = e => {
    e.stopPropagation(); laneH = parseInt(laneSlider.value, 10); schedMask();
    try { GM_setValue('cr_lane', laneH); } catch (_) { }
  };
  laneSlider.addEventListener('mousedown', e => e.stopPropagation());

  window.addEventListener('scroll', () => { updBar(); if (maskOn) schedMask(); }, { passive: true });
  window.addEventListener('resize', () => { if (maskOn) schedMask(); }, { passive: true });

  // Interaction Listeners (Removed 'mousemove' from tracking to enable continuous scrolling during cursor paths)
  window.addEventListener('wheel', pauseTemp, { passive: true });
  window.addEventListener('touchmove', pauseTemp, { passive: true });

  window.addEventListener('keydown', e => {
    if ([' ', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) pauseTemp();
    if (e.altKey && (e.key === 's' || e.key === 'S')) {
      const t = e.target.tagName.toLowerCase();
      if (t !== 'input' && t !== 'textarea' && !e.target.isContentEditable) {
        e.preventDefault(); toggleScroll();
      }
    }
  });

  function init() {
    document.body.appendChild(bar);
    document.body.appendChild(pill);
    if (maskOn) { mkMasks(); showMasks(true); }
    if (bionicOn) applyBionic();
    if (minimized) doMinimize();
    updBar();
  }

  if (document.body) { init(); } else { document.addEventListener('DOMContentLoaded', init); }
})();