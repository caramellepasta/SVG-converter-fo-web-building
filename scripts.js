document.addEventListener("DOMContentLoaded", () => {
  // 🌟 Grab references to key elements
  const svgContainer = document.getElementById("svg-preview");
  const fileInput = document.getElementById("svg-upload");
  const tagSelector = document.getElementById("tag-selector");
  const semanticTag = document.getElementById("semantic-tag");
  const applyTag = document.getElementById("apply-tag");
  const codeOutput = document.getElementById("code-output");
  const cssOutput = document.getElementById("css-output");
  const previewFrame = document.getElementById("live-preview");

  const bgEnabled = document.getElementById("background-enabled");
  const bgFullscreen = document.getElementById("background-fullscreen");
  const bgRepeat = document.getElementById("background-repeat");
  const bgAbsolute = document.getElementById("background-absolute");
  const useSvgSource = document.getElementById("use-svg-source");

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

  // 🧱 Generate HTML + CSS
  applyTag.addEventListener("click", () => {
    if (!selectedElement) return;

    const tag = semanticTag.value;
    const id = selectedElement.id || "svg-part";
    const className = id.replace(/\s+/g, "_");
// 📝 Extract inner text content from SVG element
const innerText = selectedElement.textContent?.trim() || "";
const html = `<${tag} class="${className}">${innerText}</${tag}>`;
// 🔤 Detect font-family from SVG element
let fontFamily = selectedElement.getAttribute("font-family");

if (!fontFamily && selectedElement.hasAttribute("style")) {
  const style = selectedElement.getAttribute("style");

  // Match font-family directly
  const matchFamily = style.match(/font-family:\s*['"]?([^;"']+)/);
  if (matchFamily) fontFamily = matchFamily[1];

  // Match shorthand font declaration
  if (!fontFamily) {
    const matchFont = style.match(/font:\s*[^;]*\s([^;"']+)/);
    if (matchFont) fontFamily = matchFont[1];
  }
}

// 🧩 Prepare Google Fonts link if applicable
let fontLink = "";
if (fontFamily) {
  const googleFont = fontFamily.replace(/\s+/g, "+");
  fontLink = `<link href="https://fonts.googleapis.com/css2?family=${googleFont}&display=swap" rel="stylesheet">`;
}}

    // 🎨 Extract fill color
    let fill = selectedElement.getAttribute("fill");
    if (!fill && selectedElement.hasAttribute("style")) {
      const match = selectedElement.getAttribute("style").match(/fill:\s*(#[0-9a-fA-F]{3,6}|rgba?\([^)]+\))/);
      if (match) fill = match[1];
    }
    if (!fill && selectedElement.children?.length > 0) {
      for (let child of selectedElement.children) {
        let childFill = child.getAttribute("fill");
        if (!childFill && child.hasAttribute("style")) {
          const match = child.getAttribute("style").match(/fill:\s*(#[0-9a-fA-F]{3,6}|rgba?\([^)]+\))/);
          if (match) childFill = match[1];
        }
        if (childFill && childFill !== "none") {
          fill = childFill;
          break;
        }
      }
    }
if (fill === "black" || fill === "#000" || fill === "#000000") {
  fill = "#ccc"; // or any default you prefer
}
    // 📐 Extract size
    const bbox = selectedElement.getBBox?.();
    const width = `${bbox?.width?.toFixed(2) || "100%"}`;
    const height = `${bbox?.height?.toFixed(2) || "auto"}`;

    // 🎨 Build CSS
    let css = `.${className} {`;
    if (bgEnabled.checked) {
      css += `\n  background-color: ${fill};`;
      css += `\n  background-repeat: ${bgRepeat.checked ? "repeat" : "no-repeat"};`;
      css += bgFullscreen.checked
        ? `\n  width: 100vw;\n  height: 100vh;`
        : `\n  width: ${width};\n  height: ${height};`;
      if (bgAbsolute.checked) {
        css += `\n  position: absolute;\n  z-index: -1;`;
      }
    } else {
      css += `\n  background: ${fill};`;
      css += `\n  width: ${width};\n  height: ${height};`;
    }
    css += `\n}\n`;

    // 🧾 Output HTML + CSS
    codeOutput.value += html + "\n\n";
    cssOutput.value += css + "\n";

    // 🌐 Inject live preview
    const previewDoc = previewFrame.contentDocument || previewFrame.contentWindow.document;
const combinedHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Live Preview</title>
  ${fontLink}
  <style>
    body {
      font-family: ${fontFamily || "sans-serif"};
    }
    ${cssOutput.value}
  </style>
</head>
<body>
  ${codeOutput.value}
</body>
</html>`;
    previewDoc.open();
    previewDoc.write(combinedHTML);
    previewDoc.close();

    selectedElement.classList.remove("selected");
    selectedElement = null;
    tagSelector.style.display = "none";
  });

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

    document.body.appendChild(groupList);
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
});
