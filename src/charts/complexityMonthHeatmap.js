import { renderMatrixHeatmap, computeSharedLabelWidth } from "./matrixHeatmap.js";

function stripPrefix(s) {
  return String(s).replace(/^complexity:\s*/i, "").trim();
}

export function renderComplexityMonthHeatmap(
  svgEl,
  titleEl,
  complexityMonthly,   // Map("Complexity: X" -> Map(month->sum))
  months,
  complexities,        // ["Complexity: X", ...]
  labelW
) {
  if (!svgEl) return;

  if (titleEl) titleEl.textContent = "Complexities Experienced Per Month";

  if (!complexities || complexities.length === 0) {
    while (svgEl.firstChild) svgEl.removeChild(svgEl.firstChild);
    const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
    t.setAttribute("x", "10");
    t.setAttribute("y", "20");
    t.setAttribute("class", "axisText");
    t.textContent = "No columns found starting with 'Complexity:'.";
    svgEl.appendChild(t);
    return;
  }

  // 1) Build display labels
  const displayLabels = complexities.map(stripPrefix);

  // 2) Build a remapped Map keyed by display label
  const displayMap = new Map();
  for (const original of complexities) {
    const disp = stripPrefix(original);
    displayMap.set(disp, complexityMonthly.get(original) || new Map());
  }

  const computed = computeSharedLabelWidth({
    lists: [displayLabels],
    maxChars: 35,     // let long labels influence width
    min: 160,
    max: 560          // allow wider label column for complexities
  });

  const labelWForComplexities = Math.max(labelW || 0, computed);

  renderMatrixHeatmap({
    svg: svgEl,
    rowLabels: displayLabels,
    rowToMonthMap: displayMap,
    months,
    labelW: labelWForComplexities,
    valueTitlePrefix: "Complexity",
    formatMonthTick: (ym) => {
      const [yy, mm] = ym.split("-").map((x) => parseInt(x, 10));
      const d = new Date(Date.UTC(yy, mm - 1, 1));
      return d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" });
    }
  });
}
