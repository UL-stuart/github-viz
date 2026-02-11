import { clearSvg, svgEl, svgText } from "../core/svg.js";
import { formatMonthLabel } from "../core/dates.js";
import { CONFIG } from "../core/config.js"

export function renderCumulativeChart(svg, cumulativeMonthly) {
  if (!svg) return;
  clearSvg(svg);

  const W = 980, H = 220;
  const margin = { top: 16, right: 16, bottom: 32, left: 44 };
  const iw = W - margin.left - margin.right;
  const ih = H - margin.top - margin.bottom;

  if (!cumulativeMonthly || cumulativeMonthly.length === 0) {
    svgText(svg, "No data in window.", { x: 10, y: 20, class: "axisText" });
    return;
  }

  const maxY = Math.max(...cumulativeMonthly.map((d) => d.count), 1);
  const x = (i) => margin.left + (cumulativeMonthly.length === 1 ? 0 : (i * iw) / (cumulativeMonthly.length - 1));
  const y = (v) => margin.top + ih - (v * ih) / maxY;

  // Grid lines + y labels
  const gridLines = 3;
  for (let i = 0; i <= gridLines; i++) {
    const val = (maxY * i) / gridLines;
    const yy = y(val);
    svg.appendChild(svgEl("line", { x1: margin.left, y1: yy, x2: margin.left + iw, y2: yy, class: "gridLine" }));
    svgText(svg, String(Math.round(val)), { x: margin.left - 8, y: yy + 4, "text-anchor": "end", class: "axisText" });
  }

  // Path
  let dLine = "";
  for (let i = 0; i < cumulativeMonthly.length; i++) {
    const px = x(i);
    const py = y(cumulativeMonthly[i].count);
    dLine += i === 0 ? `M ${px} ${py}` : ` L ${px} ${py}`;
  }
  svg.appendChild(svgEl("path", { d: dLine, fill: "none", stroke: CONFIG.LINE_COLOR, "stroke-width": "2" }));

  // X labels
  const maxLabels = 8;
  const step = Math.max(1, Math.ceil(cumulativeMonthly.length / maxLabels));
  for (let i = 0; i < cumulativeMonthly.length; i += step) {
    svgText(svg, formatMonthLabel(cumulativeMonthly[i].month), {
      x: x(i),
      y: margin.top + ih + 22,
      "text-anchor": "middle",
      class: "axisText",
    });
  }
}
