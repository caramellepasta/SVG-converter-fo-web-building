document.addEventListener("DOMContentLoaded", () => {
  console.log("Progressive Builder loaded");

  // 🌟 Grab references
  const svgContainer = document.getElementById("svg-preview");
  const fileInput = document.getElementById("svg-upload");
  const tagSelector = document.getElementById("tag-selector");
  const semanticTag = document.getElementById("semantic-tag");
  const applyTag = document.getElementById("apply-tag");
  const codeOutput = document.getElementById("code-output");
  const cssOutput = document.getElementById("css-output");
  const previewFrame = document.getElementById("live-preview");
  const groupListContainer = document.getElementById("group-list-container");

  const bgEnabled = document.getElementById("background-enabled");
  const bgFullscreen = document.getElementById("background-fullscreen");
  const bgRepeat = document.getElementById("background-repeat");
  const bgAbsolute = document.getElementById("background-absolute");

  const modeSelect = document.getElementById("mode-select");
  const modeLabel = document.getElementById("mode-label");

  // 🌓 Multi-mapper: keep mappings per mode
  const mappings = {
    light: {}, // { elementId: { tag, text, font, fill, styles } }
    dark: {}
  };
  let currentMode = modeSelect.value;

  // 🔎 Selection state
  let selectedElement = null;

  // 📂 Load and preview SVG
  fileInput.addEventListener("change", (e) => {
    const reader = new FileReader();
    reader.onload = () => {
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(reader.result, "image/svg+xml");
      const svgRoot = svgDoc.querySelector("svg");

      svgContainer.innerHTML = "";
      svgContainer.appendChild(svgRoot);

      enableSelection(svgRoot);
      scanGroups(svgRoot);
    };
    reader.readAsText(e.target.files[0]);
  });

  // 🖱️ Enable click-to-select (adds a red outline)
  function enableSelection(container) {
    const elements = container.querySelectorAll("*");
    elements.forEach(el => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        if (selectedElement) selectedElement.classList.remove("selected");
        selectedElement = el;
        el.classList.add("selected");
        tagSelector.style.display = "block";
        suggestTag(el);
      });
    });
  }

  // 📁 List SVG groups for quick selection
  function scanGroups(svgRoot) {
    const groups = svgRoot.querySelectorAll("g");
    const groupList = document.createElement("ul");
    groupList.innerHTML = "<h3>SVG Groups</h3>";

    groups.forEach((group, i) => {
      const label = group.id || group.classList[0] || `Group ${i + 1}`;
      const item = document.createElement("li");
      item.textContent = label;
      item.style.cursor = "pointer";

      item.onclick = () => {
        if (selectedElement) selectedElement.classList.remove("selected");
        selectedElement = group;
        group.classList.add("selected");
        tagSelector.style.display = "block";
        suggestTag(group);
        // Scroll into view for convenience
        group.scrollIntoView({ behavior: "smooth", block: "center" });
      };

      groupList.appendChild(item);
    });

    groupListContainer.innerHTML = "";
    groupListContainer.appendChild(groupList);
  }

  // 🧠 Suggest a semantic tag based on heuristics
  function suggestTag(el) {
    const id = el.id?.toLowerCase() || "";
    const bbox = el.getBBox?.();
    const fill = el.getAttribute("fill");
    const width = bbox?.width || 0;
    const height = bbox?.height || 0;

    let suggestion = "section";
    if (id.includes("nav")) suggestion = "nav";
    else if (id.includes("footer")) suggestion = "footer";
    else if (id.includes("header")) suggestion = "header";
    else if (id.includes("hero")) suggestion = "section";
    else if (id.includes("button")) suggestion = "button";
    else if (el.tagName === "text") suggestion = "h1";

    if (!id && fill === "red" && height < 60 && width > 300) {
      suggestion = "nav";
    } else if (!id && height > 100 && width > 300) {
      suggestion = "header";
    }

    semanticTag.value = suggestion;
  }

  // 🧱 Apply mapping (progressive builder)
  applyTag.addEventListener("click", () => {
    if (!selectedElement) return;

    const tag = semanticTag.value;
    const id = selectedElement.id || `el-${Date.now()}`;
    const className = id.replace(/\s+/g, "_");

    // 📝 Extract inner text
    const innerText = selectedElement.textContent?.trim() || "";

    // 🔤 Detect font-family (from attribute or style)
    let fontFamily = selectedElement.getAttribute("font-family");
    if (!fontFamily && selectedElement.hasAttribute("style")) {
      const style = selectedElement.getAttribute("style");
      const matchFamily = style.match(/font-family:\s*['"]?([^;"']+)/);
      if (matchFamily) fontFamily = matchFamily[1];
      if (!fontFamily) {
        const matchFont = style.match(/font:\s*[^;]*\s([^;"']+)/);
        if (matchFont) fontFamily = matchFont[1];
      }
    }
    const cleanFont = fontFamily ? fontFamily.replace(/['"]/g, "").split(",")[0].trim() : "";

    // 🎨 Extract fill color (fallback to child fills)
    let fill = selectedElement.getAttribute("fill");
    if (!fill && selectedElement.hasAttribute("style")) {
      const match = selectedElement.getAttribute("style").match(/fill:\s*(#[0-9a-fA-F]{3,6}|rgba?\([^)]+\)|black|rgb\(\s*0\s*,\s*0\s*,\s*0\s*\))/i);
      if (match) fill = match[1];
    }
    if (!fill && selectedElement.children?.length > 0) {
      for (let child of selectedElement.children) {
        let childFill = child.getAttribute("fill");
        if (!childFill && child.hasAttribute("style")) {
          const match = child.getAttribute("style").match(/fill:\s*(#[0-9a-fA-F]{3,6}|rgba?\([^)]+\)|black|rgb\(\s*0\s*,\s*0\s*,\s*0\s*\))/i);
          if (match) childFill = match[1];
        }
        if (childFill && childFill !== "none") {
          fill = childFill;
          break;
        }
      }
    }
    // Normalize "pure black" fills (avoid invisible text on dark BGs)
    const isBlack = /^(black|#000000|#000|rgb\(\s*0\s*,\s*0\s*,\s*0\s*\))$/i;
    if (fill && isBlack.test(fill)) fill = "#ccc";

    // 📐 Sizing (optional, used when background is enabled)
    const bbox = selectedElement.getBBox?.();
    const width = `${bbox?.width?.toFixed(2) || "auto"}`;
    const height = `${bbox?.height?.toFixed(2) || "auto"}`;

    // 🧩 Store/update mapping for current mode and element
    mappings[currentMode][id] = {
      tag,
      className,
      text: innerText,
      font: cleanFont || "",
      fill: fill || "",
      size: { width, height },
      bg: {
        enabled: bgEnabled.checked,
        fullscreen: bgFullscreen.checked,
        repeat: bgRepeat.checked,
        absolute: bgAbsolute.checked
      }
    };

    // 🔁 Regenerate outputs for the current mode
    regenerateOutputs();
    // ✅ Clear selection UI state
    selectedElement.classList.remove("selected");
    selectedElement = null;
    tagSelector.style.display = "none";
  });

  // 🔁 Regenerate HTML + CSS from model for the current mode
  function regenerateOutputs() {
    const model = mappings[currentMode];
    let html = "";
    let css = "";
    const fontSet = new Set();

    const structural = ["header", "footer", "nav", "section", "article", "aside"];

    for (const [id, data] of Object.entries(model)) {
      // ✅ Build HTML (wrap text for structural tags so content shows)
      const content = structural.includes(data.tag)
        ? `<p>${escapeHtml(data.text)}</p>`
        : escapeHtml(data.text);

      html += `<${data.tag} class="${data.className}">${content}</${data.tag}>\n`;

      // ✅ Build CSS (apply font only to the class, not globally)
      css += `.${data.className} {\n`;
      if (data.font) {
        css += `  font-family: '${data.font}', sans-serif;\n`;
        fontSet.add(data.font);
      }
      if (data.fill) {
        // Use fill as text color; background optional
        css += `  color: ${data.fill};\n`;
      }
      if (data.bg?.enabled) {
        // Basic background styling derived from fill
        css += `  background-color: ${data.fill || "#f0f0f0"};\n`;
        css += `  background-repeat: ${data.bg.repeat ? "repeat" : "no-repeat"};\n`;
        if (data.bg.fullscreen) {
          css += `  width: 100vw;\n  height: 100vh;\n`;
        } else {
          css += `  width: ${data.size.width};\n  height: ${data.size.height};\n`;
        }
        if (data.bg.absolute) {
          css += `  position: absolute;\n  z-index: -1;\n`;
        }
      }
      css += `}\n\n`;
    }

    // 🧾 Update textareas
    codeOutput.value = html.trim();
    cssOutput.value = css.trim();

    // 🌐 Update live preview (inject unique font links and scoped CSS)
    updatePreview(html, css, Array.from(fontSet));
  }

  // 🌐 Live preview: build full HTML doc and inject into iframe
  function updatePreview(html, css, fonts = []) {
    const previewDoc = previewFrame.contentDocument || previewFrame.contentWindow.document;

    // Build unique Google Font links
    const fontLinks = fonts
      .filter(Boolean)
      .map(f => `<link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(f).replace(/%20/g, "+")}&display=swap" rel="stylesheet">`)
      .join("\n");

    const combinedHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Live Preview</title>
  ${fontLinks}
  <style>
    /* Reset preview defaults for clarity */
    body { margin: 1rem; font-family: sans-serif; }
    ${css}
  </style>
</head>
<body>
${html}
</body>
</html>`;

    previewDoc.open();
    previewDoc.write(combinedHTML);
    previewDoc.close();
  }

  // 🌓 Mode switching: preserve mappings per mode and regenerate
  modeSelect.addEventListener("change", () => {
    currentMode = modeSelect.value;
    modeLabel.textContent = currentMode.charAt(0).toUpperCase() + currentMode.slice(1);
    regenerateOutputs();
  });

  // 📋 Copy buttons
  document.getElementById("copy-html").addEventListener("click", () => {
    navigator.clipboard.writeText(codeOutput.value);
  });
  document.getElementById("copy-css").addEventListener("click", () => {
    navigator.clipboard.writeText(cssOutput.value);
  });

  // 🛡️ Helper: basic HTML escape for text injection safety
  function escapeHtml(str) {
    return (str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
});
