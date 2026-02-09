import { renderMatrixHeatmap } from "./matrixHeatmap.js";

export function renderDrillMonthHeatmap(svg, titleEl, drillMonthly, months, drills, labelW) {
  renderMatrixHeatmap({
    svg,
    titleEl,
    titleText: "Drill-by-month usage",
    rowLabels: drills,
    rowToMonthMap: drillMonthly,
    months,
    labelW,
    valueTitlePrefix: "Drill",
    formatMonthTick: (ym) => {
      const [yy, mm] = ym.split("-").map((x) => parseInt(x, 10));
      const d = new Date(Date.UTC(yy, mm - 1, 1));
      return d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" });
    },
  });
}
