import { toDateOnlyUTC, parseSessionStart, dayKey, monthKey, addDays, monthSpan } from "../core/dates.js";

export function uniqueValues(rows, field) {
  const s = new Set();
  for (const r of rows) if (r[field]) s.add(String(r[field]));
  return Array.from(s).sort();
}

export function buildAllAggregations(rows, playerValue) {
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
      end: null,
    };
  }

  const end = maxDate;
  const start = addDays(end, -364);
  const months = monthSpan(start, end);

  const counts = new Map();
  const details = new Map();
  const monthlyMap = new Map();
  const playerMonthly = new Map(); // player -> Map(month -> count)
  const drillMonthly = new Map(); // drill -> Map(month -> count)

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

  const monthly = months.map((mk) => ({ month: mk, count: monthlyMap.get(mk) || 0 }));
  return { counts, details, monthly, playerMonthly, drillMonthly, months, start, end };
}

export function buildCumulativeMonthly(monthly) {
  let run = 0;
  return monthly.map((d) => ({ month: d.month, count: (run += (d.count || 0)) }));
}

export function buildCumulativeByKeyByMonth(rows, playerValue, months, start, end, keys) {
  // returns Map(key -> number[] cumulative per month index)
  const monthlySums = new Map();
  for (const k of keys) monthlySums.set(k, new Map());

  for (const r of rows) {
    const d0 = parseSessionStart(r.session_start);
    if (!d0) continue;
    const dateUTC = toDateOnlyUTC(d0);
    if (dateUTC < start || dateUTC > end) continue;

    const p = (r.player ?? "").toString();
    if (playerValue !== "ALL" && p !== playerValue) continue;

    const mk = monthKey(dateUTC);
    for (const k of keys) {
      const v = Number(r[k]);
      if (!Number.isFinite(v)) continue;
      const m = monthlySums.get(k);
      m.set(mk, (m.get(mk) || 0) + v);
    }
  }

  const series = new Map();
  for (const k of keys) {
    const m = monthlySums.get(k);
    let run = 0;
    const arr = months.map((mon) => (run += (m.get(mon) || 0)));
    series.set(k, arr);
  }

  return series;
}

// src/data/aggregations.js

function normalizeHeader(h) {
  if (h == null) return "";
  let s = String(h).trim();

  // Strip wrapping quotes repeatedly
  while (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }

  // Strip any remaining quote runs
  s = s.replace(/^"+|"+$/g, "").trim();
  return s;
}

/**
 * Build a month-by-month matrix for Complexity:* columns.
 *
 * Returns:
 *  - complexityMonthly: Map(complexityName -> Map(month -> sum))
 *  - complexities: string[] (sorted)
 */
export function buildComplexityByMonth(rows, playerValue, months, start, end) {
  // Discover complexity headers from the dataset
  const complexityHeaders = new Set();

  for (const r of rows) {
    for (const k of Object.keys(r)) {
      const nk = normalizeHeader(k);
      if (/^Complexity:\s*/i.test(nk)) complexityHeaders.add(nk);
    }
  }

  const complexities = Array.from(complexityHeaders).sort((a, b) => a.localeCompare(b));
  const complexityMonthly = new Map();
  for (const c of complexities) complexityMonthly.set(c, new Map());

  // Helper: find raw key in a row that corresponds to normalized complexity header
  function findRawKey(row, normalizedKey) {
    for (const k of Object.keys(row)) {
      if (normalizeHeader(k) === normalizedKey) return k;
    }
    return null;
  }

  for (const r of rows) {
    // window filtering uses same rules as your other charts
    const d = new Date(r.session_start);
    if (Number.isNaN(d.getTime())) continue;

    const dateUTC = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    if (dateUTC < start || dateUTC > end) continue;

    const p = (r.player ?? "").toString();
    if (playerValue !== "ALL" && p !== playerValue) continue;

    const mk = `${dateUTC.getUTCFullYear()}-${String(dateUTC.getUTCMonth() + 1).padStart(2, "0")}`;

    for (const c of complexities) {
      const rawKey = findRawKey(r, c);
      if (!rawKey) continue;

      const v = Number(r[rawKey]);
      if (!Number.isFinite(v)) continue;

      const cm = complexityMonthly.get(c);
      cm.set(mk, (cm.get(mk) || 0) + v);
    }
  }

  // Ensure every month exists so the heatmap is rectangular
  for (const c of complexities) {
    const cm = complexityMonthly.get(c);
    for (const m of months) {
      if (!cm.has(m)) cm.set(m, 0);
    }
  }

  return { complexityMonthly, complexities };
}

// src/data/aggregations.js

export function buildCategoryByMonth(rows, playerValue, months, start, end) {
  // Discover category headers
  const categoryHeaders = new Set();

  for (const r of rows) {
    for (const k of Object.keys(r)) {
      const nk = normalizeHeader(k); // reuse your existing normalizeHeader helper
      if (/^Category:\s*/i.test(nk)) categoryHeaders.add(nk);
    }
  }

  const categories = Array.from(categoryHeaders).sort((a, b) => a.localeCompare(b));
  const categoryMonthly = new Map();
  for (const c of categories) categoryMonthly.set(c, new Map());

  function findRawKey(row, normalizedKey) {
    for (const k of Object.keys(row)) {
      if (normalizeHeader(k) === normalizedKey) return k;
    }
    return null;
  }

  for (const r of rows) {
    const d = new Date(r.session_start);
    if (Number.isNaN(d.getTime())) continue;

    const dateUTC = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    if (dateUTC < start || dateUTC > end) continue;

    const p = (r.player ?? "").toString();
    if (playerValue !== "ALL" && p !== playerValue) continue;

    const mk = `${dateUTC.getUTCFullYear()}-${String(dateUTC.getUTCMonth() + 1).padStart(2, "0")}`;

    for (const c of categories) {
      const rawKey = findRawKey(r, c);
      if (!rawKey) continue;

      const v = Number(r[rawKey]);
      if (!Number.isFinite(v)) continue;

      const cm = categoryMonthly.get(c);
      cm.set(mk, (cm.get(mk) || 0) + v);
    }
  }

  // Ensure month completeness
  for (const c of categories) {
    const cm = categoryMonthly.get(c);
    for (const m of months) if (!cm.has(m)) cm.set(m, 0);
  }

  return { categoryMonthly, categories };
}

// src/data/aggregations.js

export function buildCumulativeSeriesFromMonthlyMap(months, monthlyMapByKey) {
  // monthlyMapByKey: Map(key -> Map(month -> value))
  const out = new Map(); // key -> number[]
  let globalMax = 1;

  for (const [key, monthMap] of monthlyMapByKey.entries()) {
    let run = 0;
    const arr = months.map(m => {
      run += (monthMap.get(m) || 0);
      return run;
    });
    out.set(key, arr);
    for (const v of arr) if (v > globalMax) globalMax = v;
  }

  return { series: out, maxY: globalMax };
}

// % completed per month (COMPLETED / total) within the current rolling window
export function buildCompletionRateMonthly(rows, playerValue, months, start, end) {
  const totals = new Map();     // month -> total sessions
  const completed = new Map();  // month -> completed sessions

  for (const r of rows) {
    const d = new Date(r.session_start);
    if (Number.isNaN(d.getTime())) continue;

    const dateUTC = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    if (dateUTC < start || dateUTC > end) continue;

    const p = (r.player ?? "").toString();
    if (playerValue !== "ALL" && p !== playerValue) continue;

    const mk = `${dateUTC.getUTCFullYear()}-${String(dateUTC.getUTCMonth() + 1).padStart(2, "0")}`;

    totals.set(mk, (totals.get(mk) || 0) + 1);

    const status = (r.completion_status ?? "").toString().trim().toUpperCase();
    if (status === "COMPLETED") {
      completed.set(mk, (completed.get(mk) || 0) + 1);
    }
  }

  // Return continuous months array aligned to `months`
  return months.map(m => {
    const t = totals.get(m) || 0;
    const c = completed.get(m) || 0;
    const pct = t === 0 ? 0 : (c / t) * 100;
    return { month: m, pct, completed: c, total: t };
  });
}


