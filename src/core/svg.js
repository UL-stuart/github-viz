export function clearSvg(svg) {
  if (!svg) return;
  while (svg.firstChild) svg.removeChild(svg.firstChild);
}

export function svgEl(tag, attrs = {}) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

export function svgText(svg, text, attrs = {}) {
  const t = svgEl("text", attrs);
  t.textContent = text;
  svg.appendChild(t);
  return t;
}