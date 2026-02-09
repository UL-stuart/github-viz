import { CONFIG, PITCH } from "../core/config.js";
import { dayKey, sundayOnOrBefore, addDays } from "../core/dates.js";
import { hideTooltip, showTooltip } from "../core/tooltip.js";

export function renderYLabels(yLabelsEl) {
  if (!yLabelsEl) return;
  yLabelsEl.innerHTML = "";
  // Rows are Sun..Sat. Show Mon/Wed/Fri only, GitHub-style.
  const labelsByRow = ["", "Mon", "", "Wed", "", "Fri", ""]; 
  for (const t of labelsByRow) {
    const div = document.createElement("div");
    div.textContent = t;
    yLabelsEl.appendChild(div);
  }
}

export function renderMonthLabels(monthLabelsEl, start, end, firstSunday, nWeeks) {
  if (!monthLabelsEl) return;
  monthLabelsEl.innerHTML = "";
  monthLabelsEl.style.width = `${nWeeks * PITCH - CONFIG.GAP}px`;

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
    monthLabelsEl.appendChild(div);

    lastYear = year;
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }
}

export function formatTooltip(dateKeyStr, items) {
  const n = items.length;
  const header = `${n} session${n === 1 ? "" : "s"} on ${dateKeyStr}`;
  const sorted = items.slice().sort((a, b) => {
    const p = a.player.localeCompare(b.player);
    if (p !== 0) return p;
    return a.name.localeCompare(b.name);
  });
  const lines = sorted
    .slice(0, CONFIG.TOOLTIP_MAX_LINES)
    .map((x) => `• ${x.player} — ${x.name}`);
  if (sorted.length > CONFIG.TOOLTIP_MAX_LINES) {
    lines.push(`… +${sorted.length - CONFIG.TOOLTIP_MAX_LINES} more`);
  }
  return [header, ...lines].join("\n");
}

export function renderCalendarHeatmap({
  gridEl,
  yLabelsEl,
  monthLabelsEl,
  windowLabelEl,
  tooltipEl,
  counts,
  details,
  start,
  end,
}) {
  if (!gridEl) return;

  renderYLabels(yLabelsEl);
  gridEl.innerHTML = "";

  const firstSunday = sundayOnOrBefore(start);
  const last = new Date(end);
  last.setUTCDate(last.getUTCDate() + (6 - last.getUTCDay()));

  const totalDays = Math.floor((last - firstSunday) / (24 * 3600 * 1000)) + 1;
  const nWeeks = Math.ceil(totalDays / 7);

  renderMonthLabels(monthLabelsEl, start, end, firstSunday, nWeeks);

  for (let i = 0; i < totalDays; i++) {
    const d = addDays(firstSunday, i);
    const inWindow = d >= start && d <= end;

    const cell = document.createElement("div");
    cell.className = "cell";

    if (inWindow) {
      const k = dayKey(d);
      const c = counts.get(k) || 0;
      const bucket = Math.min(c, CONFIG.CAP);
      cell.style.background = CONFIG.COLORS[bucket];

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

    gridEl.appendChild(cell);
  }

  if (windowLabelEl) {
    windowLabelEl.textContent = `Window: ${dayKey(start)} → ${dayKey(end)}`;
  }

  // Event delegation for tooltips
  const onMove = (e) => {
    const cell = e.target.closest(".cell");
    if (!cell) return hideTooltip(tooltipEl);
    const text = cell.dataset.tooltip;
    if (!text) return hideTooltip(tooltipEl);
    showTooltip(tooltipEl, text, e.clientX, e.clientY);
  };
  const onLeave = () => hideTooltip(tooltipEl);

  // Ensure we don't accumulate listeners on repeated renders
  gridEl.onmousemove = onMove;
  gridEl.onmouseleave = onLeave;
}
