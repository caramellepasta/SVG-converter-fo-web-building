const svgContainer = document.getElementById("svg-preview");
const fileInput = document.getElementById("svg-upload");
const tagSelector = document.getElementById("tag-selector");
const semanticTag = document.getElementById("semantic-tag");
const applyTag = document.getElementById("apply-tag");
const codeOutput = document.getElementById("code-output");

let selectedElement = null;

fileInput.addEventListener("change", (e) => {
  const reader = new FileReader();
  reader.onload = () => {
    svgContainer.innerHTML = reader.result;
    enableSelection(svgContainer);
  };
  reader.readAsText(e.target.files[0]);
});

function enableSelection(container) {
  const elements = container.querySelectorAll("*");
  elements.forEach(el => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      if (selectedElement) selectedElement.classList.remove("selected");
      selectedElement = el;
      el.classList.add("selected");
      tagSelector.style.display = "block";
    });
  });
}

applyTag.addEventListener("click", () => {
  if (!selectedElement) return;
  const tag = semanticTag.value;
  const id = selectedElement.id || "svg-part";
  const html = `<${tag}>\n  <img src="${id}.svg" alt="${tag} element">\n</${tag}>`;
  codeOutput.value += html + "\n\n";
  selectedElement.classList.remove("selected");
  selectedElement = null;
  tagSelector.style.display = "none";
});
