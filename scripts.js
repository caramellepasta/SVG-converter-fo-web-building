document.addEventListener("DOMContentLoaded", () => {
  console.log("Progressive Builder loaded");

  // 🌟 Grab references
  const svgContainer = document.getElementById("svg-preview");
  const fileInput = document.getElementById("svg-upload");
  const tagSelector = document.getElementById("tag-selector");
  const semanticTag = document.getElementById("semantic-tag");
  const applyTag = document.getElementById("apply-tag");
  const previewFrame = document.getElementById("live-preview");
  const groupListContainer = document.getElementById("group-list-container");

  const bgEnabled = document.getElementById("background-enabled");
  const bgFullscreen = document.getElementById("background-fullscreen");
  const bgRepeat = document.getElementById("background-repeat");
  const bgAbsolute = document.getElementById("background-absolute");

  const modeSelect = document.getElementById("mode-select");
  const modeLabel = document.getElementById("mode-label");

  // Code viewer toggle
  const codeOutput = document.getElementById("code-output");
  const showHTMLBtn = document.getElementById("show-html");
  const showCSSBtn = document.getElementById("show-css");

  // 🌓 Multi-mapper: keep mappings per mode
  const mappings = { light: {}, dark: {} };
  let currentMode = modeSelect.value;

  // 🔎 Selection state
  let selectedElement = null;

  // Store last generated code for toggle
  let lastHTML = "";
  let lastCSS = "";

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

    // ✅ FIX #1: Refresh outputs immediately after upload
    // This clears the code viewer and preview so they’re in sync
    regenerateOutputs();
  };
  reader.readAsText(e.target.files[0]);
});

  // 🖱️ Enable click-to-select
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

  // 📁 List SVG groups
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
      };

      groupList.appendChild(item);
    });

    groupListContainer.innerHTML = "";
    groupListContainer.appendChild(groupList);
  }

  // 🧠 Suggest semantic tag
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

  // 🧱 Apply mapping
  applyTag.addEventListener("click", () => {
    if (!selectedElement) return;

    const tag = semanticTag.value;
    const id = selectedElement.id || `el-${Date.now()}`;
    const className = id.replace(/\s+/g, "_");

    // 📝 Extract inner text
    const innerText = selectedElement.textContent?.trim() || "";

    // 🔤 Detect font-family
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

    // 🎨 Extract fill and stroke
    let fill = selectedElement.getAttribute("fill");
    let stroke = selectedElement.getAttribute("stroke");

    // Normalize black fill
    const isBlack = /^(black|#000000|#000|rgb\(\s*0\s*,\s*0\s*,\s*0\s*\))$/i;
    if (fill && isBlack.test(fill)) fill = "#ccc";

    // 📐 Size
    const bbox = selectedElement.getBBox?.();
    const width = `${bbox?.width?.toFixed(2) || "auto"}`;
    const height = `${bbox?.height?.toFixed(2) || "auto"}`;

    // 🧩 Store mapping
    mappings[currentMode][id] = {
      tag,
      className,
      text: innerText,
      font: cleanFont || "",
      fill: fill || "",
      stroke: stroke || "",
      size: { width, height },
      bg: {
        enabled: bgEnabled.checked,
        fullscreen: bgFullscreen.checked,
        repeat: bgRepeat.checked,
        absolute: bgAbsolute.checked
      }
    };

    regenerateOutputs();

    // Clear selection
    selectedElement.classList.remove("selected");
    selectedElement = null;
    tagSelector.style.display = "none";
  });

 // 🔁 Regenerate outputs
function regenerateOutputs() {
  const model = mappings[currentMode];
  let html = "";
  let css = "";
  const fontSet = new Set();

  const structural = ["header", "footer", "nav", "section", "article", "aside"];

  for (const [id, data] of Object.entries(model)) {
    const content = structural.includes(data.tag)
      ? `<p>${escapeHtml(data.text)}</p>`
      : escapeHtml(data.text);

    html += `<${data.tag} class="${data.className}">${content}</${data.tag}>\n`;

    css += `.${data.className} {\n`;
    if (data.font) {
      css += `  font-family: '${data.font}', sans-serif;\n`;
      fontSet.add(data.font);
    }
    if (data.fill) css += `  color: ${data.fill};\n`;
    if (data.stroke) css += `  border: 1px solid ${data.stroke};\n`;
    css += `  width: ${data.size.width};\n`;
    css += `  height: ${data.size.height};\n`;

    if (data.bg?.enabled) {
      css += `  background-color: ${data.fill || "#f0f0f0"};\n`;
      css += `  background-repeat: ${data.bg.repeat ? "repeat" : "no-repeat"};\n`;
      if (data.bg.fullscreen) {
        css += `  width: 100vw;\n  height: 100vh;\n`;
      }
      if (data.bg.absolute) {
        css += `  position: absolute;\n  z-index: -1;\n`;
      }
    }
    css += `}\n\n`;
  }

  lastHTML = html.trim();
  lastCSS = css.trim();

  // ✅ FIX #2: Enable/disable toggle buttons depending on content
  showHTMLBtn.disabled = !lastHTML;
  showCSSBtn.disabled = !lastCSS;

  // Default to HTML view
  codeOutput.value = lastHTML;

  updatePreview(html, css, Array.from(fontSet));
}
  // 🌐 Update live preview
  function updatePreview(html, css, fonts = []) {
    const previewDoc = previewFrame.contentDocument || previewFrame.contentWindow.document;

    // Build unique Google Font links
    const fontLinks = fonts
      .filter(Boolean)
      .map(f => `<link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(f).replace(/%20/g, "+")}&display=swap" rel="stylesheet">`)
      .join("\n");

    // Build the combined HTML for the iframe
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

    // Inject into iframe
    previewDoc.open();
    previewDoc.write(combinedHTML);
    previewDoc.close();
  }

  // 🌓 Mode switching: regenerate outputs when mode changes
  modeSelect.addEventListener("change", () => {
    currentMode = modeSelect.value;
    modeLabel.textContent = currentMode.charAt(0).toUpperCase() + currentMode.slice(1);
    regenerateOutputs();
  });

  // 🧾 Code viewer toggle buttons
  showHTMLBtn.addEventListener("click", () => {
    codeOutput.value = lastHTML;
    showHTMLBtn.classList.add("active");
    showCSSBtn.classList.remove("active");
  });

  showCSSBtn.addEventListener("click", () => {
    codeOutput.value = lastCSS;
    showCSSBtn.classList.add("active");
    showHTMLBtn.classList.remove("active");
  });

  // 🛡️ Helper: escape HTML entities for safe injection
  function escapeHtml(str) {
    return (str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
});
