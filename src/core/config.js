// Central configuration for the app.

export const CONFIG = {
  // Default CSV to auto-load on page start (must be served over HTTP)
  DEFAULT_CSV_URL: "complexities.csv",

  // GitHub contribution-style heatmap colors (0..CAP)
  //COLORS: ["#ebedf0", "#c6e48b", "#7bc96f", "#239a3b", "#196127"],
  COLORS: ["#F5F7FA", "#D1DCEF", "#A9BEE2", "#83A1D6", "#154EB3"],
  CAP: 4,

  // Keep these in sync with CSS for the calendar grid
  CELL: 14,
  GAP: 3,

  // Tooltip list limits
  TOOLTIP_MAX_LINES: 18,

  // Score metrics for the cumulative score chart
  SCORE_METRICS: [
    "identify_scope",
    "incident_mechanics",
    "external_comms",
    "internal_comms",
    "commanding_the_incident",
  ],

  // Palette used for multi-series line charts
  SERIES_PALETTE: [
    "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd",
    "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf",
    "#393b79", "#637939", "#8c6d31", "#843c39", "#7b4173",
  ],
  AREA_FILL: "rgba(209, 220, 239, 1)",
  LINE_COLOR: "rgba(21, 78, 179, 1)"
};

export const PITCH = CONFIG.CELL + CONFIG.GAP;
