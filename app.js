const drop = document.getElementById("drop");
const grid = document.getElementById("grid");
const yLabels = document.getElementById("yLabels");
const monthLabels = document.getElementById("monthLabels");
const playerSelect = document.getElementById("playerSelect");
const windowLabel = document.getElementById("windowLabel");
const tooltip = document.getElementById("tooltip");

const chartSvg = document.getElementById("areaChart");
const cumulativeSvg = document.getElementById("cumulativeChart");
const cumulativeByPlayerSvg = document.getElementById("cumulativeByPlayerChart");
const chartTitle = document.getElementById("chartTitle");

const hmSvg = document.getElementById("playerMonthHeatmap");
const hmTitle = document.getElementById("hmTitle");

const drillHmSvg = document.getElementById("drillMonthHeatmap");
const drillHmTitle = document.getElementById("drillHmTitle");

// Default CSV to auto-load on page start (must be served over HTTP)
const DEFAULT_CSV_URL = "example.csv";

const COLORS = ["#ebedf0", "#c6e48b", "#7bc96f", "#239a3b", "#196127"]; // 0..4+
const CAP = 4;

// Keep these in sync with CSS
const CELL = 14;
const GAP = 3;
const PITCH = CELL + GAP;

// Tooltip list limits
const TOOLTIP_MAX_LINES = 18;

let currentRows = [];

function setDropActive(isActive) {
  drop.style.borderColor = isActive ? "#999" : "#ccc";
}

// Prevent the browser from opening the file if dropped outside the drop zone
document.addEventListener("dragover", (e) => e.preventDefault());
document.addEventListener("drop", (e) => e.preventDefault());

drop.addEventListener("dragenter", (e) => { e.preventDefault(); setDropActive(true); });
drop.addEventListener("dragover", (e) => { e.preventDefault(); setDropActive(true); });
drop.addEventListener("dragleave", (e) => { e.preventDefault(); setDropActive(false); });

drop.addEventListener("drop", (e) => {
  e.preventDefault();
  setDropActive(false);

  if (typeof Papa === "undefined") {
    alert("PapaParse didn't load. Are you serving the page and online?");
    return;
  }

  const files = e.dataTransfer?.files;
  if (!files || files.length === 0) return;

  loadCsvFile(files[0]);
});

function toDateOnlyUTC(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function parseSessionStart(value) {
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function dayKey(dateUTC) {
  const y = dateUTC.getUTCFullYear();
  const m = String(dateUTC.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dateUTC.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function monthKey(dateUTC) {
  const y = dateUTC.getUTCFullYear();
  const m = String(dateUTC.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function sundayOnOrBefore(dateUTC) {
  const dow = dateUTC.getUTCDay();
  const out = new Date(dateUTC);
  out.setUTCDate(out.getUTCDate() - dow);
  return out;
}

function addDays(dateUTC, n) {
  const out = new Date(dateUTC);
  out.setUTCDate(out.getUTCDate() + n);
  return out;
}

function formatMonthLabel(ym) {
  const [y, m] = ym.split("-").map(x => parseInt(x, 10));
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
}

function uniquePlayersFromRows(rows) {
  const s = new Set();
  for (const r of rows) if (r.player) s.add(String(r.player));
  return Array.from(s).sort();
}

/**
 * Build:
 * - counts: dateKey -> session count
 * - details: dateKey -> array of { player, name }
 * - monthly: [{month:"YYYY-MM", count}]
 * - playerMonthly: Map(player -> Map(month -> count))
 * - drillMonthly: Map(drillName -> Map(month -> count))
 * - months: ["YYYY-MM", ...] continuous across window
 */
function buildAllAggregations(rows, playerValue) {
  let maxDate = null;
  const parsed = [];

  for (const r of rows) {
    const d = parseSessionStart(r.session_start);
    if (!d) continue;

    const dateUTC = toDateOnlyUTC(d);
    const player = (r.player ?? "").toString();
    const sessionName = (r.name ?? "").toString();

    parsed.push({ dateUTC, player, sessionName });

    if (!maxDate || dateUTC > maxDate) maxDate = dateUTC;
  }

  if (!maxDate) {
    return {
      counts: new Map(),
      details: new Map(),
      monthly: [],
      playerMonthly: new Map(),
      drillMonthly: new Map(),
      months: [],
      start: null,
      end: null
    };
  }

  const end = maxDate;
  const start = addDays(end, -364);

  // Continuous month keys across window
  const months = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const endCursor = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  for (let d = new Date(cursor); d <= endCursor; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) {
    months.push(monthKey(d));
  }

  const counts = new Map();
  const details = new Map();
  const monthlyMap = new Map();
  const playerMonthly = new Map();
  const drillMonthly = new Map();

  for (const item of parsed) {
    if (item.dateUTC < start || item.dateUTC > end) continue;
    if (playerValue !== "ALL" && item.player !== playerValue) continue;

    const dk = dayKey(item.dateUTC);
    counts.set(dk, (counts.get(dk) || 0) + 1);

    if (!details.has(dk)) details.set(dk, []);
    details.get(dk).push({
      player: item.player || "(unknown player)",
      name: item.sessionName || "(unnamed session)",
    });

    const mk = monthKey(item.dateUTC);
    monthlyMap.set(mk, (monthlyMap.get(mk) || 0) + 1);

    const p = item.player || "(unknown player)";
    if (!playerMonthly.has(p)) playerMonthly.set(p, new Map());
    const pm = playerMonthly.get(p);
    pm.set(mk, (pm.get(mk) || 0) + 1);

    const drill = item.sessionName || "(unnamed drill)";
    if (!drillMonthly.has(drill)) drillMonthly.set(drill, new Map());
    const dm = drillMonthly.get(drill);
    dm.set(mk, (dm.get(mk) || 0) + 1);
  }

  const monthly = months.map(mk => ({ month: mk, count: monthlyMap.get(mk) || 0 }));
  return { counts, details, monthly, playerMonthly, drillMonthly, months, start, end };
}

function renderYLabels() {
  if (!yLabels) return;
  yLabels.innerHTML = "";
  const labelsByRow = ["", "Mon", "", "Wed", "", "Fri", ""];
  for (const t of labelsByRow) {
    const div = document.createElement("div");
    div.textContent = t;
    yLabels.appendChild(div);
  }
}

function renderMonthLabels(start, end, firstSunday, nWeeks) {
  if (!monthLabels) return;
  monthLabels.innerHTML = "";
  monthLabels.style.width = `${nWeeks * PITCH - GAP}px`;

  let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  if (cursor < start) cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));

  let lastYear = null;

  while (cursor <= end) {
    const weekIndex = Math.floor((cursor - firstSunday) / (7 * 24 * 3600 * 1000));
    const leftPx = weekIndex * PITCH;

    const month = cursor.toLocaleString("en-GB", { month: "short", timeZone: "UTC" });
    const year = cursor.getUTCFullYear();
    const showYear = (lastYear === null) || (year !== lastYear) || (cursor.getUTCMonth() === 0);
    const labelText = showYear ? `${month} ${year}` : month;

    const div = document.createElement("div");
    div.className = "monthLabel";
    div.style.left = `${leftPx}px`;
    div.textContent = labelText;

    monthLabels.appendChild(div);

    lastYear = year;
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }
}

function hideTooltip() {
  if (!tooltip) return;
  tooltip.style.display = "none";
}

function showTooltip(text, x, y) {
  if (!tooltip) return;
  tooltip.textContent = text;
  tooltip.style.display = "block";

  const pad = 12;
  const maxX = window.innerWidth - 20;
  const maxY = window.innerHeight - 20;

  tooltip.style.left = Math.min(x + pad, maxX) + "px";
  tooltip.style.top = Math.min(y + pad, maxY) + "px";
}

function formatTooltip(dateKeyStr, items) {
  const n = items.length;
  const header = `${n} session${n === 1 ? "" : "s"} on ${dateKeyStr}`;

  const sorted = items.slice().sort((a, b) => {
    const p = a.player.localeCompare(b.player);
    if (p !== 0) return p;
    return a.name.localeCompare(b.name);
  });

  const lines = sorted.slice(0, TOOLTIP_MAX_LINES).map(x => `• ${x.player} — ${x.name}`);
  if (sorted.length > TOOLTIP_MAX_LINES) lines.push(`… +${sorted.length - TOOLTIP_MAX_LINES} more`);
  return [header, ...lines].join("\n");
}

function renderGrid(counts, details, start, end) {
  renderYLabels();
  grid.innerHTML = "";

  const firstSunday = sundayOnOrBefore(start);
  const last = new Date(end);
  last.setUTCDate(last.getUTCDate() + (6 - last.getUTCDay()));

  const totalDays = Math.floor((last - firstSunday) / (24 * 3600 * 1000)) + 1;
  const nWeeks = Math.ceil(totalDays / 7);

  renderMonthLabels(start, end, firstSunday, nWeeks);

  for (let i = 0; i < totalDays; i++) {
    const d = addDays(firstSunday, i);
    const inWindow = d >= start && d <= end;

    const cell = document.createElement("div");
    cell.className = "cell";

    if (inWindow) {
      const k = dayKey(d);
      const c = counts.get(k) || 0;
      const bucket = Math.min(c, CAP);
      cell.style.background = COLORS[bucket];

      if (c > 0) {
        const items = details.get(k) || [];
        cell.dataset.tooltip = formatTooltip(k, items);
      } else {
        cell.dataset.tooltip = "";
      }
    } else {
      cell.style.visibility = "hidden";
      cell.dataset.tooltip = "";
    }

    grid.appendChild(cell);
  }

  windowLabel.textContent = `Window: ${dayKey(start)} → ${dayKey(end)}`;
}

// Tooltip handlers (event delegation)
grid.addEventListener("mousemove", (e) => {
  const cell = e.target.closest(".cell");
  if (!cell) { hideTooltip(); return; }
  const text = cell.dataset.tooltip;
  if (!text) { hideTooltip(); return; }
  showTooltip(text, e.clientX, e.clientY);
});
grid.addEventListener("mouseleave", hideTooltip);

/* ---------------------------
   SVG Helpers
----------------------------*/

function clearSvg(svg) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
}
function svgEl(tag, attrs = {}) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

/* ---------------------------
   SVG Area Chart (monthly)
----------------------------*/

function renderAreaChart(monthly, playerValue) {
  if (!chartSvg) return;

  clearSvg(chartSvg);

  const W = 980, H = 220;
  const margin = { top: 16, right: 16, bottom: 32, left: 44 };
  const iw = W - margin.left - margin.right;
  const ih = H - margin.top - margin.bottom;

  if (chartTitle) {
    chartTitle.textContent = playerValue === "ALL"
      ? "Sessions per month (All players)"
      : `Sessions per month (${playerValue})`;
  }

  if (!monthly || monthly.length === 0) {
    const t = svgEl("text", { x: 10, y: 20, class: "axisText" });
    t.textContent = "No data in window.";
    chartSvg.appendChild(t);
    return;
  }

  const maxY = Math.max(...monthly.map(d => d.count), 1);

  const x = (i) => margin.left + (monthly.length === 1 ? 0 : (i * iw) / (monthly.length - 1));
  const y = (v) => margin.top + ih - (v * ih) / maxY;

  // grid lines + y labels
  const gridLines = 3;
  for (let i = 0; i <= gridLines; i++) {
    const val = (maxY * i) / gridLines;
    const yy = y(val);
    chartSvg.appendChild(svgEl("line", { x1: margin.left, y1: yy, x2: margin.left + iw, y2: yy, class: "gridLine" }));
    const t = svgEl("text", { x: margin.left - 8, y: yy + 4, "text-anchor": "end", class: "axisText" });
    t.textContent = Math.round(val).toString();
    chartSvg.appendChild(t);
  }

  let dLine = "";
  for (let i = 0; i < monthly.length; i++) {
    const px = x(i);
    const py = y(monthly[i].count);
    dLine += (i === 0 ? `M ${px} ${py}` : ` L ${px} ${py}`);
  }

  const x0 = x(0);
  const xN = x(monthly.length - 1);
  const yBase = margin.top + ih;
  const dArea = `${dLine} L ${xN} ${yBase} L ${x0} ${yBase} Z`;

  chartSvg.appendChild(svgEl("path", { d: dArea, fill: "rgba(35, 154, 59, 0.20)", stroke: "none" }));
  chartSvg.appendChild(svgEl("path", { d: dLine, fill: "none", stroke: "rgba(35, 154, 59, 0.95)", "stroke-width": "2" }));

  const maxLabels = 8;
  const step = Math.max(1, Math.ceil(monthly.length / maxLabels));
  for (let i = 0; i < monthly.length; i += step) {
    const px = x(i);
    const label = formatMonthLabel(monthly[i].month);
    const t = svgEl("text", { x: px, y: margin.top + ih + 22, "text-anchor": "middle", class: "axisText" });
    t.textContent = label;
    chartSvg.appendChild(t);
  }

  for (let i = 0; i < monthly.length; i++) {
    const px = x(i);
    const py = y(monthly[i].count);
    chartSvg.appendChild(svgEl("circle", { cx: px, cy: py, r: 2.5, fill: "rgba(35, 154, 59, 0.95)" }));
  }
}

/* ---------------------------
   SVG Cumulative Line Chart (monthly cumulative)
----------------------------*/

function renderCumulativeChart(monthly, playerValue) {
  if (!cumulativeSvg) return;

  clearSvg(cumulativeSvg);

  const W = 980, H = 220;
  const margin = { top: 16, right: 16, bottom: 32, left: 44 };
  const iw = W - margin.left - margin.right;
  const ih = H - margin.top - margin.bottom;

  if (!monthly || monthly.length === 0) {
    const t = svgEl("text", { x: 10, y: 20, class: "axisText" });
    t.textContent = "No data in window.";
    cumulativeSvg.appendChild(t);
    return;
  }

  // Build cumulative series
  let run = 0;
  const cum = monthly.map(d => {
    run += (d.count || 0);
    return { month: d.month, count: run };
  });

  const maxY = Math.max(...cum.map(d => d.count), 1);

  const x = (i) => margin.left + (cum.length === 1 ? 0 : (i * iw) / (cum.length - 1));
  const y = (v) => margin.top + ih - (v * ih) / maxY;

  // Grid lines + y labels
  const gridLines = 3;
  for (let i = 0; i <= gridLines; i++) {
    const val = (maxY * i) / gridLines;
    const yy = y(val);
    cumulativeSvg.appendChild(svgEl("line", { x1: margin.left, y1: yy, x2: margin.left + iw, y2: yy, class: "gridLine" }));
    const t = svgEl("text", { x: margin.left - 8, y: yy + 4, "text-anchor": "end", class: "axisText" });
    t.textContent = Math.round(val).toString();
    cumulativeSvg.appendChild(t);
  }

  // Line path
  let dLine = "";
  for (let i = 0; i < cum.length; i++) {
    const px = x(i);
    const py = y(cum[i].count);
    dLine += (i === 0 ? `M ${px} ${py}` : ` L ${px} ${py}`);
  }

  cumulativeSvg.appendChild(svgEl("path", {
    d: dLine,
    fill: "none",
    stroke: "rgba(35, 154, 59, 0.95)",
    "stroke-width": "2"
  }));

  // X labels
  const maxLabels = 8;
  const step = Math.max(1, Math.ceil(cum.length / maxLabels));
  for (let i = 0; i < cum.length; i += step) {
    const px = x(i);
    const label = formatMonthLabel(cum[i].month);
    const t = svgEl("text", { x: px, y: margin.top + ih + 22, "text-anchor": "middle", class: "axisText" });
    t.textContent = label;
    cumulativeSvg.appendChild(t);
  }

  // Dots
  for (let i = 0; i < cum.length; i++) {
    const px = x(i);
    const py = y(cum[i].count);
    cumulativeSvg.appendChild(svgEl("circle", { cx: px, cy: py, r: 2.5, fill: "rgba(35, 154, 59, 0.95)" }));
  }
}

/* ---------------------------
   SVG Cumulative Line Chart by Player (monthly cumulative)
----------------------------*/

function renderCumulativeByPlayerChart(playerMonthly, months, playersShown) {
  if (!cumulativeByPlayerSvg) return;

  clearSvg(cumulativeByPlayerSvg);

  const W = 980;

  // Keep the plotting region height stable; grow the SVG height upward if legend needs more room.
  const PLOT_H = 168;

  // Base margins (top is computed after legend layout)
  const margin = { top: 0, right: 16, bottom: 40, left: 44 };

  if (!months || months.length === 0 || !playersShown || playersShown.length === 0) {
    const t = svgEl("text", { x: 10, y: 20, class: "axisText" });
    t.textContent = "No data in window.";
    cumulativeByPlayerSvg.appendChild(t);
    return;
  }

  // Build totals per player (for ordering + optional truncation)
  const totals = playersShown.map(p => {
    const pm = playerMonthly.get(p);
    const total = months.reduce((acc, m) => acc + (pm ? (pm.get(m) || 0) : 0), 0);
    return { player: p, total };
  }).sort((a, b) => b.total - a.total || a.player.localeCompare(b.player));

  const MAX_SERIES = 15;
  const truncated = totals.length > MAX_SERIES;
  const players = (truncated ? totals.slice(0, MAX_SERIES) : totals).map(x => x.player);

  // Palette (distinct, readable)
  const PALETTE = [
    "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd",
    "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf",
    "#393b79", "#637939", "#8c6d31", "#843c39", "#7b4173"
  ];

  // ---------- Legend layout pass (compute required height) ----------
  const legendX0 = margin.left;
  const rowH = 14;
  const maxX = W - margin.right;
  const sw = 14;

  function textWApprox(str) { return str.length * 7; } // ~7px/char for system UI font

  let lx = legendX0;
  let ly = 18; // baseline for first legend row
  let legendRows = 1;

  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    const label = p.length > 28 ? p.slice(0, 27) + "…" : p;
    const needed = sw + 6 + textWApprox(label) + 16;

    if (lx + needed > maxX) {
      lx = legendX0;
      ly += rowH;
      legendRows++;
    }
    lx += needed;
  }

  // Legend height in SVG coords:
  // - first row baseline ~18
  // - each wrap adds rowH
  // - + padding below legend rows
  // - + an extra line for the truncation note (if present)
  const legendHeight =
    18 + (legendRows - 1) * rowH + 16 + (truncated ? 14 : 0);

  // Now set top margin so plot always starts below the legend band.
  margin.top = legendHeight + 10;

  // Grow overall SVG height so plot stays readable.
  const H = margin.top + PLOT_H + margin.bottom;
  cumulativeByPlayerSvg.setAttribute("viewBox", `0 0 ${W} ${H}`);

  const iw = W - margin.left - margin.right;
  const ih = H - margin.top - margin.bottom;

  // ---------- Precompute cumulative series ----------
  const series = new Map(); // player -> [cum...]
  let maxY = 1;

  for (const p of players) {
    const pm = playerMonthly.get(p);
    let run = 0;
    const arr = months.map(m => {
      run += pm ? (pm.get(m) || 0) : 0;
      return run;
    });
    series.set(p, arr);
    for (const v of arr) if (v > maxY) maxY = v;
  }

  const x = (i) => margin.left + (months.length === 1 ? 0 : (i * iw) / (months.length - 1));
  const y = (v) => margin.top + ih - (v * ih) / maxY;

  // ---------- Draw legend (guaranteed above plot) ----------
  lx = legendX0;
  ly = 18;

  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    const col = PALETTE[i % PALETTE.length];

    const label = p.length > 28 ? p.slice(0, 27) + "…" : p;
    const needed = sw + 6 + textWApprox(label) + 16;

    if (lx + needed > maxX) {
      lx = legendX0;
      ly += rowH;
    }

    cumulativeByPlayerSvg.appendChild(svgEl("line", {
      x1: lx, y1: ly, x2: lx + sw, y2: ly,
      stroke: col, "stroke-width": "3", "stroke-linecap": "round"
    }));
    const t = svgEl("text", { x: lx + sw + 6, y: ly + 4, class: "axisText" });
    t.textContent = label;
    cumulativeByPlayerSvg.appendChild(t);

    lx += needed;
  }

  if (truncated) {
    // Place the note at the bottom of the legend band (still above plot).
    const note = svgEl("text", { x: margin.left, y: legendHeight - 4, class: "axisText" });
    note.textContent = `Showing top ${MAX_SERIES} players by sessions in window`;
    cumulativeByPlayerSvg.appendChild(note);
  }

  // ---------- Grid lines + y labels ----------
  const gridLines = 3;
  for (let i = 0; i <= gridLines; i++) {
    const val = (maxY * i) / gridLines;
    const yy = y(val);
    cumulativeByPlayerSvg.appendChild(svgEl("line", {
      x1: margin.left, y1: yy, x2: margin.left + iw, y2: yy, class: "gridLine"
    }));
    const t = svgEl("text", { x: margin.left - 8, y: yy + 4, "text-anchor": "end", class: "axisText" });
    t.textContent = Math.round(val).toString();
    cumulativeByPlayerSvg.appendChild(t);
  }

  // ---------- Draw series lines ----------
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    const col = PALETTE[i % PALETTE.length];
    const arr = series.get(p);

    let dLine = "";
    for (let j = 0; j < arr.length; j++) {
      const px = x(j);
      const py = y(arr[j]);
      dLine += (j === 0 ? `M ${px} ${py}` : ` L ${px} ${py}`);
    }

    cumulativeByPlayerSvg.appendChild(svgEl("path", {
      d: dLine,
      fill: "none",
      stroke: col,
      "stroke-width": "2"
    }));

    // Dots (small)
    for (let j = 0; j < arr.length; j++) {
      cumulativeByPlayerSvg.appendChild(svgEl("circle", {
        cx: x(j), cy: y(arr[j]), r: 2,
        fill: col
      }));
    }
  }

  // ---------- X labels (months) ----------
  const maxLabels = 8;
  const step = Math.max(1, Math.ceil(months.length / maxLabels));
  for (let i = 0; i < months.length; i += step) {
    const px = x(i);
    const label = formatMonthLabel(months[i]);
    const t = svgEl("text", { x: px, y: margin.top + ih + 22, "text-anchor": "middle", class: "axisText" });
    t.textContent = label;
    cumulativeByPlayerSvg.appendChild(t);
  }
}

/* ---------------------------
   Matrix Heatmaps (shared)
----------------------------*/

function lerp(a, b, t) { return a + (b - a) * t; }
function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const bigint = parseInt(h, 16);
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}
function rgbToHex({r,g,b}) {
  const toHex = (n) => n.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Simple gradient: light green -> dark green (0 handled separately)
function valueToColor(v, vmax) {
  if (v <= 0) return "#f3f4f6";
  const t = vmax <= 0 ? 0 : Math.min(1, v / vmax);
  const c0 = hexToRgb("#c6e48b");
  const c1 = hexToRgb("#196127");
  return rgbToHex({
    r: Math.round(lerp(c0.r, c1.r, t)),
    g: Math.round(lerp(c0.g, c1.g, t)),
    b: Math.round(lerp(c0.b, c1.b, t)),
  });
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function estimateLabelWFromText(maxChars) {
  // Rough character width estimate for the current font (~7px per char) + padding
  return Math.round(maxChars * 7 + 24);
}

function getMatrixLayout(monthsCount, labelW) {
  // One source of truth so player/drill heatmaps align perfectly
  const W_BASE = 980;
  const leftPad = 10;
  const rightPad = 10;
  const topPad = 44;
  const bottomPad = 34;

  const rowH = 22;
  const cellH = 18;

  // labelW is now dynamic + shared across both heatmaps
  const minCellW = 40;
  const gapInCell = 6;

  let cellW = Math.floor((W_BASE - leftPad - rightPad - labelW) / Math.max(1, monthsCount));

  let W = W_BASE;
  if (cellW < minCellW) {
    cellW = minCellW;
    W = leftPad + rightPad + labelW + monthsCount * cellW;
  }

  const rectW = Math.max(18, cellW - gapInCell);
  const x0 = leftPad + labelW;
  const y0 = topPad;

  return { W, leftPad, rightPad, topPad, bottomPad, rowH, cellW, cellH, rectW, labelW, x0, y0 };
}

function renderMatrixHeatmap({
  svg,
  titleEl,
  titleText,
  rowLabels,
  rowToMonthMap,
  months,
  valueTitlePrefix,
  labelW,
}) {
  if (!svg) return;
  clearSvg(svg);

  const L = getMatrixLayout(months.length, labelW);

  let vmax = 0;
  for (const r of rowLabels) {
    const rm = rowToMonthMap.get(r);
    for (const m of months) {
      const v = rm ? (rm.get(m) || 0) : 0;
      if (v > vmax) vmax = v;
    }
  }

  const neededH = L.topPad + rowLabels.length * L.rowH + L.bottomPad;
  svg.setAttribute("viewBox", `0 0 ${L.W} ${Math.max(240, neededH)}`);

  if (titleEl) titleEl.textContent = titleText;

  // Month labels
  for (let j = 0; j < months.length; j++) {
    const mx = L.x0 + j * L.cellW + L.cellW / 2;

    const t = svgEl("text", { x: mx, y: 16, "text-anchor": "middle", class: "axisText" });
    const [yy, mm] = months[j].split("-").map(x => parseInt(x, 10));
    const d = new Date(Date.UTC(yy, mm - 1, 1));
    t.textContent = d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" });
    svg.appendChild(t);

    if (mm === 1) {
      const ytxt = svgEl("text", { x: mx, y: 28, "text-anchor": "middle", class: "axisText" });
      ytxt.textContent = String(yy);
      svg.appendChild(ytxt);
    }
  }

  for (let i = 0; i < rowLabels.length; i++) {
    const rFull = rowLabels[i];
    const py = L.y0 + i * L.rowH;

    const label = svgEl("text", {
      x: L.leftPad + L.labelW - 8,
      y: py + L.cellH / 2 + 2,
      class: "hmPlayerText",
      "text-anchor": "end"
    });

    const MAX_CHARS = 44;
    label.textContent = rFull.length > MAX_CHARS ? rFull.slice(0, MAX_CHARS - 1) + "…" : rFull;
    svg.appendChild(label);

    const rm = rowToMonthMap.get(rFull);

    for (let j = 0; j < months.length; j++) {
      const mo = months[j];
      const v = rm ? (rm.get(mo) || 0) : 0;

      const x = L.x0 + j * L.cellW;
      const y = py;

      const rect = svgEl("rect", {
        x, y, width: L.rectW, height: L.cellH,
        rx: 4, ry: 4,
        fill: valueToColor(v, vmax),
        stroke: "#e5e7eb",
        "stroke-width": "1",
      });

      const title = svgEl("title");
      title.textContent = `${valueTitlePrefix}: ${rFull} — ${mo}: ${v} session${v === 1 ? "" : "s"}`;
      rect.appendChild(title);

      svg.appendChild(rect);

      if (v > 0) {
        const tx = svgEl("text", {
          x: x + L.rectW / 2,
          y: y + L.cellH / 2 + 1,
          class: "hmCellText"
        });
        tx.textContent = String(v);
        svg.appendChild(tx);
      }
    }
  }

  const legendY = L.y0 + rowLabels.length * L.rowH + 10;
  const lg = svgEl("text", { x: L.leftPad, y: legendY + 12, class: "axisText" });
  lg.textContent = vmax > 0 ? `Color scale: 0 → ${vmax} sessions` : "No sessions in window";
  svg.appendChild(lg);
}

function renderPlayerMonthHeatmap(playerMonthly, months, allPlayersList, playerValue, labelW) {
  const players = (playerValue === "ALL") ? allPlayersList.slice() : [playerValue];
  renderMatrixHeatmap({
    svg: hmSvg,
    titleEl: hmTitle,
    titleText: playerValue === "ALL" ? "Player-by-month usage (All players)" : `Player-by-month usage (${playerValue})`,
    rowLabels: players,
    rowToMonthMap: playerMonthly,
    months,
    valueTitlePrefix: "Player",
    labelW,
  });
}

function renderDrillMonthHeatmap(drillMonthly, months, labelW) {
  let drills = Array.from(drillMonthly.keys());

  drills.sort((a, b) => {
    const sum = (dr) => months.reduce((acc, mo) => acc + ((drillMonthly.get(dr)?.get(mo)) || 0), 0);
    const sa = sum(a), sb = sum(b);
    if (sb !== sa) return sb - sa;
    return a.localeCompare(b);
  });

  renderMatrixHeatmap({
    svg: drillHmSvg,
    titleEl: drillHmTitle,
    titleText: "Drill-by-month usage",
    rowLabels: drills,
    rowToMonthMap: drillMonthly,
    months,
    valueTitlePrefix: "Drill",
    labelW,
  });
}

/* ---------------------------
   Players dropdown + refresh
----------------------------*/

function populatePlayers(rows) {
  const players = uniquePlayersFromRows(rows);

  playerSelect.innerHTML = "";

  const optAll = document.createElement("option");
  optAll.value = "ALL";
  optAll.textContent = "All players";
  playerSelect.appendChild(optAll);

  for (const p of players) {
    const o = document.createElement("option");
    o.value = p;
    o.textContent = p;
    playerSelect.appendChild(o);
  }
}

function refresh() {
  const playerValue = playerSelect.value || "ALL";
  const allPlayersList = uniquePlayersFromRows(currentRows);

  const { counts, details, monthly, playerMonthly, drillMonthly, months, start, end } =
    buildAllAggregations(currentRows, playerValue);

  if (!start) return;

  // ---- Compute a SHARED label width for BOTH matrices ----
  const playersShown = (playerValue === "ALL") ? allPlayersList.slice() : [playerValue];
  const drillsShown = Array.from(drillMonthly.keys());

  const MAX_CHARS = 44;
  const maxChars = Math.max(
    0,
    ...playersShown.map(s => Math.min(String(s).length, MAX_CHARS)),
    ...drillsShown.map(s => Math.min(String(s).length, MAX_CHARS))
  );

  const sharedLabelW = clamp(estimateLabelWFromText(maxChars), 90, 340);

  renderGrid(counts, details, start, end);
  renderAreaChart(monthly, playerValue);
  renderCumulativeChart(monthly, playerValue);
  renderCumulativeByPlayerChart(playerMonthly, months, playersShown);
  renderPlayerMonthHeatmap(playerMonthly, months, allPlayersList, playerValue, sharedLabelW);
  renderDrillMonthHeatmap(drillMonthly, months, sharedLabelW);
}

playerSelect.addEventListener("change", refresh);

/* ---------------------------
   Loading CSV (file + default URL)
----------------------------*/

function loadCsvFile(file) {
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      currentRows = results.data;
      populatePlayers(currentRows);
      refresh();
    },
    error: (err) => {
      console.error(err);
      alert("Failed to parse CSV. Check console for details.");
    },
  });
}

async function loadDefaultCsv(url) {
  try {
    if (typeof Papa === "undefined") return;

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();

    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
    if (parsed.errors && parsed.errors.length) {
      console.warn("PapaParse errors:", parsed.errors);
    }

    currentRows = parsed.data || [];
    populatePlayers(currentRows);
    refresh();
  } catch (e) {
    console.warn(`Default CSV load failed (${url}):`, e);
    // Non-fatal: user can still drag/drop
  }
}

// Kick off default load on initial page render
window.addEventListener("DOMContentLoaded", () => {
  loadDefaultCsv(DEFAULT_CSV_URL);
});