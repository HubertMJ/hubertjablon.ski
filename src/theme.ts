// Loaded as a classic, render-blocking script in <head> so a stored theme choice applies before
// first paint. The same "theme" key as the cluster page, so the choice follows the visitor across pages.
document.documentElement.classList.add("js");

try {
  const t = localStorage.getItem("theme");
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
} catch {
  // Storage blocked (private mode, sandboxed preview): the OS preference applies.
}

// The pages sit side by side like desktops: the landing page (/), then /cluster/, then /lab/. A move
// to a page further right slides the whole screen left, a move back slides it right (styles.css,
// :active-view-transition-type). Set here, in the render-blocking script, because pagereveal fires
// before the first frame of the new page. Any other move keeps the plain cross-fade.
const DESKTOPS = ["/", "/cluster/", "/lab/"];
const desktop = (url: string | undefined): number => {
  if (!url) return -1;
  try {
    const u = new URL(url, location.href);
    if (u.origin !== location.origin) return -1;
    if (u.pathname === "/" || u.pathname === "/index.html") return 0;
    return DESKTOPS.findIndex((p, i) => i > 0 && (u.pathname === p.slice(0, -1) || u.pathname.startsWith(p)));
  } catch {
    return -1;
  }
};
interface Reveal extends Event {
  viewTransition?: { types?: Set<string> } | null;
}
addEventListener("pagereveal", (e) => {
  const types = (e as Reveal).viewTransition?.types;
  if (!types) return;
  // The Navigation API knows where the visitor came from, back/forward included; the referrer only
  // for a link followed.
  const nav = (globalThis as { navigation?: { activation?: { from?: { url?: string } | null } } }).navigation;
  const from = desktop(nav?.activation?.from?.url ?? document.referrer);
  const to = desktop(location.href);
  if (from >= 0 && to >= 0 && from !== to) types.add(to > from ? "forward" : "backward");
});

export {};
