const svgContainer = document.getElementById("svg-preview");
const fileInput = document.getElementById("svg-upload");
const tagSelector = document.getElementById("tag-selector");
const semanticTag = document.getElementById("semantic-tag");
const applyTag = document.getElementById("apply-tag");
const codeOutput = document.getElementById("code-output");
const useSvgSource = document.getElementById("use-svg-source");

let selectedElement = null;

fileInput.addEventListener("change", (e) => {
  const reader = new FileReader();
  reader.onload = () => {
    svgContainer.innerHTML = reader.result;
    const svgRoot = svgContainer.querySelector("svg");
    enableSelection(svgRoot);
    scanGroups(svgRoot);
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
      suggestTag(el);
    });
  });
}

applyTag.addEventListener("click", () => {
  if (!selectedElement) return;
  const tag = semanticTag.value;
  const id = selectedElement.id || "svg-part";

  let html = "";
  if (useSvgSource.checked) {
    html = `<${tag}>\n  <img src="${id}.svg" alt="${tag} element">\n</${tag}>`;
  } else {
    const fill = selectedElement.getAttribute("fill") || "#ccc";
    const bbox = selectedElement.getBBox?.();
    html = `<${tag} style="background:${fill}; width:${bbox?.width}px; height:${bbox?.height}px;"></${tag}>`;
  }

  codeOutput.value += html + "\n\n";
  selectedElement.classList.remove("selected");
  selectedElement = null;
  tagSelector.style.display = "none";
});

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

function suggestTag(el) {
  const bbox = el.getBBox?.();
  const fill = el.getAttribute("fill");
  const width = bbox?.width || 0;
  const height = bbox?.height || 0;

  let suggestion = "section";

  if (fill === "red" && height < 60 && width > 300) {
    suggestion = "nav";
  } else if (height > 100 && width > 300) {
    suggestion = "header";
  } else if (el.tagName === "text") {
    suggestion = "h1";
  }

  semanticTag.value = suggestion;
}
