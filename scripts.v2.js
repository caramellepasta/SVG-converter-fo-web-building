/* scripts.js — rebuilt, complete, minimal debug surface, normalizes injected SVG for preview */
(function(){
  "use strict";

  /* IDs used by the page */
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

  /* runtime refs */
  const refs = {};
  function refreshRefs(){
    Object.keys(IDS).forEach(k => refs[k] = document.getElementById(IDS[k]));
  }

  /* small helpers */
  function qs(id){ return document.getElementById(id); }
  function el(tag, attrs){ const e = document.createElement(tag); attrs = attrs || {}; Object.keys(attrs).forEach(k=>{ if(k==="class") e.className = attrs[k]; else if(k==="text") e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); }); return e; }
  function parseFloatSafe(v){ const n = parseFloat(v); return isFinite(n) ? n : null; }

  /* sanitize / normalize an SVG node for preview */
  function normalizeSvgForPreview(svgNode){
    if(!svgNode) return null;
    const clone = svgNode.cloneNode(true);

    // remove Inkscape / metadata nodes that can affect layout
    Array.from(clone.querySelectorAll("sodipodi\\:namedview, metadata, title, desc, script")).forEach(n => n.remove());

    // compute viewBox if present
    let vb = null;
    const vbRaw = clone.getAttribute("viewBox");
    if(vbRaw){
      const parts = vbRaw.trim().split(/\s+/).map(parseFloat);
      if(parts.length === 4 && parts.every(n => isFinite(n))) vb = parts;
    }

    // remove page-sized rects (common Inkscape background)
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

    // ensure viewBox exists; infer from width/height if possible
    if(!clone.hasAttribute("viewBox")){
      const w = parseFloatSafe(clone.getAttribute("width"));
      const h = parseFloatSafe(clone.getAttribute("height"));
      if(w && h) clone.setAttribute("viewBox", `0 0 ${w} ${h}`);
    }

    // remove fixed width/height so CSS controls sizing
    clone.removeAttribute("width");
    clone.removeAttribute("height");

    // ensure preserveAspectRatio
    if(!clone.getAttribute("preserveAspectRatio")) clone.setAttribute("preserveAspectRatio", "xMidYMid meet");

    return clone;
  }

  /* inject normalized SVG DOM node into preview wrapper */
  function injectSvgIntoPreview(svgOrString){
    refreshRefs();
    const preview = refs.svgPreview;
    if(!preview) return false;

    // obtain a DOM svg node
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

    // create/clear wrapper
    let wrapper = preview.querySelector(".svg-wrapper");
    if(!wrapper){
      wrapper = document.createElement("div");
      wrapper.className = "svg-wrapper";
      preview.appendChild(wrapper);
    }
    wrapper.innerHTML = "";
    wrapper.appendChild(normalized);

    // style constraints to cooperate with CSS
    normalized.style.display = "block";
    normalized.style.maxWidth = "100%";
    normalized.style.maxHeight = "100%";
    normalized.style.width = "auto";
    normalized.style.height = "auto";

    return true;
  }

  /* parse SVG text then inject */
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

  /* idempotent file input attach */
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
      reader.onload = function(e){
        const text = e.target.result || "";
        refreshRefs();
        if(refs.livePreview) refs.livePreview.textContent = text;
        parseAndInjectSvgString(text);
      };
      reader.readAsText(file);
    };
    inputEl._mapperHandler = handler;
    inputEl.addEventListener("change", handler);
    return true;
  }

  /* MutationObserver fallback to attach if input appears later */
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

  /* zoom-to-fit helper: ensures viewBox and removes width/height */
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

  /* small public API */
  window.__svgMapper = window.__svgMapper || {};
  window.__svgMapper.injectSvgIntoPreview = injectSvgIntoPreview;
  window.__svgMapper.parseAndInjectSvgString = parseAndInjectSvgString;
  window.__svgMapper.normalizeSvgForPreview = normalizeSvgForPreview;
  window.__svgMapper.waitAndInstall = waitAndInstall;
  window.__svgMapper.zoomToFit = zoomToFit;

  /* UI helper wiring (zoom button, tabs) */
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
  }

  function autoInit(){
    refreshRefs();
    attachUiHelpers();
    waitAndInstall().then(() => refreshRefs());
  }

  if(document.readyState === "complete" || document.readyState === "interactive"){
    autoInit();
  } else {
    document.addEventListener("DOMContentLoaded", autoInit);
  }
reader.onload = function(e) {
  var txt = e.target.result || "";

  // keep a small, copyable slice in the live preview to avoid huge DOM costs
  var maxPreview = 200000; // adjust if you want more
  if (refs && refs.livePreview) {
    refs.livePreview.textContent = txt.length > maxPreview ? txt.slice(0, maxPreview) + "\n\n...TRUNCATED..." : txt;
  }

  // parse into a document and import the svg node into this document
  var doc = new DOMParser().parseFromString(txt, "image/svg+xml");
  var svgEl = doc.querySelector("svg");
  if (!svgEl) return;

  // import into current document so events, queries and tree-building work
  var svgClone = document.importNode(svgEl, true);

  // normalize minimal metadata and sizing
  Array.from(svgClone.querySelectorAll("sodipodi\\:namedview, metadata, title, desc")).forEach(n => n.remove());
  if (!svgClone.getAttribute("viewBox")) {
    var w = parseFloat(svgClone.getAttribute("width"));
    var h = parseFloat(svgClone.getAttribute("height"));
    if (isFinite(w) && isFinite(h) && w > 0 && h > 0) svgClone.setAttribute("viewBox", "0 0 " + w + " " + h);
  }
  svgClone.removeAttribute("width");
  svgClone.removeAttribute("height");
  if (!svgClone.getAttribute("preserveAspectRatio")) svgClone.setAttribute("preserveAspectRatio", "xMidYMid meet");

  // insert into preview wrapper
  var preview = document.getElementById("svgPreview");
  if (!preview) return;
  var wrapper = preview.querySelector(".svg-wrapper");
  if (!wrapper) { wrapper = document.createElement("div"); wrapper.className = "svg-wrapper"; preview.appendChild(wrapper); }
  wrapper.innerHTML = "";
  wrapper.appendChild(svgClone);

  // ensure style constraints
  svgClone.style.display = "block";
  svgClone.style.maxWidth = "100%";
  svgClone.style.maxHeight = "100%";
  svgClone.style.width = "auto";
  svgClone.style.height = "auto";

  // rebuild layer tree from the root imported clone
  if (typeof buildLayerTree === "function") buildLayerTree(svgClone);
};

})();
