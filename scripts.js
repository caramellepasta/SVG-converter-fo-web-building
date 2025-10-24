// 🌟 Grab references to key HTML elements
const svgContainer = document.getElementById("svg-preview");
const fileInput = document.getElementById("svg-upload");
const tagSelector = document.getElementById("tag-selector");
const semanticTag = document.getElementById("semantic-tag");
const applyTag = document.getElementById("apply-tag");
const codeOutput = document.getElementById("code-output");
const useSvgSource = document.getElementById("use-svg-source");
const cssOutput = document.getElementById("css-output"); // 🧵 CSS output box
const backgroundToggle = document.getElementById("background-toggle");
const fullWidthToggle = document.getElementById("full-width-toggle");

// 🖱️ Track which SVG element is currently selected
let selectedElement = null;

// 📂 Handle SVG file upload and preview
fileInput.addEventListener("change", (e) => {
  const reader = new FileReader();

  // 🧠 When the file is loaded, inject SVG and activate selection + group scanning
  reader.onload = () => {
    svgContainer.innerHTML = reader.result;
    const svgRoot = svgContainer.querySelector("svg");
    enableSelection(svgRoot);   // 🔍 Allow clicking on SVG elements
    scanGroups(svgRoot);        // 📁 List all <g> groups as folders
  };

  reader.readAsText(e.target.files[0]); // 📖 Read SVG file as text
});

// 🖱️ Enable click-to-select on all SVG elements
function enableSelection(container) {
  const elements = container.querySelectorAll("*");

  elements.forEach(el => {
    el.addEventListener("click", (e) => {
      e.stopPropagation(); // 🚫 Prevent bubbling to parent elements

      // 🔄 Remove previous selection
      if (selectedElement) selectedElement.classList.remove("selected");

      // ✅ Mark new selection
      selectedElement = el;
      el.classList.add("selected");

      // 🧠 Show tag selector and suggest semantic tag
      tagSelector.style.display = "block";
      suggestTag(el);
    });
  });
}

// 🧱 Apply selected tag and generate HTML output
applyTag.addEventListener("click", () => {
  if (!selectedElement) return;

  const tag = semanticTag.value;
  const id = selectedElement.id || "svg-part";
  const className = id.replace(/\s+/g, "_");

  // 🔹 Generate HTML
  const html = `<${tag} class="${className}"></${tag}>`;

  // 🔹 Extract visual info
  const fill = selectedElement.getAttribute("fill") || "#ccc";
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

    // 🖱️ Clicking a group selects it and shows tag options
    item.onclick = () => {
      if (selectedElement) selectedElement.classList.remove("selected");
      selectedElement = group;
      group.classList.add("selected");
      tagSelector.style.display = "block";
      suggestTag(group);
    };

    groupList.appendChild(item);
  });

  // 📌 Add group list to the page
  document.body.appendChild(groupList);
}

// 🧠 Suggest semantic HTML tag based on shape, size, and color
function suggestTag(el) {
  const bbox = el.getBBox?.();
  const fill = el.getAttribute("fill");
  const width = bbox?.width || 0;
  const height = bbox?.height || 0;

  let suggestion = "section"; // Default fallback

  // 🔍 Heuristic rules for guessing tag
  if (fill === "red" && height < 60 && width > 300) {
    suggestion = "nav";
  } else if (height > 100 && width > 300) {
    suggestion = "header";
  } else if (el.tagName === "text") {
    suggestion = "h1";
  }

  // 📝 Pre-fill the dropdown with the suggestion
  semanticTag.value = suggestion;
}
