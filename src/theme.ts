// Loaded as a classic, render-blocking script in <head> so a stored theme choice applies before
// first paint. The same "theme" key as the cluster page, so the choice follows the visitor across pages.
document.documentElement.classList.add("js");

try {
  const t = localStorage.getItem("theme");
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
} catch {
  // Storage blocked (private mode, sandboxed preview): the OS preference applies.
}

export {};
