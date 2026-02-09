import { CONFIG } from "../core/config.js";
import { clearSvg, svgEl, svgText } from "../core/svg.js";
import { formatMonthLabel } from "../core/dates.js";

function metricLabel(k) {
  return k.replace(/_/g, " ");
}

function textWApprox(str) { return str.length * 7; }

export function renderCumulativeMetricsChart(svg, months, series, titleEl, titleText) {
  if (!svg) return;
  clearSvg(svg);
  if (titleEl && titleText) titleEl.textContent = titleText;

  if (!months || months.length === 0) {
    svgText(svg, "No data in window.", { x: 10, y: 20, class: "axisText" });
    return;
  }

  const keys = CONFIG.SCORE_METRICS.slice();
  // If the caller didn't provide a series for a metric, treat as zeros.
  for (const k of keys) if (!series.has(k)) series.set(k, months.map(() => 0));

  const W = 980;
  const PLOT_H = 168;
  const margin = { top: 0, right: 16, bottom: 40, left: 44 };

  // Legend layout pass
  const legendX0 = margin.left;
  const maxX = W - margin.right;
  const rowH = 14;
  const sw = 14;

  let lx = legendX0;
  let ly = 18;
  let legendRows = 1;
  for (const k of keys) {
    const label = metricLabel(k);
    const needed = sw + 6 + textWApprox(label) + 16;
    if (lx + needed > maxX) {
      lx = legendX0;
      ly += rowH;
      legendRows++;
    }
    lx += needed;
  }

  const legendHeight = 18 + (legendRows - 1) * rowH + 16;
  margin.top = legendHeight + 10;

  const H = margin.top + PLOT_H + margin.bottom;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);

  const iw = W - margin.left - margin.right;
  const ih = H - margin.top - margin.bottom;

  // maxY
  let maxY = 1;
  for (const k of keys) for (const v of (series.get(k) || [])) maxY = Math.max(maxY, v);

  const x = (i) => margin.left + (months.length === 1 ? 0 : (i * iw) / (months.length - 1));
  const y = (v) => margin.top + ih - (v * ih) / maxY;

  const PALETTE = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#17becf"];

  // Legend
  lx = legendX0;
  ly = 18;
  keys.forEach((k, idx) => {
    const col = PALETTE[idx % PALETTE.length];
    const label = metricLabel(k);
    const needed = sw + 6 + textWApprox(label) + 16;
    if (lx + needed > maxX) {
      lx = legendX0;
      ly += rowH;
    }
    svg.appendChild(svgEl("line", { x1: lx, y1: ly, x2: lx + sw, y2: ly, stroke: col, "stroke-width": "3", "stroke-linecap": "round" }));
    svgText(svg, label, { x: lx + sw + 6, y: ly + 4, class: "axisText" });
    lx += needed;
  });

  // Grid + y labels
  const gridLines = 3;
  for (let i = 0; i <= gridLines; i++) {
    const val = (maxY * i) / gridLines;
    const yy = y(val);
    svg.appendChild(svgEl("line", { x1: margin.left, y1: yy, x2: margin.left + iw, y2: yy, class: "gridLine" }));
    svgText(svg, String(Math.round(val * 100) / 100), { x: margin.left - 8, y: yy + 4, "text-anchor": "end", class: "axisText" });
  }

  // X labels
  const maxLabels = 8;
  const step = Math.max(1, Math.ceil(months.length / maxLabels));
  for (let i = 0; i < months.length; i += step) {
    svgText(svg, formatMonthLabel(months[i]), { x: x(i), y: margin.top + ih + 22, "text-anchor": "middle", class: "axisText" });
  }

  // Lines
  keys.forEach((k, idx) => {
    const arr = series.get(k) || [];
    const col = PALETTE[idx % PALETTE.length];
    let dLine = "";
    for (let i = 0; i < arr.length; i++) {
      dLine += i === 0 ? `M ${x(i)} ${y(arr[i])}` : ` L ${x(i)} ${y(arr[i])}`;
    }
    svg.appendChild(svgEl("path", {
      d: dLine,
      fill: "none",
      stroke: col,
      "stroke-width": "2",
      "stroke-linejoin": "round",
      "stroke-linecap": "round",
      opacity: "0.95",
    }));
  });
}
