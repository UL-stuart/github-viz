export function toDateOnlyUTC(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function parseSessionStart(value) {
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

export function dayKey(dateUTC) {
  const y = dateUTC.getUTCFullYear();
  const m = String(dateUTC.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dateUTC.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function monthKey(dateUTC) {
  const y = dateUTC.getUTCFullYear();
  const m = String(dateUTC.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function sundayOnOrBefore(dateUTC) {
  const dow = dateUTC.getUTCDay();
  const out = new Date(dateUTC);
  out.setUTCDate(out.getUTCDate() - dow);
  return out;
}

export function addDays(dateUTC, n) {
  const out = new Date(dateUTC);
  out.setUTCDate(out.getUTCDate() + n);
  return out;
}

export function formatMonthLabel(ym) {
  const [y, m] = ym.split("-").map((x) => parseInt(x, 10));
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
}

export function diffDays(a, b) {
  return Math.floor((b - a) / (24 * 3600 * 1000));
}

export function monthSpan(start, end) {
  const months = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const endCursor = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  for (
    let d = new Date(cursor);
    d <= endCursor;
    d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
  ) {
    months.push(monthKey(d));
  }
  return months;
}
