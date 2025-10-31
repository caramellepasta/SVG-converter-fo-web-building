/* scripts.v2.js — touch zoom, pointer selection, auto-align, no UI-hiding heuristics
   Updated: ensure raw SVG/XML goes to HTML output, Live view renders visual preview,
   initPreviewHeaderController wired into attachUiHelpers, Clear creates scaffold
*/
(function(){
  "use strict";

  const IDS = {
    svgPreview: "svgPreview",
    svgFile: "svgFile",
    livePreview: "livePreview",
    codeHtml: "code-html",
    codeCss: "code-css",
    codeJs: "code-js",
    layerTree: "layerTree",
    zoomToFit: "zoomToFit",
    modeSelect: "modeSelect",
    debugToggle: "debugToggle"
  };

  const refs = {};
  function refreshRefs(){
    Object.keys(IDS).forEach(k => refs[k] = document.getElementById(IDS[k]));
  }

  // --- ensure minimal global CSS clamp if missing (non-forcing, transparent background) ---
  (function ensureSvgMapperClamp(){
    if(document.getElementById('svgMapperGlobalClamp')) return;
    try{
      const css = `
        /* svg-mapper safety clamp */
        #svgPreview { box-sizing: border-box !important; width: auto !important; max-width: 100% !important; background: transparent !important; }
        #svgPreview .svg-wrapper { box-sizing: border-box !important; width: 100% !important; max-width: 100% !important; max-height: 80vh !important; height: auto !important; overflow: auto !important; background: transparent !important; touch-action: manipulation !important; -webkit-user-select: none !important; -webkit-touch-callout: none !important; }
        html, body, #root, .app, .container { box-sizing: border-box !important; max-width: 2000px !important; }
        #svgPreview svg { display:block !important; max-width: 100% !important; height: auto !important; pointer-events: auto !important; }
      `.trim();
      const st = document.createElement('style');
      st.id = 'svgMapperGlobalClamp';
      st.appendChild(document.createTextNode(css));
      document.head.appendChild(st);
    }catch(e){}
  })();

  function qs(id){ return document.getElementById(id); }
  function el(tag, attrs){ const e = document.createElement(tag); attrs = attrs || {}; Object.keys(attrs).forEach(k=>{ if(k==="class") e.className = attrs[k]; else if(k==="text") e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); }); return e; }
  function parseFloatSafe(v){ const n = parseFloat(v); return isFinite(n) ? n : null; }

  function normalizeSvgForPreview(svgNode){
    if(!svgNode) return null;
    const clone = svgNode.cloneNode(true);

    Array.from(clone.querySelectorAll("sodipodi\\:namedview, metadata, title, desc, script")).forEach(n => n.remove());

    let vb = null;
    const vbRaw = clone.getAttribute("viewBox");
    if(vbRaw){
      const parts = vbRaw.trim().split(/\s+/).map(parseFloat);
      if(parts.length === 4 && parts.every(n => isFinite(n))) vb = parts;
    }

    Array.from(clone.querySelectorAll("rect")).forEach(r => {
      const rw = parseFloatSafe(r.getAttribute("width"));
      const rh = parseFloatSafe(r.getAttribute("height"));
      const rx = parseFloatSafe(r.getAttribute("x")) || 0;
      const ry = parseFloatSafe(r.getAttribute("y")) || 0;
      if(rw && rh && vb){
        const [vx, vy, vw, vh] = vb;
        if(Math.abs(rw - vw) < 1 && Math.abs(rh - vh) < 1 && Math.abs(rx - vx) < 1 && Math.abs(ry - vy) < 1){
          r.remove();
        }
      }
    });

    if(!clone.hasAttribute("viewBox")){
      const w = parseFloatSafe(clone.getAttribute("width"));
      const h = parseFloatSafe(clone.getAttribute("height"));
      if(w && h) clone.setAttribute("viewBox", `0 0 ${w} ${h}`);
    }

    clone.removeAttribute("width");
    clone.removeAttribute("height");

    if(!clone.getAttribute("preserveAspectRatio")) clone.setAttribute("preserveAspectRatio", "xMidYMid meet");

    return clone;
  }

  function autoHideOversized(svgEl){
    if(!svgEl) return;
    try{
      Array.from(svgEl.querySelectorAll('*')).forEach(n=>{
        try{
          const b = n.getBBox();
          if(!isFinite(b.width) || !isFinite(b.height)) return;
          // conservative thresholds: hide far-off or massive elements that break layout
          if (b.width > 2000 || b.height > 2000 || Math.abs(b.x) > 10000 || Math.abs(b.y) > 10000) {
            n.dataset.__hidden_by_mapper = '1';
            n.dataset.__hidden_prev_display = n.style.display || '';
            n.style.display = 'none';
          }
        }catch(e){}
      });
    }catch(e){}
  }

  function injectSvgIntoPreview(svgOrString){
    refreshRefs();
    const preview = refs.svgPreview;
    if(!preview) return false;

    let svgNode = null;
    if(typeof svgOrString === "string"){
      const doc = new DOMParser().parseFromString(svgOrString, "image/svg+xml");
      svgNode = doc.querySelector("svg");
      if(!svgNode) return false;
    } else {
      svgNode = svgOrString;
    }

    const normalized = normalizeSvgForPreview(svgNode);
    if(!normalized) return false;

    // ensure wrapper (preserve preview element's existing look)
    let wrapper = preview.querySelector(".svg-wrapper");
    if(!wrapper){
      wrapper = document.createElement("div");
      wrapper.className = "svg-wrapper";
      preview.appendChild(wrapper);
    }
    wrapper.innerHTML = "";
    wrapper.appendChild(normalized);

    // layout safety on preview + wrapper (conservative, responsive defaults)
    try {
      preview.style.position = preview.style.position || 'relative';
      preview.style.background = preview.style.background || 'transparent';
      preview.style.boxSizing = 'border-box';
      wrapper.style.position = wrapper.style.position || 'relative';
      wrapper.style.background = 'transparent';
      wrapper.style.overflow = wrapper.style.overflow || 'auto';
      wrapper.style.width = wrapper.style.width || '100%';
      wrapper.style.height = wrapper.style.height || 'auto';
      wrapper.style.maxWidth = wrapper.style.maxWidth || '100%';
      wrapper.style.maxHeight = wrapper.style.maxHeight || '80vh';
      wrapper.tabIndex = wrapper.tabIndex || -1;
      wrapper.style.padding = wrapper.style.padding || '8px';
    } catch(e){}

    // auto-clean obvious oversized children before sizing
    autoHideOversized(normalized);

    // ensure SVG sizing cooperates with wrapper
    normalized.style.display = "block";
    normalized.style.maxWidth = "100%";
    normalized.style.maxHeight = "100%";
    normalized.style.width = "auto";
    normalized.style.height = "auto";
    normalized.removeAttribute('width');
    normalized.removeAttribute('height');
    normalized.setAttribute('preserveAspectRatio','xMidYMid meet');

    // enable pointer events and sensible cursors on children
    try {
      normalized.style.pointerEvents = normalized.style.pointerEvents || 'auto';
      normalized.style.cursor = normalized.style.cursor || 'default';
      Array.from(normalized.querySelectorAll('*')).forEach(el => {
        if(el instanceof SVGElement){
          if(!el.style.pointerEvents) el.style.pointerEvents = 'auto';
          if(!el.style.cursor) el.style.cursor = 'pointer';
        }
      });
    } catch(e){}

    // hide embedded images that affect layout and mark for restore
    try {
      Array.from(normalized.querySelectorAll('image')).forEach(img => {
        img.dataset.__hidden_by_mapper_img = '1';
        img.dataset.__hidden_prev_display = img.style.display || '';
        img.style.display = 'none';
      });
    } catch(e){}

    // reset scroll so top of artwork is visible and focus for keyboard (Escape)
    try {
      wrapper.scrollTop = 0;
      wrapper.scrollLeft = 0;
      wrapper.focus && wrapper.focus();
    } catch(e){}

    return true;
  }

  function parseAndInjectSvgString(svgText){
    if(!svgText) return { error: "empty" };
    const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
    let svgEl = doc.documentElement;
    if(!svgEl || svgEl.nodeName.toLowerCase() !== "svg"){
      svgEl = doc.querySelector("svg");
      if(!svgEl) return { error: "no-svg" };
    }
    injectSvgIntoPreview(svgEl);
    return { svgEl: svgEl };
  }

  function installHandlerOn(inputEl){
    if(!inputEl) return false;
    if(inputEl._mapperHandler){
      try{ inputEl.removeEventListener("change", inputEl._mapperHandler); }catch(e){}
      inputEl._mapperHandler = null;
    }

    const handler = function(ev){
      const file = ev.target && ev.target.files && ev.target.files[0];
      if(!file) return;

      const reader = new FileReader();

      reader.onerror = function(){};

      reader.onload = function(e){
        const txt = e.target.result || "";

        // route raw XML into code-html and clear livePreview text echo
        const maxPreview = 200000;
        refreshRefs();
        if (refs && refs.codeHtml) {
          refs.codeHtml.textContent = txt.length > maxPreview ? txt.slice(0, maxPreview) + "\n\n...TRUNCATED..." : txt;
        }
        if (refs && refs.livePreview) {
          // keep livePreview for visual render only
          refs.livePreview.textContent = "";
        }

        const doc = new DOMParser().parseFromString(txt, "image/svg+xml");
        const svgEl = doc.querySelector("svg");
        if (!svgEl) return;

        const svgClone = document.importNode(svgEl, true);
        Array.from(svgClone.querySelectorAll("sodipodi\\:namedview, metadata, title, desc")).forEach(n => n.remove());
        if (!svgClone.getAttribute("viewBox")) {
          const w = parseFloat(svgClone.getAttribute("width"));
          const h = parseFloat(svgClone.getAttribute("height"));
          if (isFinite(w) && isFinite(h)) svgClone.setAttribute("viewBox", `0 0 ${w} ${h}`);
        }
        svgClone.removeAttribute("width");
        svgClone.removeAttribute("height");
        svgClone.setAttribute("preserveAspectRatio", "xMidYMid meet");

        const preview = document.getElementById("svgPreview");
        if (!preview) return;
        let wrapper = preview.querySelector(".svg-wrapper");
        if (!wrapper) { wrapper = document.createElement("div"); wrapper.className = "svg-wrapper"; preview.appendChild(wrapper); }
        wrapper.innerHTML = "";
        wrapper.appendChild(svgClone);

        // stabilization and normalization (keeps preview stable)
        try {
          preview.style.position = preview.style.position || 'relative';
          preview.style.background = preview.style.background || 'transparent';
          preview.style.boxSizing = 'border-box';
          wrapper.style.position = wrapper.style.position || 'relative';
          wrapper.style.background = 'transparent';
          wrapper.style.overflow = wrapper.style.overflow || 'auto';
          wrapper.style.width = wrapper.style.width || '100%';
          wrapper.style.height = wrapper.style.height || 'auto';
          wrapper.style.maxWidth = wrapper.style.maxWidth || '100%';
          wrapper.style.maxHeight = wrapper.style.maxHeight || '80vh';
          wrapper.tabIndex = wrapper.tabIndex || -1;
          wrapper.style.padding = wrapper.style.padding || '8px';
        } catch (ex) { /* ignore */ }

        // conservative auto-clean of oversized children
        autoHideOversized(svgClone);

        // ensure svg sizing and interactivity
        try {
          svgClone.style.maxWidth = '100%';
          svgClone.style.maxHeight = '100%';
          svgClone.style.width = 'auto';
          svgClone.style.height = 'auto';
          svgClone.style.display = 'block';
          svgClone.removeAttribute('width');
          svgClone.removeAttribute('height');
          svgClone.setAttribute('preserveAspectRatio','xMidYMid meet');

          Array.from(svgClone.querySelectorAll('*')).forEach(el => {
            if(el instanceof SVGElement){
              if(!el.style.pointerEvents) el.style.pointerEvents = 'auto';
              if(!el.style.cursor) el.style.cursor = 'pointer';
            }
          });
        } catch(e){}

        // also populate the livePreview region with a rendered DOM snapshot of the page
        // (so "Live" tab can show a small sample HTML rendering container if your wiring expects it)
        try {
          refreshRefs();
          if(refs && refs.livePreview){
            // clear previous HTML snapshot
            refs.livePreview.innerHTML = "";
            // create a lightweight container and clone the SVG into it for visual "live" experience
            const snap = document.createElement('div');
            snap.className = 'live-snapshot';
            // clone the normalized SVG for the livePreview area
            const snapshotSvg = svgClone.cloneNode(true);
            // ensure sizing inside livePreview
            snapshotSvg.style.display = 'block';
            snapshotSvg.style.maxWidth = '100%';
            snapshotSvg.style.height = 'auto';
            snapshotSvg.removeAttribute('width');
            snapshotSvg.removeAttribute('height');
            snap.appendChild(snapshotSvg);
            refs.livePreview.appendChild(snap);
          }
        } catch(e){}

        if (typeof buildLayerTree === "function") {
          try { buildLayerTree(svgClone); } catch(e) {}
        }

        // ensure pointer-based selection and zoom controls
        try { installPreviewClickDelegation(); installZoomControls(); } catch(e){}

        // run improved zoom if present
        if(window.__svgMapper && typeof window.__svgMapper.zoomToFitImproved === 'function'){
          try { window.__svgMapper.zoomToFitImproved(); } catch(e) { /* ignore */ }
        }
      };

      reader.readAsText(file);
    };

    inputEl._mapperHandler = handler;
    inputEl.addEventListener("change", handler);
    return true;
  }

  // click/delegation installer (idempotent) — switched to pointer-based selection (tap friendly)
  function installPreviewClickDelegation(){
    refreshRefs();
    const previewEl = document.getElementById('svgPreview');
    if(!previewEl) return;
    const wrapperEl = previewEl.querySelector('.svg-wrapper');
    if(!wrapperEl) return;
    if(wrapperEl._svgClickHandlerInstalled) return;
    wrapperEl._svgClickHandlerInstalled = true;

    // small focus/tabIndex safety so Escape and focus-based scroll behave
    try {
      wrapperEl.tabIndex = wrapperEl.tabIndex || -1;
      wrapperEl.style.outline = wrapperEl.style.outline || 'none';
      wrapperEl.focus && wrapperEl.focus();
    } catch(e){}

    // Clear selection helper
    function clearSelection(){
      const s = wrapperEl.querySelector('svg');
      if(s) s.querySelectorAll('.active').forEach(a=>a.classList.remove('active'));
      const lt = document.getElementById('layerTree');
      if(lt) lt.querySelectorAll('.active').forEach(n=>n.classList.remove('active'));
    }

    // Delegate pointerup/tap: select nearest SVG group/element, or deselect on background
    wrapperEl.addEventListener('pointerup', function(ev){
      // ignore secondary pointers
      if(ev.button && ev.button !== 0) return;
      const s = wrapperEl.querySelector('svg');
      if(!s) return;
      let el = ev.target;
      // Walk up until svg root or a meaningful element (g or element with id)
      while(el && el !== s && !(el.tagName && el.tagName.toLowerCase() === 'g') && !(el.id && typeof el.id === 'string')) el = el.parentNode;
      if(!el || el === s){
        clearSelection();
        return;
      }
      // toggle selection (single select)
      s.querySelectorAll('.active').forEach(a=>a.classList.remove('active'));
      try { el.classList.add('active'); } catch(e){}
      // Sync layer tree highlight
      const lt = document.getElementById('layerTree');
      if(lt){
        lt.querySelectorAll('.active').forEach(n=>n.classList.remove('active'));
        let btn = lt.querySelector(`.tree-label[title="${el.id}"]`);
        if(!btn){
          btn = Array.from(lt.querySelectorAll('.tree-label')).find(b => b.textContent && el.getAttribute && b.textContent.trim() === (el.getAttribute('inkscape:label')||el.getAttribute('data-name')||el.id||''));
        }
        if(btn) btn.classList.add('active');
      }
    }, false);

    // keyboard: Escape clears selection
    wrapperEl.addEventListener('keydown', function(ev){
      if(ev.key === 'Escape') {
        wrapperEl.querySelectorAll('.active').forEach(a=>a.classList.remove('active'));
      }
    }, false);
  }

  // zoom controls installer (idempotent)
  function installZoomControls(){
    refreshRefs();
    const preview = refs.svgPreview || document.getElementById('svgPreview');
    if(!preview) return;
    if(preview._zoomControlsInstalled) return;
    preview._zoomControlsInstalled = true;

    let wrapper = preview.querySelector('.svg-wrapper');
    if(!wrapper){
      wrapper = document.createElement('div'); wrapper.className='svg-wrapper';
      preview.appendChild(wrapper);
    }

    // create controls container
    const ctrl = document.createElement('div');
    ctrl.className = 'svg-zoom-controls';
    ctrl.style.position = 'absolute';
    ctrl.style.right = '8px';
    ctrl.style.bottom = '8px';
    ctrl.style.zIndex = 9999;
    ctrl.style.display = 'flex';
    ctrl.style.flexDirection = 'column';
    ctrl.style.gap = '6px';
    ctrl.innerHTML = '<button type="button" class="zoom-in" aria-label="Zoom in">+</button><button type="button" class="zoom-fit" aria-label="Zoom fit">□</button><button type="button" class="zoom-out" aria-label="Zoom out">−</button>';
    preview.appendChild(ctrl);

    const styleBtn = fn => {
      try {
        fn.style.width='40px'; fn.style.height='40px'; fn.style.borderRadius='6px'; fn.style.border='1px solid rgba(0,0,0,0.12)'; fn.style.background='rgba(255,255,255,0.95)'; fn.style.fontSize='18px';
      } catch(e){}
    };
    Array.from(ctrl.querySelectorAll('button')).forEach(b => styleBtn(b));

    let scale = 1;
    let panX = 0, panY = 0;

    function svgRoot(){ return preview.querySelector('svg'); }
    function applyTransform(){
      const s = svgRoot();
      if(!s) return;
      s.style.transformOrigin = '0 0';
      s.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
    }

    ctrl.querySelector('.zoom-in').addEventListener('click', ()=>{ scale = Math.min(6, +(scale * 1.2).toFixed(4)); applyTransform(); });
    ctrl.querySelector('.zoom-out').addEventListener('click', ()=>{ scale = Math.max(0.25, +(scale / 1.2).toFixed(4)); applyTransform(); });
    ctrl.querySelector('.zoom-fit').addEventListener('click', ()=>{ scale = 1; panX = 0; panY = 0; try{ if(window.__svgMapper && typeof window.__svgMapper.zoomToFitImproved === 'function') window.__svgMapper.zoomToFitImproved(); }catch(e){} applyTransform(); });

    // Pointer-based pinch handling (works on iPad with Pointer Events)
    let pointers = new Map();
    preview.addEventListener('pointerdown', ev => {
      try{ preview.setPointerCapture && preview.setPointerCapture(ev.pointerId); }catch(e){}
      pointers.set(ev.pointerId, ev);
    }, {passive:true});
    preview.addEventListener('pointermove', ev => {
      if(!pointers.size) return;
      if(pointers.size === 2){
        pointers.set(ev.pointerId, ev);
        const pts = Array.from(pointers.values());
        const d = Math.hypot(pts[0].clientX - pts[1].clientX, pts[0].clientY - pts[1].clientY);
        if(preview._lastPinchDist){
          const delta = d / preview._lastPinchDist;
          scale = Math.max(0.25, Math.min(6, scale * delta));
          applyTransform();
        }
        preview._lastPinchDist = d;
      } else if(pointers.size === 1 && ev.isPrimary){
        // pan when zoomed
        if(scale !== 1){
          const last = pointers.get(ev.pointerId);
          if(last){
            panX += ev.clientX - last.clientX;
            panY += ev.clientY - last.clientY;
            applyTransform();
          }
          pointers.set(ev.pointerId, ev);
        }
      }
    }, {passive:true});
    preview.addEventListener('pointerup', ev => { pointers.delete(ev.pointerId); preview._lastPinchDist = null; try{ preview.releasePointerCapture && preview.releasePointerCapture(ev.pointerId); }catch(e){} }, {passive:true});
    preview.addEventListener('pointercancel', ev => { pointers.delete(ev.pointerId); preview._lastPinchDist = null; }, {passive:true});

    // double-tap to toggle zoom
    let lastTap = 0;
    preview.addEventListener('touchend', ev => {
      const t = Date.now();
      if(t - lastTap < 300){
        scale = (Math.abs(scale - 1) < 0.01) ? 2 : 1;
        panX = 0; panY = 0;
        applyTransform();
      }
      lastTap = t;
    }, {passive:true});
  }

  function waitAndInstall(timeoutMs){
    timeoutMs = timeoutMs || 3000;
    return new Promise(resolve => {
      refreshRefs();
      if(refs.svgFile) return resolve(installHandlerOn(refs.svgFile));
      const obs = new MutationObserver((mutations, o) => {
        refreshRefs();
        if(refs.svgFile){
          try{ o.disconnect(); }catch(e){}
          return resolve(installHandlerOn(refs.svgFile));
        }
      });
      try{ obs.observe(document.documentElement || document.body, { childList: true, subtree: true }); }catch(e){}
      setTimeout(() => { try{ obs.disconnect(); }catch(e){}; resolve(!!document.getElementById(IDS.svgFile)); }, timeoutMs);
    });
  }

  function zoomToFit(){
    refreshRefs();
    const s = refs.svgPreview && refs.svgPreview.querySelector("svg");
    if(!s) return;
    s.removeAttribute("width");
    s.removeAttribute("height");
    if(!s.getAttribute("viewBox")){
      try{
        const bb = s.getBBox();
        s.setAttribute("viewBox", `0 0 ${bb.width || 100} ${bb.height || 100}`);
      }catch(e){}
    }
    s.setAttribute("preserveAspectRatio", "xMidYMid meet");
    // reset transform-based zoom
    s.style.transform = '';
  }

  function zoomToFitImproved() {
    refreshRefs();
    const preview = refs.svgPreview || document.getElementById('svgPreview');
    if (!preview) return false;
    let svg = preview.querySelector('svg');
    if (!svg) return false;

    try { if (svg.ownerDocument !== document) svg = document.importNode(svg, true); } catch (e) {}

    let measureNode = svg.querySelector('g');
    if (!measureNode) measureNode = svg;

    let bbox = null;
    try { bbox = measureNode.getBBox(); } catch (err) { /* ignore */ }

    if(!bbox || !isFinite(bbox.width) || !isFinite(bbox.height) || (bbox.width === 0 && bbox.height === 0)){
      const vb = svg.getAttribute('viewBox');
      if(vb){
        const parts = vb.trim().split(/\s+/).map(parseFloat);
        if(parts.length === 4 && parts.every(n => isFinite(n))) bbox = { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
      }
    }
    if (!bbox || !isFinite(bbox.width) || !isFinite(bbox.height)) return false;

    const wrapperRect = preview.querySelector('.svg-wrapper') ? preview.querySelector('.svg-wrapper').getBoundingClientRect() : preview.getBoundingClientRect();
    const pad = 0.96;
    const scaleX = (wrapperRect.width * pad) / bbox.width;
    const scaleY = (wrapperRect.height * pad) / bbox.height;
    const scale = Math.min(scaleX, scaleY);

    let wrap = svg.querySelector('g[data-mapper-wrap]');
    if (!wrap) {
      wrap = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      wrap.setAttribute('data-mapper-wrap', '1');
      const children = Array.from(svg.childNodes).filter(n => !(n.nodeType === 1 && n.nodeName.toLowerCase() === 'defs'));
      children.forEach(n => wrap.appendChild(n));
      svg.appendChild(wrap);
    }

    const vbX = bbox.x, vbY = bbox.y, vbW = bbox.width, vbH = bbox.height;
    svg.setAttribute('viewBox', `${vbX} ${vbY} ${vbW} ${vbH}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    try { wrap.setAttribute('transform', ''); wrap.style.transform = ''; } catch (e) {}

    // reset transform-based zoom when fitting
    svg.style.transform = '';
    return true;
  }

  // --- Begin: Preview header tab controller (keeps IDs intact) ---
  function initPreviewHeaderController(rootSelector = '#rightPanel') {
    const viewMap = { live: 'view-live', html: 'view-html', css: 'view-css', js: 'view-js' };
    const root = document.querySelector(rootSelector);
    if (!root) return;

    const buttons = Array.from(root.querySelectorAll('.gc-btn'));
    if (!buttons.length) return;

    function showView(name) {
      Object.keys(viewMap).forEach(k => {
        const id = viewMap[k];
        const el = document.getElementById(id);
        if (!el) return;
        const active = k === name;
        el.classList.toggle('active', active);
        el.style.display = active ? '' : 'none';
        el.setAttribute('aria-hidden', String(!active));
      });
      buttons.forEach(b => b.classList.toggle('active', b.dataset.target === name));
    }

    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const t = btn.dataset.target;
        if (t === 'clear') {
          // Reset code outputs with a basic HTML scaffold for new generation work
          const htmlOut = document.getElementById('code-html');
          const cssOut = document.getElementById('code-css');
          const jsOut = document.getElementById('code-js');

          if (htmlOut) {
            htmlOut.textContent =
`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Generated from SVG</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <!-- SVG content will be inserted here -->`;
          }

          if (cssOut) cssOut.textContent = "/* Generated CSS will appear here */";
          if (jsOut) jsOut.textContent = "// Generated JS will appear here";

          // Clear live preview rendering and deselect any active SVG selection
          const live = document.getElementById('livePreview');
          const svgPrev = document.getElementById('svgPreview');
          if (live) live.innerHTML = "";
          if (svgPrev) {
            svgPrev.querySelectorAll('.active').forEach(a => a.classList.remove('active'));
            const wrapper = svgPrev.querySelector('.svg-wrapper');
            if (wrapper) {
              wrapper.scrollTop = 0;
              wrapper.scrollLeft = 0;
              const s = wrapper.querySelector('svg');
              if (s) s.style.transform = '';
            }
          }
          return;
        }
        if (t === 'reorganize') {
          document.dispatchEvent(new CustomEvent('generated:reorganize'));
          return;
        }
        if (viewMap[t]) showView(t);
      });
    });

    // ensure initial state (show live)
    showView('live');

    return { showView };
  }
  // --- End: Preview header tab controller ---

  // public API
  window.__svgMapper = window.__svgMapper || {};
  window.__svgMapper.injectSvgIntoPreview = injectSvgIntoPreview;
  window.__svgMapper.parseAndInjectSvgString = parseAndInjectSvgString;
  window.__svgMapper.normalizeSvgForPreview = normalizeSvgForPreview;
  window.__svgMapper.waitAndInstall = waitAndInstall;
  window.__svgMapper.zoomToFit = zoomToFit;
  window.__svgMapper.zoomToFitImproved = zoomToFitImproved;

  function getGroupLabel(g, idx){
    return g.getAttribute("inkscape:label") || g.getAttribute("sodipodi:label") || g.getAttribute("data-name") || g.id || ("group-" + (idx+1));
  }

  function buildLayerTree(svgEl){
    refreshRefs();
    if(!refs.layerTree || !svgEl) return;
    const layerTree = refs.layerTree;
    layerTree.innerHTML = "";
    const topGroups = Array.from(svgEl.children).filter(n => n.tagName && n.tagName.toLowerCase() === "g");
    if(topGroups.length === 0){
      const li = document.createElement("li");
      li.textContent = "No groups found";
      layerTree.appendChild(li);
      return;
    }
    function makeList(groups, container){
      groups.forEach((g, idx) => {
        const li = document.createElement("li");
        li.className = "tree-item";
        const row = document.createElement("div");
        row.className = "tree-row";
        const childGroups = Array.from(g.children).filter(c => c.tagName && c.tagName.toLowerCase() === "g");
        if(childGroups.length > 0){
          const toggle = el("button", { class: "tree-toggle", text: "▾" });
          toggle.type = "button";
          toggle.addEventListener("click", ev => {
            ev.stopPropagation();
            const sub = li.querySelector(".tree-sublist");
            if(sub) sub.classList.toggle("collapsed");
            toggle.textContent = sub && sub.classList.contains("collapsed") ? "▸" : "▾";
          });
          row.appendChild(toggle);
        } else {
          const spacer = document.createElement("span");
          spacer.style.width = "18px";
          row.appendChild(spacer);
        }
        const hidden = (g.getAttribute("display") === "none" || g.style.display === "none");
        const eye = el("button", { class: "tree-eye", text: hidden ? "🚫" : "👁️" });
        eye.type = "button";
        eye.addEventListener("click", ev => {
          ev.stopPropagation();
          const isHidden = (g.getAttribute("display") === "none" || g.style.display === "none");
          if(isHidden){
            g.style.display = "";
            g.removeAttribute("data-layer-hidden");
            eye.textContent = "👁️";
          } else {
            g.style.display = "none";
            g.setAttribute("data-layer-hidden", "1");
            eye.textContent = "🚫";
          }
          injectSvgIntoPreview(svgEl.ownerSVGElement || svgEl);
        });
        row.appendChild(eye);
        const labelBtn = el("button", { class: "tree-label", text: getGroupLabel(g, idx) });
        labelBtn.type = "button";
        labelBtn.title = g.id || "";
        labelBtn.addEventListener("click", ev => {
          ev.stopPropagation();
          if(refs.svgPreview) Array.from(refs.svgPreview.querySelectorAll(".active")).forEach(a => a.classList.remove("active"));
          g.classList.add("active");
          injectSvgIntoPreview(svgEl.ownerSVGElement || svgEl);
          setTimeout(()=> {
            const pv = document.getElementById('svgPreview');
            if(!pv) return;
            const s = pv.querySelector('svg');
            if(!s) return;
            try {
              const match = g.id ? s.querySelector(`#${CSS.escape(g.id)}`) : null;
              if(match){ s.querySelectorAll('.active').forEach(a=>a.classList.remove('active')); match.classList.add('active'); }
            }catch(e){}
          }, 40);
        });
        row.appendChild(labelBtn);
        li.appendChild(row);
        if(childGroups.length > 0){
          const subUl = document.createElement("ul");
          subUl.className = "tree-sublist";
          makeList(childGroups, subUl);
          li.appendChild(subUl);
        }
        container.appendChild(li);
      });
    }
    makeList(topGroups, layerTree);
  }

  function initTabsAndUi(){
  refreshRefs();

  // explicit outputs by id (robust)
  const outputs = {
    html: document.getElementById(IDS.codeHtml),
    css:  document.getElementById(IDS.codeCss),
    js:   document.getElementById(IDS.codeJs),
    liveViewContainer: document.getElementById('view-live') // optional
  };

  // helper to hide all code views and live view
  function hideAllViews(){
    Object.keys(outputs).forEach(k => {
      const el = outputs[k];
      if(!el) return;
      // For view-live we keep the container visible state separate, but still hide it here
      if(el === outputs.liveViewContainer){
        el.style.display = 'none';
        el.setAttribute('aria-hidden','true');
      } else {
        el.style.display = 'none';
        el.setAttribute('aria-hidden','true');
      }
    });
  }

  // helper to show a single named view: 'live'|'html'|'css'|'js'
  function showNamedView(name){
    hideAllViews();
    if(name === 'live'){
      const v = document.getElementById('view-live');
      if(v){
        v.style.display = '';
        v.setAttribute('aria-hidden','false');
      }
    } else if(name === 'html' || name === 'css' || name === 'js'){
      const id = name === 'html' ? IDS.codeHtml : (name === 'css' ? IDS.codeCss : IDS.codeJs);
      const el = document.getElementById(id);
      if(el){
        el.style.display = '';
        el.setAttribute('aria-hidden','false');
      }
    }
  }

  // wire any legacy .tab buttons (bottom-right) to the same controller if present
  const legacyTabs = document.querySelectorAll('.tab');
  Array.from(legacyTabs).forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.target;
      if(target === 'clear'){
        // produce scaffold as in header controller clear
        const htmlOut = document.getElementById(IDS.codeHtml);
        const cssOut  = document.getElementById(IDS.codeCss);
        const jsOut   = document.getElementById(IDS.codeJs);
        if(htmlOut) htmlOut.textContent =
`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Generated from SVG</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <!-- SVG content will be inserted here -->`;
        if(cssOut) cssOut.textContent = "/* Generated CSS will appear here */";
        if(jsOut) jsOut.textContent = "// Generated JS will appear here";
        // clear live area snapshot, reset selection if any
        if(refs && refs.livePreview) refs.livePreview.innerHTML = "";
        if(refs && refs.svgPreview) refs.svgPreview.querySelectorAll('.active').forEach(a=>a.classList.remove('active'));
        showNamedView('live');
        return;
      }
      if(target === 'reorganize'){
        document.dispatchEvent(new CustomEvent('generated:reorganize'));
        return;
      }
      if(target === 'live' || target === 'html' || target === 'css' || target === 'js'){
        showNamedView(target);
      }
    });
  });

  // wire header gc-btns (if present) — keep parity with legacy tabs
  const headerBtns = document.querySelectorAll('#rightPanel .gc-btn');
  Array.from(headerBtns).forEach(btn => {
    btn.addEventListener('click', () => {
      const t = btn.dataset.target;
      if(t === 'clear'){
        const htmlOut = document.getElementById(IDS.codeHtml);
        const cssOut  = document.getElementById(IDS.codeCss);
        const jsOut   = document.getElementById(IDS.codeJs);
        if(htmlOut) htmlOut.textContent =
`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Generated from SVG</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <!-- SVG content will be inserted here -->`;
        if(cssOut) cssOut.textContent = "/* Generated CSS will appear here */";
        if(jsOut) jsOut.textContent = "// Generated JS will appear here";
        if(refs && refs.livePreview) refs.livePreview.innerHTML = "";
        if(refs && refs.svgPreview) refs.svgPreview.querySelectorAll('.active').forEach(a=>a.classList.remove('active'));
        showNamedView('live');
        return;
      }
      if(t === 'reorganize'){
        document.dispatchEvent(new CustomEvent('generated:reorganize'));
        return;
      }
      if(t === 'live' || t === 'html' || t === 'css' || t === 'js'){
        // update active button visuals (both header and legacy if needed)
        Array.from(headerBtns).forEach(b => b.classList.toggle('active', b === btn));
        Array.from(legacyTabs).forEach(tb => tb.classList.toggle('active', tb.dataset.target === t));
        showNamedView(t);
      }
    });
  });

  // sync mode select and debug toggle if present
  if(refs.debugToggle) refs.debugToggle.addEventListener("change", () => document.body.classList.toggle("debug-overlay", refs.debugToggle.checked));
  if(refs.modeSelect) refs.modeSelect.addEventListener("change", () => {
    document.body.classList.toggle("theme-dark", refs.modeSelect.value === "dark");
    document.body.classList.toggle("theme-light", refs.modeSelect.value === "light");
  });

  // ensure initial state
  showNamedView('live');
}


  function attachUiHelpers(){
    refreshRefs();
    initTabsAndUi();

    // wire preview header tabs (Live / HTML / CSS / JS)
    try { initPreviewHeaderController('#rightPanel'); } catch (e) {}

    if(refs.zoomToFit){
      try{ refs.zoomToFit.removeEventListener("click", refs.zoomToFit._mapperZoom); }catch(e){}
      refs.zoomToFit._mapperZoom = function(){ zoomToFit(); };
      refs.zoomToFit.addEventListener("click", refs.zoomToFit._mapperZoom);
    }

    // ensure click delegation is installed (pointer-based)
    try { installPreviewClickDelegation(); } catch(e){}
    try { installZoomControls(); } catch(e){}
  }

  function autoInit(){
    refreshRefs();
    attachUiHelpers();
    waitAndInstall().then(() => {
      refreshRefs();
      try { installPreviewClickDelegation(); installZoomControls(); } catch(e){}
    });
  }

  if(document.readyState === "complete" || document.readyState === "interactive"){
    autoInit();
  } else {
    document.addEventListener("DOMContentLoaded", autoInit);
  }

})();
