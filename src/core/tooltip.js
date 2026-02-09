export function hideTooltip(tooltipEl) {
  if (!tooltipEl) return;
  tooltipEl.style.display = "none";
}

export function showTooltip(tooltipEl, text, x, y) {
  if (!tooltipEl) return;
  tooltipEl.textContent = text;
  tooltipEl.style.display = "block";

  const pad = 12;
  const maxX = window.innerWidth - 20;
  const maxY = window.innerHeight - 20;

  tooltipEl.style.left = Math.min(x + pad, maxX) + "px";
  tooltipEl.style.top = Math.min(y + pad, maxY) + "px";
}