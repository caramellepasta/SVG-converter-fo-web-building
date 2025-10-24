// 🌟 Grab references to key HTML elements
const svgContainer = document.getElementById("svg-preview");
const fileInput = document.getElementById("svg-upload");
const tagSelector = document.getElementById("tag-selector");
const semanticTag = document.getElementById("semantic-tag");
const applyTag = document.getElementById("apply-tag");
const codeOutput = document.getElementById("code-output");
const cssOutput = document.getElementById("css-output");
const backgroundToggle = document.getElementById("background-toggle");
const fullWidthToggle = document.getElementById("full-width-toggle");

let selectedElement = null;

// 📂 Handle SVG file upload and preview
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

// 🖱️ Enable click-to-select on all SVG elements
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

// 🧱 Apply selected tag and generate HTML + CSS
applyTag.addEventListener("click", () => {
  if (!selectedElement) return;

  const tag = semanticTag.value;
  const id = selectedElement.id || "svg-part";
  const className = id.replace(/\s+/g, "_");

  // 🔹 Generate HTML
  const html = `<${tag} class="${className}"></${tag}>`;

// 🔹 Extract fill color
let fill = selectedElement.getAttribute("fill");

// If no fill, check inline style
if (!fill && selectedElement.hasAttribute("style")) {
  const style = selectedElement.getAttribute("style");
  const match = style.match(/fill:\s*(#[0-9a-fA-F]{3,6}|rgba?\([^)]+\))/);
  if (match) fill = match[1];
}

// If still no fill, check children
if (!fill && selectedElement.children?.length > 0) {
  for (let child of selectedElement.children) {
    fill = child.getAttribute("fill");

    // Check child's style too
    if (!fill && child.hasAttribute("style")) {
      const style = child.getAttribute("style");
      const match = style.match(/fill:\s*(#[0-9a-fA-F]{3,6}|rgba?\([^)]+\))/);
      if (match) {
        fill = match[1];
        break;
      }
    }

    if (fill) break;
  }
}

fill = fill || "#ccc"; // Final fallback

  // 🔹 Extract size
  const bbox = selectedElement.getBBox?.();
  const width = fullWidthToggle.checked ? "100vw" : `${bbox?.width?.toFixed(2) || "100%"}`;
  const height = `${bbox?.height?.toFixed(2) || "auto"}`;

  // 🔹 Generate CSS
  let css = `.${className} {\n  background: ${fill};\n  width: ${width};\n  height: ${height};`;
  if (backgroundToggle.checked) {
    css += `\n  position: absolute;\n  z-index: -1;`;
  }
  css += `\n}\n`;

  // 🔹 Output to textareas
  codeOutput.value += html + "\n\n";
  cssOutput.value += css + "\n";

  // 🔄 Reset selection
  selectedElement.classList.remove("selected");
  selectedElement = null;
  tagSelector.style.display = "none";
});

// 📁 Scan all <g> groups in SVG and list them like folders
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

// 🧠 Suggest semantic HTML tag based on shape, size, and color
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
