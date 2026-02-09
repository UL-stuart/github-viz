// CSV loading helpers.

export function parseCsvText(text) {
  if (typeof Papa === "undefined") {
    throw new Error("PapaParse is not available (Papa is undefined). Ensure you loaded the CDN script.");
  }
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  if (parsed.errors && parsed.errors.length) {
    // Non-fatal; caller may choose to display.
    console.warn("PapaParse errors:", parsed.errors);
  }
  return parsed.data || [];
}

export function loadCsvFile(file) {
  return new Promise((resolve, reject) => {
    if (typeof Papa === "undefined") {
      reject(new Error("PapaParse is not available"));
      return;
    }
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data || []),
      error: (err) => reject(err),
    });
  });
}

export async function loadCsvUrl(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${url}: HTTP ${res.status}`);
  const text = await res.text();
  return parseCsvText(text);
}
