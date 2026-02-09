export function qs(id) {
  return document.getElementById(id);
}

export function setDropActive(dropEl, isActive) {
  if (!dropEl) return;
  dropEl.style.borderColor = isActive ? "#999" : "#ccc";
}

// Prevent the browser from opening dropped files outside the drop zone.
export function installGlobalDropGuards() {
  document.addEventListener("dragover", (e) => e.preventDefault());
  document.addEventListener("drop", (e) => e.preventDefault());
}
