/* scripts.js — rebuilt, minimal, resilient init, normalizes injected SVG for preview */
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
  let refs = {};
  function refreshRefs(){
    Object.keys(IDS).forEach(k => refs[k] = document.getElementById(IDS[k]));
  }

  /* small helpers */
  function qs(id){ return document.getElementById(id); }
  function el(tag, attrs){ const e = document.createElement(tag); attrs = attrs || {}; Object.keys(attrs).forEach(k=>{ if(k==="class") e.className = attrs[k]; else if(k==="text") e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); }); return e; }
  function parseFloatSafe(v){ const n = parseFloat(v); return isFinite(n) ? n : null; }

  /* normalize + sanitize an SVG node before inserting into preview */
  function normalizeSvgForPreview(svgNode){
    if(!svgNode) return null;
    const clone = svgNode.cloneNode(true);

    // remove Inkscape / metadata nodes that can affect layout
    Array.from(clone.querySelectorAll("sodipodi\\:namedview, metadata, title, desc, editor, script")).forEach(n => n.remove());

    // try to remove page-sized rects that act as backgrounds
    const vbRaw = clone.getAttribute("viewBox");
    let vb = null;
    if(vbRaw) {
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

    // ensure viewBox exists; if not, infer from width/height (if numeric)
    if(!clone.hasAttribute("viewBox")){
      const w = parseFloatSafe(clone.getAttribute("width"));
      const h = parseFloatSafe(clone.getAttribute("height"));
      if(w && h) clone.setAttribute("viewBox", `0 0 ${w} ${h}`);
    }

    // remove width/height so CSS controls sizing
    clone.removeAttribute("width");
    clone.removeAttribute("height");

    // ensure preserveAspectRatio
    if(!clone.getAttribute("preserveAspectRatio")) clone.setAttribute("preserveAspectRatio", "xMidYMid meet");

    return clone;
  }

  /* inject into preview wrapper (ensures DOM node, not text) */
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

    // force style constraints to cooperate with CSS
    normalized.style.display = "block";
    normalized.style.maxWidth = "100%";
    normalized.style.maxHeight = "100%";
    normalized.style.width = "auto";
    normalized.style.height = "auto";

    return true;
  }

  /* parse text (SVG source) then inject */
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
        // place raw text in live preview as escaped code
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

  /* wait for the input and attach (MutationObserver fallback) */
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

  /* zoom-to-fit helper that re-normalizes current svg */
  function zoomToFit(){
    refreshRefs();
    const s = refs.svgPreview && refs.svgPreview.querySelector("svg");
    if(!s) return;
    // ensure viewBox present; remove width/height to let CSS scale
    s.removeAttribute("width");
    s.removeAttribute("height");
    if(!s.getAttribute("viewBox")){
      try{
        const bb = s.getBBox();
        s.setAttribute("viewBox", `0 0 ${bb.width || 100} ${bb.height || 100}`);
      }catch(e){}
    }
    s.setAttribute
