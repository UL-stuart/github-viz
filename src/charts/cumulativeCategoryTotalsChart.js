// src/charts/cumulativeCategoryTotalsChart.js

import { svgEl, clearSvg } from "../core/svg.js"; // adjust path if your svg helpers differ

const PALETTE = [
  "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd",
  "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf",
  "#393b79", "#637939", "#8c6d31", "#843c39", "#7b4173"
];

function stripCategoryPrefix(s) {
  return String(s).replace(/^category:\s*/i, "").trim();
}

// lightweight width estimate for legend wrapping
function textWApprox(str) { return str.length * 7; }

export function renderCumulativeCategoryTotalsChart(svg, months, seriesMap, titleEl) {
  if (!svg) return;
  clearSvg(svg);

  const keys = Array.from(seriesMap.keys());
  if (titleEl) titleEl.textContent = "Cumulative Category Totals by Month";

  if (!months || months.length === 0 || keys.length === 0) {
    const t = svgEl("text", { x: 10, y: 20, class: "axisText" });
    t.textContent = "No category data available in this window.";
    svg.appendChild(t);
    return;
  }

  const W = 980;
  const PLOT_H = 168;
  const margin = { top: 0, right: 16, bottom: 40, left: 44 };

  // ---- Legend layout pass ----
  const sw = 14;
  const rowH = 14;
  const legendX0 = margin.left;
  const maxX = W - margin.right;

  let lx = legendX0, ly = 18, rows = 1;
  for (const k of keys) {
    const label = stripCategoryPrefix(k);
    const needed = sw + 6 + textWApprox(label) + 16;
    if (lx + needed > maxX) {
      lx = legendX0;
      ly += rowH;
      rows++;
    }
    lx += needed;
  }
  const legendHeight = 18 + (rows - 1) * rowH + 16;
  margin.top = legendHeight + 10;

  const H = margin.top + PLOT_H + margin.bottom;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);

  const iw = W - margin.left - margin.right;
  const ih = H - margin.top - margin.bottom;

  // Compute maxY across series
  let maxY = 1;
  for (const k of keys) {
    const arr = seriesMap.get(k) || [];
    for (const v of arr) if (v > maxY) maxY = v;
  }

  const x = (i) => margin.left + (months.length === 1 ? 0 : (i * iw) / (months.length - 1));
  const y = (v) => margin.top + ih - (v * ih) / maxY;

  // Draw legend
  lx = legendX0; ly = 18;
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    const col = PALETTE[i % PALETTE.length];
    const label = stripCategoryPrefix(k);
    const needed = sw + 6 + textWApprox(label) + 16;

    if (lx + needed > maxX) { lx = legendX0; ly += rowH; }

    svg.appendChild(svgEl("line", {
      x1: lx, y1: ly, x2: lx + sw, y2: ly,
      stroke: col, "stroke-width": "3", "stroke-linecap": "round"
    }));
    const t = svgEl("text", { x: lx + sw + 6, y: ly + 4, class: "axisText" });
    t.textContent = label;
    svg.appendChild(t);

    lx += needed;
  }

  // Grid lines (3)
  for (let i = 0; i <= 3; i++) {
    const val = (maxY * i) / 3;
    const yy = y(val);
    svg.appendChild(svgEl("line", {
      x1: margin.left, y1: yy, x2: margin.left + iw, y2: yy,
      class: "gridLine"
    }));
    const t = svgEl("text", {
      x: margin.left - 8, y: yy + 4, "text-anchor": "end", class: "axisText"
    });
    t.textContent = Math.round(val);
    svg.appendChild(t);
  }

  // Plot each series
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    const col = PALETTE[i % PALETTE.length];
    const arr = seriesMap.get(k) || [];

    let d = "";
    for (let j = 0; j < arr.length; j++) {
      d += (j === 0 ? "M" : " L") + ` ${x(j)} ${y(arr[j])}`;
    }

    svg.appendChild(svgEl("path", {
      d,
      fill: "none",
      stroke: col,
      "stroke-width": "2",
    }));
  }

  // X labels (same style as others: sparse)
  const step = Math.max(1, Math.ceil(months.length / 8));
  for (let i = 0; i < months.length; i += step) {
    const [yy, mm] = months[i].split("-").map(n => parseInt(n, 10));
    const d = new Date(Date.UTC(yy, mm - 1, 1));
    const label = d.toLocaleString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });

    const t = svgEl("text", {
      x: x(i), y: margin.top + ih + 22, "text-anchor": "middle", class: "axisText"
    });
    t.textContent = label;
    svg.appendChild(t);
  }
}
