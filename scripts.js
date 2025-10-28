/* =============================
   📜 Inkscape SVG to HTML Mapper — Part 1
   Core setup, refs, feature flags, theme
   ============================= */
   document.addEventListener("DOMContentLoaded", () => { /* paste full script here */ });

/* ======= Refs (IDs must match your DOM) ======= */
const svgFileInput = document.getElementById("svgFile");
const svgPreview = document.getElementById("svgPreview");     // injection target for <svg>
const livePreview = document.getElementById("livePreview");   // optional rendered HTML copy
const codeHtml = document.getElementById("code-html");
const codeCss = document.getElementById("code-css");
const codeJs = document.getElementById("code-js");
const layerTree = document.getElementById("layerTree");
const zoomBtn = document.getElementById("zoomToFit");/* =============================
   Inkscape SVG → HTML Mapper
   Robust scripts.js — Upload handler fixed + resilient init + debug helpers
   Replace your existing scripts.js with this file
   ============================= */
(function () {
  "use strict";

  /* ======= Refs (DOM elements used by the UI) ======= */
  const svgPreviewId = "svgPreview";
  const svgFileId = "svgFile";
  const livePreviewId = "livePreview";
  const codeHtmlId = "code-html";
  const codeCssId = "code-css";
  const codeJsId = "code-js";
  const layerTreeId = "layerTree";
  const zoomBtnId = "zoomToFit";
  const modeSelectId = "modeSelect";
  const debugToggleId = "debugToggle";

  let svgFileInput = null;
  let svgPreview = null;
  let livePreview = null;
  let codeHtml = null;
  let codeCss = null;
  let codeJs = null;
  let layerTree = null;
  let zoomBtn = null;
  let modeSelect = null;
  let debugToggle = null;

  /* ======= Feature flags & constants ======= */
  const VISUAL_SCALE_THRESHOLD = 1.15;
  const DESIRED_FILL = 0.72;

  /* =============================
     Utilities
     ============================= */
  function qs(id) { return document.getElementById(id); }

  function el(tag, props = {}) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === "class") e.className = v;
      else if (k === "text") e.textContent = v;
      else e.setAttribute(k, v);
    }
    return e;
  }

  function parseSvgNumeric(val) {
    if (val == null) return null;
    const s = String(val).trim();
    if (s === "") return null;
    const n = parseFloat(s);
    if (!isFinite(n)) return null;
    if (s.endsWith("px")) return n;
    if (s.endsWith("mm")) return n * (96 / 25.4);
    if (s.endsWith("cm")) return n * (96 / 2.54);
    if (s.endsWith("in")) return n * 96;
    return n;
  }

  function safeQueryInPreviewById(id) {
    if (!id || !svgPreview) return null;
    try { return svgPreview.querySelector(`#${CSS.escape(id)}`); }
    catch (e) { return svgPreview.querySelector(`[id="${id}"]`); }
  }

  /* =============================
     ViewBox & background rect cleanup
     ============================= */
  function safeKeepAuthorViewBox(svgEl) {
    if (!svgEl) return;
    const hasVB = svgEl.hasAttribute("viewBox");
    const rawW = svgEl.getAttribute("width");
    const rawH = svgEl.getAttribute("height");
    if (rawW) svgEl.removeAttribute("width");
    if (rawH) svgEl.removeAttribute("height");

    if (!hasVB) {
      const w = parseSvgNumeric(rawW);
      const h = parseSvgNumeric(rawH);
      if (w && h) {
        svgEl.setAttribute("viewBox", `0 0 ${w} ${h}`);
      } else {
        const rects = Array.from(svgEl.querySelectorAll("rect"));
        if (rects.length) {
          const largest = rects
            .map(r => ({ w: parseSvgNumeric(r.getAttribute("width")), h: parseSvgNumeric(r.getAttribute("height")) }))
            .reduce((a,b)=>((a.w||0)*(a.h||0) >= (b.w||0)*(b.h||0) ? a : b), { w: 800, h: 600 });
          svgEl.setAttribute("viewBox", `0 0 ${largest.w || 800} ${largest.h || 600}`);
        }
      }
    }

    svgEl.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svgEl.style.width = "100%";
    svgEl.style.height = "auto";
    svgEl.style.display = "block";
  }

  function hidePageSizedRects(svgEl) {
    if (!svgEl) return;
    const vb = svgEl.getAttribute("viewBox");
    if (!vb) return;
    const [vx, vy, vw, vh] = vb.split(/\s+/).map(parseFloat);
    if (![vx,vy,vw,vh].every(n => isFinite(n))) return;
    Array.from(svgEl.querySelectorAll("rect")).forEach(rect => {
      const rw = parseSvgNumeric(rect.getAttribute("width"));
      const rh = parseSvgNumeric(rect.getAttribute("height"));
      const rx = parseSvgNumeric(rect.getAttribute("x")) || 0;
      const ry = parseSvgNumeric(rect.getAttribute("y")) || 0;
      const opa = parseFloat(rect.getAttribute("opacity") || getComputedStyle(rect).opacity || 1);
      const covers = !isNaN(rw) && !isNaN(rh) && Math.abs(rw - vw) < 1 && Math.abs(rh - vh) < 1 && Math.abs(rx - vx) < 1 && Math.abs(ry - vy) < 1;
      if (covers && opa >= 0.99) {
        rect.style.display = "none";
        rect.dataset.__hidden_by_mapper = "true";
        console.log("[hidePageSizedRects] hid rect", { id: rect.id || null, w: rw, h: rh, x: rx, y: ry });
      }
    });
  }

  /* =============================
     Preview helpers
     ============================= */
  function injectSvgIntoPreview(svgEl) {
    if (!svgPreview) return;
    let wrapper = svgPreview.querySelector(".svg-wrapper");
    if (!wrapper) {
      wrapper = document.createElement("div");
      wrapper.className = "svg-wrapper";
      svgPreview.appendChild(wrapper);
    }
    wrapper.innerHTML = "";
    wrapper.style.display = "flex";
    wrapper.style.alignItems = "center";
    wrapper.style.justifyContent = "center";
    wrapper.style.overflow = "hidden";
    wrapper.appendChild(svgEl);
  }

  function forcePreviewVisibility(svgEl, container) {
    if (!svgEl || !container) return;
    container.style.display = "flex";
    container.style.alignItems = "center";
    container.style.justifyContent = "center";
    container.style.overflow = "visible";

    svgEl.style.width = "100%";
    svgEl.style.height = "auto";
    svgEl.style.maxWidth = "100%";
    svgEl.style.maxHeight = "100%";
    svgEl.style.display = "block";
    svgEl.setAttribute("preserveAspectRatio", svgEl.getAttribute("preserveAspectRatio") || "xMidYMid meet");
    svgEl.style.filter = "none";
    svgEl.style.opacity = "1";
    svgEl.style.mixBlendMode = "normal";
    svgEl.style.transform = "";

    try {
      const bb = svgEl.getBBox();
      const containerRect = container.getBoundingClientRect();
      const cw = containerRect.width || Math.max(window.innerWidth * 0.5, 200);
      const ch = containerRect.height || Math.max(window.innerHeight * 0.5, 200);
      const scaleX = (cw * DESIRED_FILL) / Math.max(bb.width, 1);
      const scaleY = (ch * DESIRED_FILL) / Math.max(bb.height, 1);
      const targetScale = Math.min(scaleX, scaleY);
      if (isFinite(targetScale) && targetScale > VISUAL_SCALE_THRESHOLD) {
        svgEl.style.transformOrigin = "50% 50%";
        svgEl.style.transition = "transform 160ms ease";
        svgEl.style.transform = `scale(${targetScale})`;
        console.log("[forcePreviewVisibility] applied visual scale", targetScale.toFixed(2));
      }
    } catch (e) {
      console.warn("[forcePreviewVisibility] getBBox failed; skipped visual scale", e && e.message ? e.message : e);
    }

    hidePageSizedRects(svgEl);
  }

  /* =============================
     Layer tree builder (kept minimal)
     ============================= */
  function getGroupLabel(g, idx) {
    return g.getAttribute("inkscape:label") || g.getAttribute("sodipodi:label") || g.getAttribute("data-name") || g.id || `group-${idx+1}`;
  }

  function buildLayerTree(svgEl) {
    if (!layerTree || !svgEl) return;
    layerTree.innerHTML = "";
    const topGroups = Array.from(svgEl.children).filter(n => n.tagName && n.tagName.toLowerCase() === "g");
    if (topGroups.length === 0) {
      const li = document.createElement("li");
      li.textContent = "No groups found";
      layerTree.appendChild(li);
      return;
    }
    function makeList(groups, container) {
      groups.forEach((g, idx) => {
        const li = document.createElement("li");
        li.className = "tree-item";
        const row = document.createElement("div");
        row.className = "tree-row";
        const childGroups = Array.from(g.children).filter(c => c.tagName && c.tagName.toLowerCase() === "g");
        if (childGroups.length > 0) {
          const toggle = el("button", { class: "tree-toggle", text: "▾" });
          toggle.type = "button";
          toggle.addEventListener("click", (ev) => {
            ev.stopPropagation();
            const sub = li.querySelector(".tree-sublist");
            if (sub) sub.classList.toggle("collapsed");
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
        eye.addEventListener("click", (ev) => {
          ev.stopPropagation();
          const isHidden = (g.getAttribute("display") === "none" || g.style.display === "none");
          if (isHidden) {
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
        labelBtn.addEventListener("click", (ev) => {
          ev.stopPropagation();
          if (svgPreview) svgPreview.querySelectorAll(".active").forEach(a => a.classList.remove("active"));
          g.classList.add("active");
          injectSvgIntoPreview(svgEl.ownerSVGElement || svgEl);
        });
        row.appendChild(labelBtn);
        li.appendChild(row);
        if (childGroups.length > 0) {
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

  /* =============================
     Tabs and UI wiring
     ============================= */
  function initTabsAndUi() {
    const tabs = document.querySelectorAll(".tab");
    const outputs = { html: codeHtml, css: codeCss, js: codeJs };
    if (!tabs || !tabs.length) return;
    tabs.forEach(tab => {
      tab.addEventListener("click", () => {
        const target = tab.dataset.target;
        Object.values(outputs).forEach(el => el && el.classList.add("hidden"));
        if (target === "clear") {
          Object.values(outputs).forEach(el => { if (el) el.textContent = ""; });
          if (livePreview) livePreview.innerHTML = "";
          if (svgPreview) svgPreview.querySelectorAll(".active").forEach(a => a.classList.remove("active"));
        } else {
          const panel = outputs[target];
          if (panel) panel.classList.remove("hidden");
        }
      });
    });
    if (debugToggle) {
      debugToggle.addEventListener("change", () => {
        document.body.classList.toggle("debug-overlay", debugToggle.checked);
      });
    }
    if (modeSelect) {
      modeSelect.addEventListener("change", () => {
        document.body.classList.toggle("theme-dark", modeSelect.value === "dark");
        document.body.classList.toggle("theme-light", modeSelect.value === "light");
      });
    }
  }

  /* =============================
     Robust parse + inject
     ============================= */
  function parseAndInjectSvgString(svgString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, "image/svg+xml");
    let svgEl = doc.documentElement;
    if (!svgEl || svgEl.tagName.toLowerCase() !== "svg") {
      svgEl = doc.querySelector("svg");
      if (!svgEl) return { error: "no-svg" };
    }
    svgEl = svgEl.cloneNode(true);
    safeKeepAuthorViewBox(svgEl);
    hidePageSizedRects(svgEl);
    injectSvgIntoPreview(svgEl);
    forcePreviewVisibility(svgEl, svgPreview);
    buildLayerTree(svgEl);
    return { svgEl };
  }

  /* =============================
     Robust file input attach (resilient init)
     - installHandlerOn: idempotent install
     - waitAndInstall: immediate + MutationObserver fallback
     - window.__svgMapper.init exposed for manual reattach
     ============================= */
  function installHandlerOn(inputEl) {
    if (!inputEl) return false;
    // remove previous mapper handler
    if (inputEl._mapperHandler) {
      try { inputEl.removeEventListener("change", inputEl._mapperHandler); } catch(e) {}
      inputEl._mapperHandler = null;
    }
    const handler = (ev) => {
      (async function () {
        console.group("[upload] handler");
        try {
          const file = ev.target && ev.target.files && ev.target.files[0];
          console.log("file present:", !!file);
          if (!file) { console.warn("[upload] no file selected"); console.groupEnd(); return; }
          console.log("file:", file.name, file.type, file.size);
          const text = await file.text();
          console.log("[upload] read length:", text.length);
          if (livePreview) livePreview.innerText = text;
          if (codeHtml) codeHtml.textContent = text;
          const result = parseAndInjectSvgString(text);
          if (result && result.error === "no-svg") {
            console.warn("[upload] file read but no <svg> found");
          } else {
            console.log("[upload] SVG parsed and injected");
          }
        } catch (err) {
          console.error("[upload] handler error", err && err.message ? err.message : err);
        } finally {
          console.groupEnd();
        }
      })();
    };
    inputEl._mapperHandler = handler;
    inputEl.addEventListener("change", handler);
    console.log("[attach] upload handler attached idempotently");
    return true;
  }

  function waitAndInstall(timeoutMs = 3000) {
    return new Promise((resolve) => {
      const now = document.getElementById(svgFileId);
      if (now) return resolve(installHandlerOn(now));
      const obs = new MutationObserver((mutations, o) => {
        const el = document.getElementById(svgFileId);
        if (el) {
          try { o.disconnect(); } catch (_) {}
          return resolve(installHandlerOn(el));
        }
      });
      try { obs.observe(document.documentElement || document.body, { childList: true, subtree: true }); } catch (_) {}
      setTimeout(() => { try { obs.disconnect(); } catch(_){}; resolve(!!document.getElementById(svgFileId)); }, timeoutMs);
    });
  }

  // Expose init for manual reattach
  window.__svgMapper = window.__svgMapper || {};
  window.__svgMapper.init = window.__svgMapper.init || function() {
    waitAndInstall().then(ok => {
      if (!ok) console.warn("[init] #svgFile not found within timeout; call window.__svgMapper.init() again after DOM changes");
      else console.log("[init] file handler installed");
      // refresh refs in case DOM was populated later
      refreshRefs();
    });
  };

  /* =============================
     Refs refresh and initial wiring
     ============================= */
  function refreshRefs() {
    svgFileInput = qs(svgFileId);
    svgPreview = qs(svgPreviewId);
    livePreview = qs(livePreviewId);
    codeHtml = qs(codeHtmlId);
    codeCss = qs(codeCssId);
    codeJs = qs(codeJsId);
    layerTree = qs(layerTreeId);
    zoomBtn = qs(zoomBtnId);
    modeSelect = qs(modeSelectId);
    debugToggle = qs(debugToggleId);
  }

  function attachUiHelpers() {
    refreshRefs();
    initTabsAndUi();
    if (zoomBtn) {
      try {
        zoomBtn.removeEventListener("click", zoomBtn._mapperZoom);
      } catch (e) {}
      zoomBtn._mapperZoom = function () {
        const svgEl = svgPreview ? svgPreview.querySelector("svg") : null;
        if (!svgEl) return;
        safeKeepAuthorViewBox(svgEl);
        hidePageSizedRects(svgEl);
        forcePreviewVisibility(svgEl, svgPreview);
      };
      zoomBtn.addEventListener("click", zoomBtn._mapperZoom);
    }
  }

  /* =============================
     Debug helpers and console API
     ============================= */
  function logSvgSnapshot(svgEl, label = "SVG") {
    if (!svgEl) return;
    const vb = svgEl.getAttribute("viewBox");
    const children = svgEl.querySelectorAll(":scope > *").length;
    const hasFO = !!svgEl.querySelector("foreignObject");
    console.log(`[Snapshot] ${label}`, { viewBox: vb, topLevelChildren: children, foreignObject: hasFO });
  }

  function applyDebugReveal(svgEl) {
    if (!svgEl) return;
    Array.from(svgEl.querySelectorAll("*")).forEach(el => {
      try {
        const tag = (el.tagName || "").toLowerCase();
        if (["defs","lineargradient","radialgradient","pattern","mask","clippath","filter","metadata","desc","title"].includes(tag)) return;
        if (!el.getAttribute("fill") || el.getAttribute("fill") === "none") el.setAttribute("fill", "magenta");
        if (!el.getAttribute("stroke") || el.getAttribute("stroke") === "none") el.setAttribute("stroke", "black");
        el.setAttribute("opacity", "1");
      } catch (e) {}
    });
  }

  function neutralizeDefsForDebug(svgEl) {
    if (!svgEl) return;
    Array.from(svgEl.querySelectorAll("[mask]")).forEach(el => { el.dataset._mask = el.getAttribute("mask") || ""; el.removeAttribute("mask"); });
    Array.from(svgEl.querySelectorAll("[clip-path]")).forEach(el => { el.dataset._clip = el.getAttribute("clip-path") || ""; el.removeAttribute("clip-path"); });
    Array.from(svgEl.querySelectorAll("[filter]")).forEach(el => { el.dataset._filter = el.getAttribute("filter") || ""; el.removeAttribute("filter"); });
  }

  // Expose helpers
  Object.assign(window.__svgMapper, {
    safeKeepAuthorViewBox,
    hidePageSizedRects,
    injectSvgIntoPreview,
    forcePreviewVisibility,
    buildLayerTree,
    logSvgSnapshot,
    applyDebugReveal,
    neutralizeDefsForDebug,
    // debugSvgSafe - inspect and optionally reveal problems
    debugSvgSafe: function(svgSelector = `#${svgPreviewId} svg`) {
      const s = document.querySelector(svgSelector);
      if (!s) return console.warn("[debugSvgSafe] no svg found");
      console.log("[debugSvgSafe] viewBox:", s.getAttribute("viewBox"));
      try { console.log("[debugSvgSafe] bbox:", s.getBBox ? s.getBBox() : s.getBoundingClientRect()); } catch (e) { /*ignore*/ }
      console.log("[debugSvgSafe] top-level children:", Array.from(s.children).map(n => n.tagName + (n.id ? "#" + n.id : "")).slice(0,50));
      const rects = Array.from(s.querySelectorAll("rect"));
      console.log("[debugSvgSafe] rect count:", rects.length, "examples:", rects.slice(0,10).map(r => ({
        w: r.getAttribute("width"),
        h: r.getAttribute("height"),
        x: r.getAttribute("x"),
        y: r.getAttribute("y"),
        fill: r.getAttribute("fill"),
        opa: r.getAttribute("opacity") || getComputedStyle(r).opacity
      }))));
      const images = Array.from(s.querySelectorAll("image"));
      console.log("[debugSvgSafe] image count:", images.length, "examples:", images.slice(0,6).map(i => ({
        href: i.getAttribute("href") || i.getAttribute("xlink:href"),
        x: i.getAttribute("x"),
        y: i.getAttribute("y"),
        w: i.getAttribute("width"),
        h: i.getAttribute("height")
      }))));
      try { neutralizeDefsForDebug(s); applyDebugReveal(s); } catch (e) { console.warn("[debugSvgSafe] reveal error", e); }
      return s;
    }
  });

  /* =============================
     Auto-init wiring on DOM ready
     ============================= */
  function autoInit() {
    refreshRefs();
    attachUiHelpers();
    window.__svgMapper.init();
    console.log("SVG → HTML mapper initialized");
  }

  if (document.readyState === "complete" || document.readyState === "interactive") {
    autoInit();
  } else {
    document.addEventListener("DOMContentLoaded", autoInit);
  }

})();

const debugToggle = document.getElementById("debugToggle");

/* ======= Feature flags & tunables ======= */
const VISUAL_SCALE_THRESHOLD = 1.15; // only scale up if targetScale > this
const DESIRED_FILL = 0.70; // fraction of container to fill when scaling tiny artwork

/* ======= Small DOM helpers ======= */
function $id(id) { return document.getElementById(id); }
function el(tag, props = {}) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") e.className = v;
    else if (k === "text") e.textContent = v;
    else e.setAttribute(k, v);
  }
  return e;
}

/* ======= Theme toggle wiring ======= */
if (modeSelect) {
  modeSelect.addEventListener("change", () => {
    document.body.classList.toggle("theme-dark", modeSelect.value === "dark");
    document.body.classList.toggle("theme-light", modeSelect.value === "light");
    console.log("[UI] Theme set to", modeSelect.value);
  });
}

/* ======= Defensive presence logs ======= */
if (!svgPreview) console.warn("[Init] #svgPreview missing — preview will not render.");
if (!svgFileInput) console.warn("[Init] #svgFile input missing — upload disabled.");/* =============================
   📐 Part 2 — Numeric parsing, safe viewBox, hide canvas rects, diagnostics
   ============================= */

/* ======= Parse numeric values and common units ======= */
function parseSvgNumeric(val) {
  if (val == null) return null;
  const s = String(val).trim();
  if (s === "") return null;
  const num = parseFloat(s);
  if (!isFinite(num)) return null;
  if (s.endsWith("px")) return num;
  if (s.endsWith("mm")) return num * (96 / 25.4);
  if (s.endsWith("cm")) return num * (96 / 2.54);
  if (s.endsWith("in")) return num * 96;
  return num; // unitless -> px
}

/* ======= Keep author viewBox; remove hard width/height so CSS controls sizing ======= */
function safeKeepAuthorViewBox(svgEl) {
  if (!svgEl) return;
  const hasViewBox = svgEl.hasAttribute("viewBox");
  const rawW = svgEl.getAttribute("width");
  const rawH = svgEl.getAttribute("height");

  svgEl.removeAttribute("width");
  svgEl.removeAttribute("height");

  if (!hasViewBox) {
    const w = parseSvgNumeric(rawW);
    const h = parseSvgNumeric(rawH);
    if (w && h) {
      svgEl.setAttribute("viewBox", `0 0 ${w} ${h}`);
    } else {
      const rects = Array.from(svgEl.querySelectorAll("rect"));
      let rw = 1000, rh = 800;
      if (rects.length) {
        const largest = rects
          .map(r => ({ w: parseSvgNumeric(r.getAttribute("width")), h: parseSvgNumeric(r.getAttribute("height")) }))
          .reduce((a, b) => ((a.w||0)*(a.h||0) >= (b.w||0)*(b.h||0) ? a : b), { w: rw, h: rh });
        rw = largest.w || rw;
        rh = largest.h || rh;
      }
      svgEl.setAttribute("viewBox", `0 0 ${rw} ${rh}`);
    }
  }

  svgEl.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svgEl.style.width = "100%";
  svgEl.style.height = "auto";
}

/* ======= Hide page-sized background rects (non-destructive) ======= */
function hidePageSizedRects(svgEl) {
  if (!svgEl) return;
  const vb = svgEl.getAttribute("viewBox");
  if (!vb) return;
  const [vx, vy, vw, vh] = vb.split(/\s+/).map(parseFloat);
  Array.from(svgEl.querySelectorAll("rect")).forEach(rect => {
    const w = parseSvgNumeric(rect.getAttribute("width"));
    const h = parseSvgNumeric(rect.getAttribute("height"));
    const x = parseSvgNumeric(rect.getAttribute("x")) || 0;
    const y = parseSvgNumeric(rect.getAttribute("y")) || 0;
    const isPageSized =
      isFinite(w) && isFinite(h) &&
      Math.abs(w - vw) < 1 &&
      Math.abs(h - vh) < 1 &&
      Math.abs(x - vx) < 1 &&
      Math.abs(y - vy) < 1;
    if (isPageSized) {
      rect.style.display = "none";
      rect.dataset.__hidden_by_mapper = "true";
      console.log("[hidePageSizedRects] hid rect", { id: rect.id || null, w, h, x, y });
    }
  });
}

/* ======= Diagnostics: snapshot & bbox logs ======= */
function logSvgSnapshot(svgEl, label = "SVG") {
  if (!svgEl) return;
  const vb = svgEl.getAttribute("viewBox");
  const w = svgEl.getAttribute("width");
  const h = svgEl.getAttribute("height");
  const children = svgEl.querySelectorAll(":scope > *").length;
  const hasFO = !!svgEl.querySelector("foreignObject");
  const hasClip = !!svgEl.querySelector("clipPath, mask");
  console.log(`[Snapshot] ${label}`, { viewBox: vb, width: w, height: h, topLevelChildren: children, foreignObject: hasFO, clipOrMask: hasClip });
}
function logBounds(svgEl, label = "Bounds") {
  if (!svgEl) return;
  try {
    const bb = svgEl.getBBox();
    console.log(`[Bounds] ${label}`, { x: bb.x, y: bb.y, width: bb.width, height: bb.height });
  } catch (e) {
    console.warn(`[Bounds] ${label} getBBox failed`, e && e.message ? e.message : e);
  }
}

/* ======= Quick console-check helper (returns JSON string) ======= */
function snapshotJsonForConsole() {
  const s = document.querySelector("#svgPreview svg");
  if (!s) return JSON.stringify({ snapshot: null, bbox: null });
  let bbox;
  try { const b = s.getBBox(); bbox = { x: b.x, y: b.y, w: b.width, h: b.height }; }
  catch (e) { bbox = `getBBox failed: ${e && e.message}`; }
  return JSON.stringify({
    snapshot: { viewBox: s.getAttribute("viewBox"), width: s.getAttribute("width"), height: s.getAttribute("height"), topLevelChildren: s.querySelectorAll(":scope > *").length },
    bbox
  });	/* =============================
	   🌳 Part 3 — Group tree builder, layer toggles, tabs, debug toggle
	   ============================= */

	/* ======= Safe query within preview by id (handles escaped IDs) ======= */
	function safeQueryInPreviewById(id) {
	  if (!id || !svgPreview) return null;
	  try { return svgPreview.querySelector(`#${CSS.escape(id)}`); } catch { return svgPreview.querySelector(`[id="${id}"]`); }
	}

	/* ======= Get readable label for groups ======= */
	function getGroupLabel(g, index) {
	  return g.getAttribute("inkscape:label") || g.getAttribute("sodipodi:label") || g.getAttribute("id") || `Group ${index+1}`;
	}

	/* ======= Recursive group tree builder (DOM list) ======= */
	function buildGroupTree(containerUl, groupNodes) {
	  if (!containerUl) return;
	  containerUl.innerHTML = "";
	  groupNodes.forEach((g, i) => {
	    const li = document.createElement("li");
	    li.className = "tree-item";
	    const id = g.getAttribute("id");
	    const label = getGroupLabel(g, i);
	    const row = document.createElement("div");
	    row.className = "tree-row";

	    const childGroups = g.querySelectorAll(":scope > g");
	    let subUl = null;
	    if (childGroups.length > 0) {
	      const toggle = el("button", { class: "tree-toggle", text: "▸" });
	      toggle.setAttribute("aria-expanded", "false");
	      toggle.addEventListener("click", (ev) => {
	        ev.stopPropagation();
	        const expanded = toggle.getAttribute("aria-expanded") === "true";
	        toggle.setAttribute("aria-expanded", String(!expanded));
	        toggle.textContent = expanded ? "▸" : "▾";
	        if (subUl) subUl.classList.toggle("collapsed", expanded);
	      });
	      row.appendChild(toggle);
	    }

	    const eyeBtn = el("button", { class: "tree-eye", text: "👁️" });
	    eyeBtn.addEventListener("click", (ev) => {
	      ev.stopPropagation();
	      const target = safeQueryInPreviewById(id);
	      if (target) {
	        const hidden = target.style.display === "none";
	        target.style.display = hidden ? "" : "none";
	        eyeBtn.textContent = hidden ? "👁️" : "🚫";
	      }
	    });
	    row.appendChild(eyeBtn);

	    const labelBtn = el("button", { class: "tree-label", text: label });
	    labelBtn.title = id ? `id: ${id}` : label;
	    labelBtn.addEventListener("click", (ev) => {
	      ev.stopPropagation();
	      if (svgPreview) svgPreview.querySelectorAll(".active").forEach(el => el.classList.remove("active"));
	      const target = safeQueryInPreviewById(id);
	      if (target) target.classList.add("active");
	    });
	    row.appendChild(labelBtn);

	    li.appendChild(row);
	    if (childGroups.length > 0) {
	      subUl = document.createElement("ul");
	      subUl.className = "tree-sublist collapsed";
	      buildGroupTree(subUl, childGroups);
	      li.appendChild(subUl);
	    }
	    containerUl.appendChild(li);
	  });
	}

	/* ======= Tabs behavior (HTML/CSS/JS outputs and clear) ======= */
	(function initTabs() {
	  const tabs = document.querySelectorAll(".tab");
	  const outputs = { html: codeHtml, css: codeCss, js: codeJs };
	  if (!tabs || !tabs.length) return;
	  tabs.forEach(tab => {
	    tab.addEventListener("click", () => {
	      const target = tab.dataset.target;
	      Object.values(outputs).forEach(el => el && el.classList.add("hidden"));
	      if (target === "clear") {
	        Object.values(outputs).forEach(el => { if (el) el.textContent = ""; });
	        if (livePreview) livePreview.innerHTML = "";
	        if (svgPreview) svgPreview.querySelectorAll(".active").forEach(el => el.classList.remove("active"));
	      } else {
	        const panel = outputs[target];
	        if (panel) panel.classList.remove("hidden");
	      }
	    });
	  });
	})();

	/* ======= Debug overlay toggle wiring ======= */
	if (debugToggle) {
	  debugToggle.addEventListener("change", () => {
	    document.body.classList.toggle("debug-overlay", debugToggle.checked);
	    console.log("[UI] debug-overlay", debugToggle.checked);
	  });
	}  /* =============================
     ⚙️ Part 4 — File load, zoom, visibility helpers, export helpers, init
     ============================= */

  /* ======= Visibility / centering helper (defensive) ======= */
  function forcePreviewVisibility(svgEl, container) {
    if (!svgEl || !container) return;

    // Center visually without mutating layout structure permanently
    container.style.display = "flex";
    container.style.alignItems = "center";
    container.style.justifyContent = "center";
    container.style.background = getComputedStyle(container).backgroundColor || "#fff";
    container.style.overflow = "visible";

    // Responsive sizing
    svgEl.style.width = "100%";
    svgEl.style.height = "auto";
    svgEl.style.maxWidth = "100%";
    svgEl.style.maxHeight = "100%";
    svgEl.style.display = "block";
    svgEl.setAttribute("preserveAspectRatio", svgEl.getAttribute("preserveAspectRatio") || "xMidYMid meet");

    // Defensive resets for styles that can dim or hide SVGs
    svgEl.style.filter = "none";
    svgEl.style.opacity = "1";
    svgEl.style.mixBlendMode = "normal";

    // Gentle visual scale-up for tiny artwork (visual-only)
    try {
      const bb = svgEl.getBBox();
      const containerRect = container.getBoundingClientRect();
      const cw = containerRect.width || Math.max(window.innerWidth * 0.5, 200);
      const ch = containerRect.height || Math.max(window.innerHeight * 0.5, 200);
      const scaleX = (cw * DESIRED_FILL) / Math.max(bb.width, 1);
      const scaleY = (ch * DESIRED_FILL) / Math.max(bb.height, 1);
      const targetScale = Math.min(scaleX, scaleY);

      if (isFinite(targetScale) && targetScale > VISUAL_SCALE_THRESHOLD) {
        svgEl.style.transformOrigin = "50% 50%";
        svgEl.style.transition = "transform 160ms ease";
        svgEl.style.transform = `scale(${targetScale})`;
        console.log("[forcePreviewVisibility] applied visual scale", targetScale.toFixed(2));
      } else {
        svgEl.style.transform = "";
      }
    } catch (e) {
      svgEl.style.transform = "";
      console.warn("[forcePreviewVisibility] getBBox failed; skipped visual scale", e && e.message ? e.message : e);
    }

    // Re-apply hiding of page rects
    hidePageSizedRects(svgEl);
  }

  /* ======= Short canvas rect hidder (safe, callable) ======= */
  function hideCanvasRectShort(svgEl) {
    if (!svgEl) return;
    const vb = svgEl.getAttribute("viewBox");
    if (!vb) return;
    const [vx, vy, vw, vh] = vb.split(/\s+/).map(parseFloat);
    Array.from(svgEl.querySelectorAll("rect")).forEach(r => {
      const w = parseSvgNumeric(r.getAttribute("width") || "0");
      const h = parseSvgNumeric(r.getAttribute("height") || "0");
      const x = parseSvgNumeric(r.getAttribute("x") || "0");
      const y = parseSvgNumeric(r.getAttribute("y") || "0");
      const isPage = Number.isFinite(w) && Number.isFinite(h) &&
        Math.abs(w - vw) < 1 && Math.abs(h - vh) < 1 &&
        Math.abs(x - vx) < 1 && Math.abs(y - vy) < 1;
      if (isPage) {
        r.style.display = "none";
        console.log("[hideCanvasRectShort] hid canvas rect", { id: r.id || null });
      }
    });
  }

  /* ======= File load handler (reads text, injects SVG safely) ======= */
  if (svgFileInput) {
    svgFileInput.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const svgMarkup = ev.target.result;

        // Inject markup into preview slots
        if (svgPreview) svgPreview.innerHTML = svgMarkup;
        if (livePreview) livePreview.innerHTML = svgMarkup;
        if (codeHtml) codeHtml.textContent = svgMarkup;

        const rootSvg = svgPreview ? svgPreview.querySelector("svg") : null;
        if (!rootSvg) {
          console.warn("[load] loaded file did not contain an <svg> element.");
          return;
        }

        safeKeepAuthorViewBox(rootSvg);
        hidePageSizedRects(rootSvg);
        forcePreviewVisibility(rootSvg, svgPreview);
        logSvgSnapshot(rootSvg, "Preview (after load)");
        logBounds(rootSvg, "Preview (after load)");

        // Build layer tree from parsed doc to preserve original IDs and structure
        try {
          const parser = new DOMParser();
          const doc = parser.parseFromString(svgMarkup, "image/svg+xml");
          const topGroups = doc.querySelectorAll("svg > g");
          if (layerTree) {
            buildGroupTree(layerTree, topGroups);
          }
        } catch (err) {
          console.warn("[load] layer tree parse failed", err);
        }
      };
      reader.readAsText(file);
    });
  }

  /* ======= Zoom button behavior (reapply safe transforms) ======= */
  if (zoomBtn) {
    zoomBtn.addEventListener("click", () => {
      const svgEl = svgPreview ? svgPreview.querySelector("svg") : null;
      if (!svgEl) return;
      safeKeepAuthorViewBox(svgEl);
      hidePageSizedRects(svgEl);
      forcePreviewVisibility(svgEl, svgPreview);
      logSvgSnapshot(svgEl, "Preview (after zoom)");
      logBounds(svgEl, "Preview (after zoom)");
    });
  }

  /* ======= Simple export helper (serialize current injected svg into an <img>) ======= */
  function svgToImageElement(svgEl) {
    if (!svgEl) return null;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const svgUrl = URL.createObjectURL(svgBlob);
    const img = document.createElement("img");
    img.src = svgUrl;
    img.alt = "SVG Preview";
    return img;
  }

  /* ======= One-time init diagnostics (for dev) ======= */
  (function initDiagnosticsOnLoad() {
    window.addEventListener("load", () => {
      console.log("SVG->HTML mapper ready");
    });
  })();
}
