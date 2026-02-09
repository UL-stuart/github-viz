import { renderMatrixHeatmap } from "./matrixHeatmap.js";

export function renderPlayerMonthHeatmap(svg, titleEl, playerMonthly, months, players, labelW) {
  renderMatrixHeatmap({
    svg,
    titleEl,
    titleText: "Player-by-month usage",
    rowLabels: players,
    rowToMonthMap: playerMonthly,
    months,
    labelW,
    valueTitlePrefix: "Player",
    formatMonthTick: (ym) => {
      const [yy, mm] = ym.split("-").map((x) => parseInt(x, 10));
      const d = new Date(Date.UTC(yy, mm - 1, 1));
      return d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" });
    },
  });
}
