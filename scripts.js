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
        tagSelector
