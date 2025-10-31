/* scripts.v2.js — rebuilt, complete, stable preview, improved zoomToFit, selection + clamps + interaction fixes */
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

  // --- global clamp to prevent ancestor-driven mega-widths ---
  (function ensureSvgMapperClamp(){
    if(document.getElementById('svgMapperGlobalClamp')) return;
    try{
      const css = `
        /* svg-mapper safety clamp (idempotent) */
        #svgPreview, #svgPreview .svg-wrapper { box-sizing: border-box !important; max-width: 100% !important; width: 720px !important; height: 520px !important; }
        html, body, #root, .app, .container { box-sizing: border-box !important; max-width: 1600px !important; }
        #svgPreview .svg-wrapper { background: transparent !important; overflow: auto !important; touch-action: manipulation !important; }
        #svgPreview svg * { cursor: pointer !important; pointer-events: auto !important; }
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

    // layout safety on preview + wrapper
    try {
      preview.style.position = preview.style.position || 'relative';
      preview.style.background = preview.style.background || '#f3e0c8';
      preview.style.boxSizing = 'border-box';
      wrapper.style.position = wrapper.style.position || 'relative';
      wrapper.style.background = 'transparent';
      wrapper.style.overflow = wrapper.style.overflow || 'auto';
      wrapper.style.width = wrapper.style.width || '720px';
      wrapper.style.height = wrapper.style.height || '520px';
      wrapper.style.maxWidth = '100%';
      wrapper.tabIndex = wrapper.tabIndex || -1;
      wrapper.style.padding = wrapper.style.padding || '8px';
    } catch(e){}
	// post-insert: reset any forced sizing and reset scroll/focus so preview isn't clipped
	try {
	  // prefer responsive sizing, not fixed px
	  preview.style.width = preview.style.width || '';
	  preview.style.height = preview.style.height || '';
	  wrapper.style.width = '100%';
	  wrapper.style.maxWidth = '100%';
	  wrapper.style.maxHeight = wrapper.style.maxHeight || '80vh';
	  wrapper.style.overflow = wrapper.style.overflow || 'auto';

	  // reset scroll so top of artwork is visible and focus for keyboard (Escape)
	  wrapper.scrollTop = 0;
	  wrapper.scrollLeft = 0;
	  wrapper.focus && wrapper.focus();
	} catch(e){}
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

    // normalize images/foreignObject sizes
    try {
      Array.from(normalized.querySelectorAll('image, foreignObject')).forEach(el=>{
        el.removeAttribute('width'); el.removeAttribute('height');
        if (el.style && el.style.width && el.style.width.includes('px')) el.style.width = '';
        if (el.style && el.style.height && el.style.height.includes('px')) el.style.height = '';
        el.style.maxWidth = '100%'; el.style.maxHeight = '100%';
      });
    } catch(e){}

    // hide very large rects likely used as page backgrounds (mark for restore)
    try {
      Array.from(normalized.querySelectorAll('rect')).forEach(r => {
        const rw = parseFloatSafe(r.getAttribute('width')||0);
        const rh = parseFloatSafe(r.getAttribute('height')||0);
        if ((rw > 100 && rh > 100 && (rw / Math.max(rh,1)) > 0.05) || rw > 1000 || rh > 1000) {
          r.dataset.__hidden_by_mapper = '1';
          r.dataset.__hidden_prev_display = r.style.display || '';
          r.style.display = 'none';
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

        const maxPreview = 200000;
        refreshRefs();
        if (refs && refs.livePreview) {
          refs.livePreview.textContent = txt.length > maxPreview ? txt.slice(0, maxPreview) + "\n\n...TRUNCATED..." : txt;
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
          preview.style.background = preview.style.background || '#f3e0c8';
          preview.style.boxSizing = 'border-box';
          wrapper.style.position = wrapper.style.position || 'relative';
          wrapper.style.background = 'transparent';
          wrapper.style.overflow = wrapper.style.overflow || 'auto';
          wrapper.style.width = wrapper.style.width || '720px';
          wrapper.style.height = wrapper.style.height || '520px';
          wrapper.style.maxWidth = '100%';
          wrapper.tabIndex = wrapper.tabIndex || -1;
          wrapper.style.padding = wrapper.style.padding || '8px';
        } catch (ex) { /* ignore */ }

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

        // normalize images/foreignObject and hide big rects/images
        try {
          Array.from(svgClone.querySelectorAll('image, foreignObject')).forEach(el=>{
            el.removeAttribute('width'); el.removeAttribute('height');
            if (el.style && el.style.width && el.style.width.includes('px')) el.style.width = '';
            if (el.style && el.style.height && el.style.height.includes('px')) el.style.height = '';
            el.style.maxWidth = '100%'; el.style.maxHeight = '100%';
          });
          Array.from(svgClone.querySelectorAll('rect')).forEach(r => {
            const rw = parseFloatSafe(r.getAttribute('width')||0);
            const rh = parseFloatSafe(r.getAttribute('height')||0);
            if ((rw > 100 && rh > 100 && (rw / Math.max(rh,1)) > 0.05) || rw > 1000 || rh > 1000) {
              r.dataset.__hidden_by_mapper = '1';
              r.dataset.__hidden_prev_display = r.style.display || '';
              r.style.display = 'none';
            }
          });
          Array.from(svgClone.querySelectorAll('image')).forEach(img => {
            img.dataset.__hidden_by_mapper_img = '1';
            img.dataset.__hidden_prev_display = img.style.display || '';
            img.style.display = 'none';
          });
        } catch(e){}

        if (typeof buildLayerTree === "function") {
          try { buildLayerTree(svgClone); } catch(e) {}
        }

        // ensure click selection is available immediately
        try { installPreviewClickDelegation(); } catch(e){}

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

  // click/delegation installer (idempotent)
  function installPreviewClickDelegation(){
    refreshRefs();
    const previewEl = document.getElementById('svgPreview');
    if(!previewEl) return;
    const wrapperEl = previewEl.querySelector('.svg-wrapper');
    if(!wrapperEl) return;
    if(wrapperEl._svgClickHandlerInstalled) return;
    wrapperEl._svgClickHandlerInstalled = true;

    // Clear selection helper
    function clearSelection(){
      const s = wrapperEl.querySelector('svg');
      if(s) s.querySelectorAll('.active').forEach(a=>a.classList.remove('active'));
      const lt = document.getElementById('layerTree');
      if(lt) lt.querySelectorAll('.active').forEach(n=>n.classList.remove('active'));
    }

    // Delegate clicks: select nearest SVG group/element, or deselect on background
    wrapperEl.addEventListener('click', function(ev){
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
        // match by id (labelBtn.title stores id), fallback to text match
        let btn = lt.querySelector(`.tree-label[title="${el.id}"]`);
        if(!btn){
          // try to find by matching label text to element's inkscape:label / data-name
          btn = Array.from(lt.querySelectorAll('.tree-label')).find(b => b.textContent && el.getAttribute && b.textContent.trim() === (el.getAttribute('inkscape:label')||el.getAttribute('data-name')||el.id||''));
        }
        if(btn) btn.classList.add('active');
      }
    }, false);

    // keyboard: Escape clears selection
    wrapperEl.addEventListener('keydown', function(ev){
      if(ev.key === 'Escape') clearSelection();
    }, false);
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

    return true;
  }

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
    const tabs = document.querySelectorAll(".tab");
    const outputs = { html: refs.codeHtml, css: refs.codeCss, js: refs.codeJs };
    if(!tabs || !tabs.length) return;
    tabs.forEach(tab => tab.addEventListener("click", () => {
      const target = tab.dataset.target;
      Object.values(outputs).forEach(el => el && el.classList.add("hidden"));
      if(target === "clear"){
        Object.values(outputs).forEach(el => { if(el) el.textContent = ""; });
        if(refs.livePreview) refs.livePreview.innerHTML = "";
        if(refs.svgPreview) refs.svgPreview.querySelectorAll(".active").forEach(a => a.classList.remove("active"));
      } else {
        const panel = outputs[target];
        if(panel) panel.classList.remove("hidden");
      }
    }));
    if(refs.debugToggle) refs.debugToggle.addEventListener("change", () => document.body.classList.toggle("debug-overlay", refs.debugToggle.checked));
    if(refs.modeSelect) refs.modeSelect.addEventListener("change", () => {
      document.body.classList.toggle("theme-dark", refs.modeSelect.value === "dark");
      document.body.classList.toggle("theme-light", refs.modeSelect.value === "light");
    });
  }

  function attachUiHelpers(){
    refreshRefs();
    initTabsAndUi();
    if(refs.zoomToFit){
      try{ refs.zoomToFit.removeEventListener("click", refs.zoomToFit._mapperZoom); }catch(e){}
      refs.zoomToFit._mapperZoom = function(){ zoomToFit(); };
      refs.zoomToFit.addEventListener("click", refs.zoomToFit._mapperZoom);
    }

    // ensure click delegation is installed (idempotent)
    try { installPreviewClickDelegation(); } catch(e){}
  }

  function autoInit(){
    refreshRefs();
    attachUiHelpers();
    waitAndInstall().then(() => {
      refreshRefs();
      try { installPreviewClickDelegation(); } catch(e){}
    });
  }

  if(document.readyState === "complete" || document.readyState === "interactive"){
    autoInit();
  } else {
    document.addEventListener("DOMContentLoaded", autoInit);
  }

})();
