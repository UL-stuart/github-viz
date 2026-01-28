const drop = document.getElementById("drop");
const grid = document.getElementById("grid");
const yLabels = document.getElementById("yLabels");
const monthLabels = document.getElementById("monthLabels");
const playerSelect = document.getElementById("playerSelect");
const windowLabel = document.getElementById("windowLabel");
const tooltip = document.getElementById("tooltip");
const chartSvg = document.getElementById("areaChart");
const chartTitle = document.getElementById("chartTitle");

const COLORS = ["#ebedf0", "#c6e48b", "#7bc96f", "#239a3b", "#196127"]; // 0..4+
const CAP = 4;

// Keep these in sync with CSS
const CELL = 14;
const GAP = 3;
const PITCH = CELL + GAP;

// Tooltip list limits (avoid huge tooltips on very busy days)
const TOOLTIP_MAX_LINES = 18;

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
    alert("PapaParse didn't load. Are you serving the page (http://localhost:8000) and online?");
    return;
  }

  const files = e.dataTransfer?.files;
  if (!files || files.length === 0) return;

  const file = files[0];

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
  const dow = dateUTC.getUTCDay(); // Sun=0..Sat=6
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
  // ym = "YYYY-MM"
  const [y, m] = ym.split("-").map(x => parseInt(x, 10));
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
}

/**
 * Build:
 * - counts: dateKey -> session count
 * - details: dateKey -> array of { player, name }
 * - monthly: monthKey -> session count
 * respecting rolling window + player filter
 */
function buildCountsDetailsMonthly(rows, playerValue) {
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

  if (!maxDate) return { counts: new Map(), details: new Map(), monthly: [], start: null, end: null };

  const end = maxDate;
  const start = addDays(end, -364);

  const counts = new Map();
  const details = new Map();
  const monthlyMap = new Map(); // "YYYY-MM" -> count

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
  }

  // Build a continuous monthly series across the window (including months with 0)
  const months = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const endCursor = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));

  for (let d = new Date(cursor); d <= endCursor; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) {
    const mk = monthKey(d);
    months.push({ month: mk, count: monthlyMap.get(mk) || 0 });
  }

  return { counts, details, monthly: months, start, end };
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
  if (sorted.length > TOOLTIP_MAX_LINES) {
    lines.push(`… +${sorted.length - TOOLTIP_MAX_LINES} more`);
  }

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
   SVG Area Chart (monthly)
----------------------------*/

function clearSvg(svg) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
}

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function renderAreaChart(monthly, playerValue) {
  if (!chartSvg) return;

  clearSvg(chartSvg);

  const W = 980, H = 220;
  const margin = { top: 16, right: 16, bottom: 32, left: 44 };
  const iw = W - margin.left - margin.right;
  const ih = H - margin.top - margin.bottom;

  // Title tweak
  if (chartTitle) {
    chartTitle.textContent = playerValue === "ALL"
      ? "Sessions per month (All players)"
      : `Sessions per month (${playerValue})`;
  }

  if (!monthly || monthly.length === 0) {
    chartSvg.appendChild(svgEl("text", { x: 10, y: 20, class: "axisText" }))
      .textContent = "No data in window.";
    return;
  }

  const maxY = Math.max(...monthly.map(d => d.count), 1);

  const x = (i) => margin.left + (monthly.length === 1 ? 0 : (i * iw) / (monthly.length - 1));
  const y = (v) => margin.top + ih - (v * ih) / maxY;

  // Background grid lines (3)
  const gridLines = 3;
  for (let i = 0; i <= gridLines; i++) {
    const val = (maxY * i) / gridLines;
    const yy = y(val);
    chartSvg.appendChild(svgEl("line", { x1: margin.left, y1: yy, x2: margin.left + iw, y2: yy, class: "gridLine" }));
    const t = svgEl("text", { x: margin.left - 8, y: yy + 4, "text-anchor": "end", class: "axisText" });
    t.textContent = Math.round(val).toString();
    chartSvg.appendChild(t);
  }

  // Build area path
  let dArea = "";
  let dLine = "";

  for (let i = 0; i < monthly.length; i++) {
    const px = x(i);
    const py = y(monthly[i].count);
    dLine += (i === 0 ? `M ${px} ${py}` : ` L ${px} ${py}`);
  }

  const x0 = x(0);
  const xN = x(monthly.length - 1);
  const yBase = margin.top + ih;

  dArea = `${dLine} L ${xN} ${yBase} L ${x0} ${yBase} Z`;

  // Area fill
  chartSvg.appendChild(svgEl("path", {
    d: dArea,
    fill: "rgba(35, 154, 59, 0.20)",
    stroke: "none"
  }));

  // Line stroke
  chartSvg.appendChild(svgEl("path", {
    d: dLine,
    fill: "none",
    stroke: "rgba(35, 154, 59, 0.95)",
    "stroke-width": "2"
  }));

  // X axis labels: show up to ~8 labels
  const maxLabels = 8;
  const step = Math.max(1, Math.ceil(monthly.length / maxLabels));

  for (let i = 0; i < monthly.length; i += step) {
    const px = x(i);
    const label = formatMonthLabel(monthly[i].month);
    const t = svgEl("text", { x: px, y: margin.top + ih + 22, "text-anchor": "middle", class: "axisText" });
    t.textContent = label;
    chartSvg.appendChild(t);
  }

  // Optionally add dots (small)
  for (let i = 0; i < monthly.length; i++) {
    const px = x(i);
    const py = y(monthly[i].count);
    chartSvg.appendChild(svgEl("circle", {
      cx: px, cy: py, r: 2.5,
      fill: "rgba(35, 154, 59, 0.95)"
    }));
  }
}

/* ---------------------------
   Players dropdown + refresh
----------------------------*/

function populatePlayers(rows) {
  const set = new Set();
  for (const r of rows) if (r.player) set.add(r.player);
  const players = Array.from(set).sort();

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

let currentRows = [];

function refresh() {
  const playerValue = playerSelect.value || "ALL";
  const { counts, details, monthly, start, end } = buildCountsDetailsMonthly(currentRows, playerValue);
  if (!start) return;

  renderGrid(counts, details, start, end);
  renderAreaChart(monthly, playerValue);
}

playerSelect.addEventListener("change", refresh);
