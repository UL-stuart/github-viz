// src/charts/categoryMonthHeatmap.js
import { renderMatrixHeatmap } from "./matrixHeatmap.js";

function stripCategoryPrefix(s) {
  return String(s).replace(/^category:\s*/i, "").trim();
}

export function renderCategoryMonthHeatmap(svgEl, titleEl, categoryMonthly, months, categories, labelW) {
  if (!svgEl) return;

  if (titleEl) titleEl.textContent = "Complexity Categories Per Month";

  if (!categories || categories.length === 0) {
    while (svgEl.firstChild) svgEl.removeChild(svgEl.firstChild);
    const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
    t.setAttribute("x", "10");
    t.setAttribute("y", "20");
    t.setAttribute("class", "axisText");
    t.textContent = "No columns found starting with 'Category:'.";
    svgEl.appendChild(t);
    return;
  }

  // Display labels (strip prefix)
  const displayLabels = categories.map(stripCategoryPrefix);

  // Remap Map keys so renderer can look up values by display label
  const displayMap = new Map();
  for (const original of categories) {
    const disp = stripCategoryPrefix(original);
    displayMap.set(disp, categoryMonthly.get(original) || new Map());
  }

  renderMatrixHeatmap({
    svg: svgEl,
    rowLabels: displayLabels,
    rowToMonthMap: displayMap,
    months,
    labelW,
    valueTitlePrefix: "Category",
    formatMonthTick: (ym) => {
      const [yy, mm] = ym.split("-").map((x) => parseInt(x, 10));
      const d = new Date(Date.UTC(yy, mm - 1, 1));
      return d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" });
    }
  });
}
