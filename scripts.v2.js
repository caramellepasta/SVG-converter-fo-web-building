/* clean scripts.v2.js - minimal, no debug, no comments */
(function(){
  "use strict";

  var svgPreviewId = "svgPreview";
  var svgFileId = "svgFile";
  var livePreviewId = "livePreview";
  var codeHtmlId = "code-html";
  var codeCssId = "code-css";
  var codeJsId = "code-js";
  var layerTreeId = "layerTree";
  var zoomBtnId = "zoomToFit";
  var modeSelectId = "modeSelect";
  var debugToggleId = "debugToggle";

  var svgFileInput = null;
  var svgPreview = null;
  var livePreview = null;
  var codeHtml = null;
  var codeCss = null;
  var codeJs = null;
  var layerTree = null;
  var zoomBtn = null;
  var modeSelect = null;
  var debugToggle = null;

  var VISUAL_SCALE_THRESHOLD = 1.15;
  var DESIRED_FILL = 0.72;

  function qs(id){ return document.getElementById(id); }

  function el(tag, props){
    props = props || {};
    var e = document.createElement(tag);
    Object.keys(props).forEach(function(k){
      var v = props[k];
      if(k === "class") e.className = v;
      else if(k === "text") e.textContent = v;
      else e.setAttribute(k, v);
    });
    return e;
  }

  function parseSvgNumeric(val){
    if(val == null) return null;
    var s = String(val).trim();
    if(s === "") return null;
    var n = parseFloat(s);
    if(!isFinite(n)) return null;
    if(s.slice(-2) === "px") return n;
    if(s.slice(-2) === "mm") return n * (96 / 25.4);
    if(s.slice(-2) === "cm") return n * (96 / 2.54);
    if(s.slice(-2) === "in") return n * 96;
    return n;
  }

  function safeQueryInPreviewById(id){
    if(!id || !svgPreview) return null;
    try { return svgPreview.querySelector("#" + CSS.escape(id)); }
    catch(e) { return svgPreview.querySelector('[id="' + id + '"]'); }
  }

  function safeKeepAuthorViewBox(svgEl){
    if(!svgEl) return;
    var hasVB = svgEl.hasAttribute("viewBox");
    var rawW = svgEl.getAttribute("width");
    var rawH = svgEl.getAttribute("height");
    if(rawW) svgEl.removeAttribute("width");
    if(rawH) svgEl.removeAttribute("height");
    if(!hasVB){
      var w = parseSvgNumeric(rawW);
      var h = parseSvgNumeric(rawH);
      if(w && h){
        svgEl.setAttribute("viewBox", "0 0 " + w + " " + h);
      } else {
        var rects = Array.from(svgEl.querySelectorAll("rect"));
        if(rects.length){
          var largest = rects.map(function(r){
            return { w: parseSvgNumeric(r.getAttribute("width")), h: parseSvgNumeric(r.getAttribute("height")) };
          }).reduce(function(a,b){
            return ((a.w||0)*(a.h||0) >= (b.w||0)*(b.h||0) ? a : b);
          }, { w: 800, h: 600 });
          svgEl.setAttribute("viewBox", "0 0 " + (largest.w || 800) + " " + (largest.h || 600));
        }
      }
    }
    svgEl.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svgEl.style.width = "100%";
    svgEl.style.height = "auto";
    svgEl.style.display = "block";
  }

  function hidePageSizedRects(svgEl){
    if(!svgEl) return;
    var vb = svgEl.getAttribute("viewBox");
    if(!vb) return;
    var parts = vb.split(/\s+/).map(parseFloat);
    if(!parts.every(function(n){ return isFinite(n); })) return;
    var vx = parts[0], vy = parts[1], vw = parts[2], vh = parts[3];
    Array.from(svgEl.querySelectorAll("rect")).forEach(function(rect){
      var rw = parseSvgNumeric(rect.getAttribute("width"));
      var rh = parseSvgNumeric(rect.getAttribute("height"));
      var rx = parseSvgNumeric(rect.getAttribute("x")) || 0;
      var ry = parseSvgNumeric(rect.getAttribute("y")) || 0;
      var opa = parseFloat(rect.getAttribute("opacity") || getComputedStyle(rect).opacity || 1);
      var covers = !isNaN(rw) && !isNaN(rh) &&
                   Math.abs(rw - vw) < 1 && Math.abs(rh - vh) < 1 &&
                   Math.abs(rx - vx) < 1 && Math.abs(ry - vy) < 1;
      if(covers && opa >= 0.99){
        rect.style.display = "none";
        rect.dataset.__hidden_by_mapper = "true";
      }
    });
  }

  function injectSvgIntoPreview(svgEl){
    if(!svgPreview) return;
    var wrapper = svgPreview.querySelector(".svg-wrapper");
    if(!wrapper){
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

  function forcePreviewVisibility(svgEl, container){
    if(!svgEl || !container) return;
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
      var bb = svgEl.getBBox();
      var containerRect = container.getBoundingClientRect();
      var cw = containerRect.width || Math.max(window.innerWidth * 0.5, 200);
      var ch = containerRect.height || Math.max(window.innerHeight * 0.5, 200);
      var scaleX = (cw * DESIRED_FILL) / Math.max(bb.width, 1);
      var scaleY = (ch * DESIRED_FILL) / Math.max(bb.height, 1);
      var targetScale = Math.min(scaleX, scaleY);
      if(isFinite(targetScale) && targetScale > VISUAL_SCALE_THRESHOLD){
        svgEl.style.transformOrigin = "50% 50%";
        svgEl.style.transition = "transform 160ms ease";
        svgEl.style.transform = "scale(" + targetScale + ")";
      }
    } catch(e){}
    hidePageSizedRects(svgEl);
  }

  function getGroupLabel(g, idx){
    return g.getAttribute("inkscape:label") || g.getAttribute("sodipodi:label") || g.getAttribute("data-name") || g.id || ("group-" + (idx+1));
  }

  function buildLayerTree(svgEl){
    if(!layerTree || !svgEl) return;
    layerTree.innerHTML = "";
    var topGroups = Array.from(svgEl.children).filter(function(n){ return n.tagName && n.tagName.toLowerCase() === "g"; });
    if(topGroups.length === 0){
      var li = document.createElement("li");
      li.textContent = "No groups found";
      layerTree.appendChild(li);
      return;
    }
    function makeList(groups, container){
      groups.forEach(function(g, idx){
        var li = document.createElement("li");
        li.className = "tree-item";
        var row = document.createElement("div");
        row.className = "tree-row";
        var childGroups = Array.from(g.children).filter(function(c){ return c.tagName && c.tagName.toLowerCase() === "g"; });
        if(childGroups.length > 0){
          var toggle = el("button", { class: "tree-toggle", text: "▾" });
          toggle.type = "button";
          toggle.addEventListener("click", function(ev){
            ev.stopPropagation();
            var sub = li.querySelector(".tree-sublist");
            if(sub) sub.classList.toggle("collapsed");
            toggle.textContent = sub && sub.classList.contains("collapsed") ? "▸" : "▾";
          });
          row.appendChild(toggle);
        } else {
          var spacer = document.createElement("span");
          spacer.style.width = "18px";
          row.appendChild(spacer);
        }
        var hidden = (g.getAttribute("display") === "none" || g.style.display === "none");
        var eye = el("button", { class: "tree-eye", text: hidden ? "🚫" : "👁️" });
        eye.type = "button";
        eye.addEventListener("click", function(ev){
          ev.stopPropagation();
          var isHidden = (g.getAttribute("display") === "none" || g.style.display === "none");
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
        var labelBtn = el("button", { class: "tree-label", text: getGroupLabel(g, idx) });
        labelBtn.type = "button";
        labelBtn.title = g.id || "";
        labelBtn.addEventListener("click", function(ev){
          ev.stopPropagation();
          if(svgPreview) Array.from(svgPreview.querySelectorAll(".active")).forEach(function(a){ a.classList.remove("active"); });
          g.classList.add("active");
          injectSvgIntoPreview(svgEl.ownerSVGElement || svgEl);
        });
        row.appendChild(labelBtn);
        li.appendChild(row);
        if(childGroups.length > 0){
          var subUl = document.createElement("ul");
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
    var tabs = document.querySelectorAll(".tab");
    var outputs = { html: codeHtml, css: codeCss, js: codeJs };
    if(!tabs || !tabs.length) return;
    Array.prototype.forEach.call(tabs, function(tab){
      tab.addEventListener("click", function(){
        var target = tab.dataset.target;
        Object.keys(outputs).forEach(function(k){ var el = outputs[k]; if(el) el.classList.add("hidden"); });
        if(target === "clear"){
          Object.keys(outputs).forEach(function(k){ var el = outputs[k]; if(el) el.textContent = ""; });
          if(livePreview) livePreview.innerHTML = "";
          if(svgPreview) Array.prototype.forEach.call(svgPreview.querySelectorAll(".active"), function(a){ a.classList.remove("active"); });
        } else {
          var panel = outputs[target];
          if(panel) panel.classList.remove("hidden");
        }
      });
    });
    if(debugToggle){
      debugToggle.addEventListener("change", function(){ document.body.classList.toggle("debug-overlay", debugToggle.checked); });
    }
    if(modeSelect){
      modeSelect.addEventListener("change", function(){
        document.body.classList.toggle("theme-dark", modeSelect.value === "dark");
        document.body.classList.toggle("theme-light", modeSelect.value === "light");
      });
    }
  }

  function parseAndInjectSvgString(svgString){
    var parser = new DOMParser();
    var doc = parser.parseFromString(svgString, "image/svg+xml");
    var svgEl = doc.documentElement;
    if(!svgEl || svgEl.tagName.toLowerCase() !== "svg"){
      svgEl = doc.querySelector("svg");
      if(!svgEl) return { error: "no-svg" };
    }
    svgEl = svgEl.cloneNode(true);
    safeKeepAuthorViewBox(svgEl);
    hidePageSizedRects(svgEl);
    injectSvgIntoPreview(svgEl);
    forcePreviewVisibility(svgEl, svgPreview);
    buildLayerTree(svgEl);
    return { svgEl: svgEl };
  }

  function installHandlerOn(inputEl){
    if(!inputEl) return false;
    if(inputEl._mapperHandler){
      try { inputEl.removeEventListener("change", inputEl._mapperHandler); } catch(e) {}
      inputEl._mapperHandler = null;
    }
    var handler = function(ev){
      var file = ev.target && ev.target.files && ev.target.files[0];
      if(!file) return;
      var reader = new FileReader();
      reader.onerror = function(err){};
      reader.onload = function(e){
        var txt = e.target.result || "";
        if(livePreview) livePreview.innerText = txt;
        if(codeHtml) codeHtml.textContent = txt;
        var result = parseAndInjectSvgString(txt);
        return result;
      };
      reader.readAsText(file);
    };
    inputEl._mapperHandler = handler;
    inputEl.addEventListener("change", handler);
    return true;
  }

  function waitAndInstall(timeoutMs){
    timeoutMs = timeoutMs || 3000;
    return new Promise(function(resolve){
      var now = document.getElementById(svgFileId);
      if(now) return resolve(installHandlerOn(now));
      var obs = new MutationObserver(function(mutations, o){
        var el = document.getElementById(svgFileId);
        if(el){
          try { o.disconnect(); } catch(_) {}
          return resolve(installHandlerOn(el));
        }
      });
      try { obs.observe(document.documentElement || document.body, { childList: true, subtree: true }); } catch(_) {}
      setTimeout(function(){ try { obs.disconnect(); } catch(_) {} ; resolve(!!document.getElementById(svgFileId)); }, timeoutMs);
    });
  }

  window.__svgMapper = window.__svgMapper || {};
  window.__svgMapper.init = window.__svgMapper.init || function(){
    waitAndInstall().then(function(ok){
      refreshRefs();
    });
  };

  function refreshRefs(){
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

  function attachUiHelpers(){
    refreshRefs();
    initTabsAndUi();
    if(zoomBtn){
      try { zoomBtn.removeEventListener("click", zoomBtn._mapperZoom); } catch(e) {}
      zoomBtn._mapperZoom = function(){
        var svgEl = svgPreview ? svgPreview.querySelector("svg") : null;
        if(!svgEl) return;
        safeKeepAuthorViewBox(svgEl);
        hidePageSizedRects(svgEl);
        forcePreviewVisibility(svgEl, svgPreview);
      };
      zoomBtn.addEventListener("click", zoomBtn._mapperZoom);
    }
  }

  function logSvgSnapshot(svgEl, label){
    if(!svgEl) return;
    label = label || "SVG";
    var vb = svgEl.getAttribute("viewBox");
    var children = svgEl.querySelectorAll(":scope > *").length;
    var hasFO = !!svgEl.querySelector("foreignObject");
  }

  function applyDebugReveal(svgEl){
    if(!svgEl) return;
    Array.from(svgEl.querySelectorAll("*")).forEach(function(el){
      try {
        var tag = (el.tagName || "").toLowerCase();
        var skip = ["defs","lineargradient","radialgradient","pattern","mask","clippath","filter","metadata","desc","title"];
        if(skip.indexOf(tag) !== -1) return;
        if(!el.getAttribute("fill") || el.getAttribute("fill") === "none") el.setAttribute("fill", "magenta");
        if(!el.getAttribute("stroke") || el.getAttribute("stroke") === "none") el.setAttribute("stroke", "black");
        el.setAttribute("opacity", "1");
      } catch(e){}
    });
  }

  function neutralizeDefsForDebug(svgEl){
    if(!svgEl) return;
    Array.from(svgEl.querySelectorAll("[mask]")).forEach(function(el){ el.dataset._mask = el.getAttribute("mask") || ""; el.removeAttribute("mask"); });
    Array.from(svgEl.querySelectorAll("[clip-path]")).forEach(function(el){ el.dataset._clip = el.getAttribute("clip-path") || ""; el.removeAttribute("clip-path"); });
    Array.from(svgEl.querySelectorAll("[filter]")).forEach(function(el){ el.dataset._filter = el.getAttribute("filter") || ""; el.removeAttribute("filter"); });
  }

  Object.assign(window.__svgMapper, {
    safeKeepAuthorViewBox: safeKeepAuthorViewBox,
    hidePageSizedRects: hidePageSizedRects,
    injectSvgIntoPreview: injectSvgIntoPreview,
    forcePreviewVisibility: forcePreviewVisibility,
    buildLayerTree: buildLayerTree,
    logSvgSnapshot: logSvgSnapshot,
    applyDebugReveal: applyDebugReveal,
    neutralizeDefsForDebug: neutralizeDefsForDebug
  });

  function autoInit(){
    refreshRefs();
    attachUiHelpers();
    window.__svgMapper.init();
  }

  if(document.readyState === "complete" || document.readyState === "interactive"){
    autoInit();
  } else {
    document.addEventListener("DOMContentLoaded", autoInit);
  }

})();
