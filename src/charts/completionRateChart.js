import { clearSvg, svgEl, svgText } from "../core/svg.js";

function formatMonthLabel(ym) {
  const [y, m] = ym.split("-").map(n => parseInt(n, 10));
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
}

export function renderCompletionRateChart(svg, data, titleEl, titleText) {
  if (!svg) return;
  clearSvg(svg);
  if (titleEl && titleText) titleEl.textContent = titleText;

  const W = 980, H = 220;
  const margin = { top: 16, right: 16, bottom: 32, left: 44 };
  const iw = W - margin.left - margin.right;
  const ih = H - margin.top - margin.bottom;

  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);

  if (!data || data.length === 0) {
    svgText(svg, "No data in window.", { x: 10, y: 20, class: "axisText" });
    return;
  }

  // Y is 0..100%
  const maxY = 100;

  const x = (i) => margin.left + (data.length === 1 ? 0 : (i * iw) / (data.length - 1));
  const y = (v) => margin.top + ih - (v * ih) / maxY;

  // gridlines + y labels at 0/25/50/75/100
  const ticks = [0, 25, 50, 75, 100];
  for (const val of ticks) {
    const yy = y(val);
    svg.appendChild(svgEl("line", { x1: margin.left, y1: yy, x2: margin.left + iw, y2: yy, class: "gridLine" }));
    svg.appendChild(svgEl("text", { x: margin.left - 8, y: yy + 4, "text-anchor": "end", class: "axisText" }))
      .textContent = `${val}%`;
  }

  // Line path
  let dLine = "";
  for (let i = 0; i < data.length; i++) {
    const px = x(i);
    const py = y(data[i].pct);
    dLine += (i === 0 ? `M ${px} ${py}` : ` L ${px} ${py}`);
  }

  // Area path
  const x0 = x(0);
  const xN = x(data.length - 1);
  const yBase = margin.top + ih;
  const dArea = `${dLine} L ${xN} ${yBase} L ${x0} ${yBase} Z`;

  // Use your dark blue as stroke; tweak alpha as you like
  svg.appendChild(svgEl("path", { d: dArea, fill: "rgba(21, 78, 179, 0.20)", stroke: "none" }));
  svg.appendChild(svgEl("path", { d: dLine, fill: "none", stroke: "rgba(21, 78, 179, 0.95)", "stroke-width": "2" }));

  // Dots with tooltip
  for (let i = 0; i < data.length; i++) {
    const px = x(i);
    const py = y(data[i].pct);
    const c = svgEl("circle", { cx: px, cy: py, r: 2.6, fill: "rgba(21, 78, 179, 0.95)" });

    const t = svgEl("title");
    t.textContent = `${formatMonthLabel(data[i].month)}: ${data[i].pct.toFixed(1)}% (${data[i].completed}/${data[i].total}) completed`;
    c.appendChild(t);

    svg.appendChild(c);
  }

  // X labels (sparse)
  const maxLabels = 8;
  const step = Math.max(1, Math.ceil(data.length / maxLabels));
  for (let i = 0; i < data.length; i += step) {
    const t = svgEl("text", { x: x(i), y: margin.top + ih + 22, "text-anchor": "middle", class: "axisText" });
    t.textContent = formatMonthLabel(data[i].month);
    svg.appendChild(t);
  }
}
