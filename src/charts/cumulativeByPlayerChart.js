import { CONFIG } from "../core/config.js";
import { clearSvg, svgEl, svgText } from "../core/svg.js";
import { formatMonthLabel } from "../core/dates.js";

function textWApprox(str) { return str.length * 7; }

export function renderCumulativeByPlayerChart(svg, playerMonthly, months, playersShown) {
  if (!svg) return;
  clearSvg(svg);

  const W = 980;
  const PLOT_H = 168;
  const margin = { top: 0, right: 16, bottom: 40, left: 44 };

  if (!months || months.length === 0 || !playersShown || playersShown.length === 0) {
    svgText(svg, "No data in window.", { x: 10, y: 20, class: "axisText" });
    return;
  }

  // Order players by total sessions in window
  const totals = playersShown
    .map((p) => {
      const pm = playerMonthly.get(p);
      const total = months.reduce((acc, m) => acc + (pm ? (pm.get(m) || 0) : 0), 0);
      return { player: p, total };
    })
    .sort((a, b) => b.total - a.total || a.player.localeCompare(b.player));

  const MAX_SERIES = 15;
  const truncated = totals.length > MAX_SERIES;
  const players = (truncated ? totals.slice(0, MAX_SERIES) : totals).map((x) => x.player);

  // ---------- Legend layout pass ----------
  const legendX0 = margin.left;
  const maxX = W - margin.right;
  const rowH = 14;
  const sw = 14;

  let lx = legendX0;
  let ly = 18;
  let legendRows = 1;
  for (const p of players) {
    const label = p.length > 28 ? p.slice(0, 27) + "…" : p;
    const needed = sw + 6 + textWApprox(label) + 16;
    if (lx + needed > maxX) {
      lx = legendX0;
      ly += rowH;
      legendRows++;
    }
    lx += needed;
  }
  const legendHeight = 18 + (legendRows - 1) * rowH + 16 + (truncated ? 14 : 0);
  margin.top = legendHeight + 10;

  const H = margin.top + PLOT_H + margin.bottom;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);

  const iw = W - margin.left - margin.right;
  const ih = H - margin.top - margin.bottom;

  // Legend render
  lx = legendX0;
  ly = 18;
  players.forEach((p, idx) => {
    const col = CONFIG.SERIES_PALETTE[idx % CONFIG.SERIES_PALETTE.length];
    const label = p.length > 28 ? p.slice(0, 27) + "…" : p;
    const needed = sw + 6 + textWApprox(label) + 16;
    if (lx + needed > maxX) {
      lx = legendX0;
      ly += rowH;
    }
    svg.appendChild(svgEl("line", {
      x1: lx, y1: ly, x2: lx + sw, y2: ly,
      stroke: col, "stroke-width": "3", "stroke-linecap": "round",
    }));
    svgText(svg, label, { x: lx + sw + 6, y: ly + 4, class: "axisText" });
    lx += needed;
  });

  if (truncated) {
    svgText(svg, `Showing top ${MAX_SERIES} players by sessions in window`, {
      x: margin.left,
      y: legendHeight - 4,
      class: "axisText",
    });
  }

  // Build cumulative series + maxY
  const series = new Map();
  let maxY = 1;
  for (const p of players) {
    const pm = playerMonthly.get(p);
    let run = 0;
    const arr = months.map((m) => (run += pm ? (pm.get(m) || 0) : 0));
    series.set(p, arr);
    for (const v of arr) maxY = Math.max(maxY, v);
  }

  const x = (i) => margin.left + (months.length === 1 ? 0 : (i * iw) / (months.length - 1));
  const y = (v) => margin.top + ih - (v * ih) / maxY;

  // Grid lines + y labels
  for (let i = 0; i <= 3; i++) {
    const val = (maxY * i) / 3;
    const yy = y(val);
    svg.appendChild(svgEl("line", { x1: margin.left, y1: yy, x2: margin.left + iw, y2: yy, class: "gridLine" }));
    svgText(svg, String(Math.round(val)), { x: margin.left - 8, y: yy + 4, "text-anchor": "end", class: "axisText" });
  }

  // Lines
  players.forEach((p, idx) => {
    const col = CONFIG.SERIES_PALETTE[idx % CONFIG.SERIES_PALETTE.length];
    const arr = series.get(p) || [];
    let d = "";
    for (let i = 0; i < arr.length; i++) d += i === 0 ? `M ${x(i)} ${y(arr[i])}` : ` L ${x(i)} ${y(arr[i])}`;
    svg.appendChild(svgEl("path", { d, fill: "none", stroke: col, "stroke-width": "2" }));
  });

  // X labels
  const step = Math.max(1, Math.ceil(months.length / 8));
  for (let i = 0; i < months.length; i += step) {
    svgText(svg, formatMonthLabel(months[i]), { x: x(i), y: margin.top + ih + 22, "text-anchor": "middle", class: "axisText" });
  }
}
