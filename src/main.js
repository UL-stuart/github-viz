import { qs, setDropActive, installGlobalDropGuards } from "./core/dom.js";
import { CONFIG } from "./core/config.js";
import { loadCsvFile, loadCsvUrl } from "./data/loader.js";
import { uniqueValues, buildAllAggregations, buildCumulativeMonthly, buildCumulativeByKeyByMonth } from "./data/aggregations.js";
import { renderCalendarHeatmap } from "./charts/calendarHeatmap.js";
import { renderAreaChart } from "./charts/areaChart.js";
import { renderCumulativeChart } from "./charts/cumulativeChart.js";
import { renderCumulativeMetricsChart } from "./charts/cumulativeMetricsChart.js";
import { renderCumulativeByPlayerChart } from "./charts/cumulativeByPlayerChart.js";
import { renderPlayerMonthHeatmap } from "./charts/playerMonthHeatmap.js";
import { renderDrillMonthHeatmap } from "./charts/drillMonthHeatmap.js";
import { buildComplexityByMonth } from "./data/aggregations.js";
import { renderComplexityMonthHeatmap } from "./charts/complexityMonthHeatmap.js";
import { buildCategoryByMonth } from "./data/aggregations.js";
import { renderCategoryMonthHeatmap } from "./charts/categoryMonthHeatmap.js";
import { buildCumulativeSeriesFromMonthlyMap } from "./data/aggregations.js";
import { renderCumulativeCategoryTotalsChart } from "./charts/cumulativeCategoryTotalsChart.js";



const els = {
  drop: qs("drop"),
  grid: qs("grid"),
  yLabels: qs("yLabels"),
  monthLabels: qs("monthLabels"),
  playerSelect: qs("playerSelect"),
  windowLabel: qs("windowLabel"),
  tooltip: qs("tooltip"),

  areaChart: qs("areaChart"),
  cumulativeChart: qs("cumulativeChart"),
  cumulativeMetricsChart: qs("cumulativeMetricsChart"),
  cumulativeByPlayerChart: qs("cumulativeByPlayerChart"),

  playerMonthHeatmap: qs("playerMonthHeatmap"),
  drillMonthHeatmap: qs("drillMonthHeatmap"),
  complexityMonthHeatmap: qs("complexityMonthHeatmap"),
  categoryMonthHeatmap: qs("categoryMonthHeatmap"),
  cumulativeCategoryChart: qs("cumulativeCategoryChart"),



  // optional title elements (if present)
  chartTitle: qs("chartTitle"),
  cumTitle: qs("cumTitle"),
  cumMetricsTitle: qs("cumMetricsTitle"),
  cumByPlayerTitle: qs("cumByPlayerTitle"),
  hmTitle: qs("hmTitle"),
  drillHmTitle: qs("drillHmTitle"),
  complexityHmTitle: qs("complexityHmTitle"),
  categoryHmTitle: qs("categoryHmTitle"),
  cumulativeCategoryTitle: qs("cumulativeCategoryTitle")
};

let currentRows = [];

/* ---------------------------
   UI wiring
----------------------------*/

function populatePlayers(rows) {
  if (!els.playerSelect) return;

  const players = uniqueValues(rows, "player");

  els.playerSelect.innerHTML = "";
  const optAll = document.createElement("option");
  optAll.value = "ALL";
  optAll.textContent = "All players";
  els.playerSelect.appendChild(optAll);

  for (const p of players) {
    const o = document.createElement("option");
    o.value = p;
    o.textContent = p;
    els.playerSelect.appendChild(o);
  }
}

function estimateLabelWFromText(maxChars) {
  // Same heuristic as the monolith: ~7px/char + padding
  return Math.round(maxChars * 7 + 36);
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function refresh() {
  const playerValue = els.playerSelect?.value || "ALL";
  const allPlayersList = uniqueValues(currentRows, "player");

  const {
    counts, details, monthly, playerMonthly, drillMonthly, months, start, end
  } = buildAllAggregations(currentRows, playerValue);

  // --- Core charts require a valid window ---
  if (!start || !end) return;

  // Complexities heatmap
  const { complexityMonthly, complexities } =
    buildComplexityByMonth(currentRows, playerValue, months, start, end);

  // Cumulative drills by player (multi-line)
  const playersShown = (playerValue === "ALL") ? allPlayersList.slice() : [playerValue];  

  // Shared label width for matrix heatmaps so they align perfectly
  const drillsShown = Array.from(drillMonthly.keys());
  const MAX_CHARS = 44;
  const maxChars = Math.max(
    0,
    ...playersShown.map(s => Math.min(String(s).length, MAX_CHARS)),
    ...drillsShown.map(s => Math.min(String(s).length, MAX_CHARS))
  );  

  const sharedLabelW = clamp(estimateLabelWFromText(maxChars), 90, 340);

  const { categoryMonthly, categories } =
  buildCategoryByMonth(currentRows, playerValue, months, start, end);


  // cumulative series per category
  const { series: categoryCumSeries } =
    buildCumulativeSeriesFromMonthlyMap(months, categoryMonthly);

  renderCumulativeCategoryTotalsChart(
    els.cumulativeCategoryChart,
    months,
    categoryCumSeries,
    els.cumulativeCategoryTitle
  );


  renderCategoryMonthHeatmap(
    els.categoryMonthHeatmap,
    els.categoryHmTitle,
    categoryMonthly,
    months,
    categories,
    sharedLabelW
  );

  renderComplexityMonthHeatmap(
    els.complexityMonthHeatmap,
    els.complexityHmTitle,
    complexityMonthly,
    months,
    complexities,
    sharedLabelW
  );


  // Calendar heatmap
  renderCalendarHeatmap({
    gridEl: els.grid,
    yLabelsEl: els.yLabels,
    monthLabelsEl: els.monthLabels,
    windowLabelEl: els.windowLabel,
    tooltipEl: els.tooltip,
    counts, details, start, end,
  });

  // Monthly area
  renderAreaChart(
    els.areaChart,
    monthly,
    els.chartTitle,
    playerValue === "ALL" ? "Sessions per month (All players)" : `Sessions per month (${playerValue})`
  );

  // Cumulative drills per month
  renderCumulativeChart(
    els.cumulativeChart,
    buildCumulativeMonthly(monthly),
    els.cumTitle,
    playerValue === "ALL" ? "Cumulative drills per month (All players)" : `Cumulative drills per month (${playerValue})`
  );

  // Cumulative score totals by month (only if columns exist)
  const series = buildCumulativeByKeyByMonth(
    currentRows,
    playerValue,
    months,
    start,
    end,
    CONFIG.SCORE_METRICS
  );
  renderCumulativeMetricsChart(
    els.cumulativeMetricsChart,
    months,
    series,
    els.cumMetricsTitle,
    playerValue === "ALL" ? "Cumulative score totals by month (All players)" : `Cumulative score totals by month (${playerValue})`
  );

  
  renderCumulativeByPlayerChart(
    els.cumulativeByPlayerChart,
    playerMonthly,
    months,
    playersShown
  );

  
  

  // Matrix heatmaps
  renderPlayerMonthHeatmap(
    els.playerMonthHeatmap,
    els.hmTitle,
    playerMonthly,
    months,
    playersShown,
    sharedLabelW
  );

  renderDrillMonthHeatmap(
    els.drillMonthHeatmap,
    els.drillHmTitle,
    drillMonthly,
    months,
    drillsShown,
    sharedLabelW
  );
}

async function loadRows(rows) {
  currentRows = rows || [];
  populatePlayers(currentRows);
  refresh();
}

function installDropZone() {
  if (!els.drop) return;

  installGlobalDropGuards();

  els.drop.addEventListener("dragenter", (e) => { e.preventDefault(); setDropActive(els.drop, true); });
  els.drop.addEventListener("dragover", (e) => { e.preventDefault(); setDropActive(els.drop, true); });
  els.drop.addEventListener("dragleave", (e) => { e.preventDefault(); setDropActive(els.drop, false); });

  els.drop.addEventListener("drop", async (e) => {
    e.preventDefault();
    setDropActive(els.drop, false);

    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;

    try {
      const rows = await loadCsvFile(files[0]);
      await loadRows(rows);
    } catch (err) {
      console.error(err);
      alert("Failed to parse CSV. Check console for details.");
    }
  });
}

function installPlayerSelect() {
  if (!els.playerSelect) return;
  els.playerSelect.addEventListener("change", refresh);
}

async function boot() {
  installDropZone();
  installPlayerSelect();

  // Try loading default CSV, but don't hard fail.
  if (CONFIG.DEFAULT_CSV_URL) {
    try {
      const rows = await loadCsvUrl(CONFIG.DEFAULT_CSV_URL);
      await loadRows(rows);
    } catch (err) {
      console.warn("Default CSV load failed:", err);
    }
  }
}

boot();
