import { clearSvg, svgEl, svgText } from "../core/svg.js";
import { CONFIG } from "../core/config.js"

function lerp(a, b, t) { return a + (b - a) * t; }
function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const bigint = parseInt(h, 16);
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}
function rgbToHex({ r, g, b }) {
  const toHex = (n) => n.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Simple gradient: light green -> dark green, with a light grey for zero.
function valueToColor(v, vmax) {
  if (v <= 0) return CONFIG.COLORS[0];
  const t = vmax <= 0 ? 0 : Math.min(1, v / vmax);
  const c0 = hexToRgb(CONFIG.COLORS[2]);
  const c1 = hexToRgb(CONFIG.COLORS[4]);
  const rgb = {
    r: Math.round(lerp(c0.r, c1.r, t)),
    g: Math.round(lerp(c0.g, c1.g, t)),
    b: Math.round(lerp(c0.b, c1.b, t)),
  };
  return rgbToHex(rgb);
}

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
function estimateLabelWFromText(maxChars) { return Math.round(maxChars * 7 + 24); }

export function computeSharedLabelWidth({ lists, maxChars = 44, min = 90, max = 360 }) {
  let longest = 0;
  for (const list of lists) {
    for (const s of list) longest = Math.max(longest, Math.min(String(s).length, maxChars));
  }
  return clamp(estimateLabelWFromText(longest), min, max);
}

function getLayout(monthsCount, labelW) {
  const W_BASE = 980;
  const leftPad = 10;
  const rightPad = 10;
  const topPad = 44;
  const bottomPad = 34;
  const rowH = 22;
  const cellH = 18;
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

export function renderMatrixHeatmap({
  svg,
  titleEl,
  titleText,
  rowLabels,
  rowToMonthMap,
  months,
  labelW,
  valueTitlePrefix,
  formatMonthTick,
}) {
  if (!svg) return;
  clearSvg(svg);
  if (titleEl && titleText) titleEl.textContent = titleText;

  if (!months || months.length === 0) {
    svgText(svg, "No months in window.", { x: 10, y: 20, class: "axisText" });
    return;
  }

  const L = getLayout(months.length, labelW);

  // vmax across visible
  let vmax = 0;
  for (const r of rowLabels) {
    const rm = rowToMonthMap.get(r);
    for (const m of months) vmax = Math.max(vmax, rm ? (rm.get(m) || 0) : 0);
  }

  const neededH = L.topPad + rowLabels.length * L.rowH + L.bottomPad;
  svg.setAttribute("viewBox", `0 0 ${L.W} ${Math.max(240, neededH)}`);

  // Month labels
  for (let j = 0; j < months.length; j++) {
    const mx = L.x0 + j * L.cellW + L.cellW / 2;
    const t = svgEl("text", { x: mx, y: 16, "text-anchor": "middle", class: "axisText" });
    t.textContent = formatMonthTick ? formatMonthTick(months[j]) : months[j];
    svg.appendChild(t);

    // Year markers when Jan
    const [yy, mm] = months[j].split("-").map((x) => parseInt(x, 10));
    if (mm === 1) {
      const ytxt = svgEl("text", { x: mx, y: 28, "text-anchor": "middle", class: "axisText" });
      ytxt.textContent = String(yy);
      svg.appendChild(ytxt);
    }
  }

  // Rows
  const MAX_CHARS = 44;
  for (let i = 0; i < rowLabels.length; i++) {
    const rowNameRaw = rowLabels[i];
    const rowName = String(rowNameRaw);
    const py = L.y0 + i * L.rowH;

    const label = svgEl("text", {
      x: L.leftPad + L.labelW - 8,
      y: py + L.cellH / 2 + 2,
      class: "hmPlayerText",
      "text-anchor": "end",
    });

    const shown = rowName.length > MAX_CHARS ? rowName.slice(0, MAX_CHARS - 1) + "…" : rowName;
    label.textContent = shown;

    // ✅ Patch: show full label on hover (so truncation doesn't lose information)
    const labelTitle = svgEl("title");
    labelTitle.textContent = rowName;
    label.appendChild(labelTitle);

    svg.appendChild(label);

    const rm = rowToMonthMap.get(rowNameRaw); // keep lookup using original key type
    for (let j = 0; j < months.length; j++) {
      const mo = months[j];
      const v = rm ? (rm.get(mo) || 0) : 0;
      const x = L.x0 + j * L.cellW;
      const y = py;

      const rect = svgEl("rect", {
        x,
        y,
        width: L.rectW,
        height: L.cellH,
        rx: 4,
        ry: 4,
        fill: valueToColor(v, vmax),
        stroke: "#e5e7eb",
        "stroke-width": "1",
      });
      const title = svgEl("title");
      title.textContent = `${valueTitlePrefix}: ${rowName} — ${mo}: ${v}`;
      rect.appendChild(title);
      svg.appendChild(rect);

      if (v > 0) {
        svgText(svg, String(v), {
          x: x + L.rectW / 2,
          y: y + L.cellH / 2 + 1,
          class: "hmCellText",
        });
      }
    }
  }

  const legendY = L.y0 + rowLabels.length * L.rowH + 10;
  svgText(svg, vmax > 0 ? `Color scale: 0 → ${vmax}` : "No values in window", {
    x: L.leftPad,
    y: legendY + 12,
    class: "axisText",
  });
}
