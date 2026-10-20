// Draws model.ts: the wide drawing (a row, the Gateway fanning out to the pages), the phone's (a
// column, the fan down the left), and the traffic that runs along them. Markup and CSS as strings for
// scripts/build.mjs, so the page carries the drawing before any script runs and builds no DOM for it.
// Colours, fonts and the animation's switch live in styles.css: classes only here.

import { DESTINATIONS, HOPS, TITLE, ZONES, describe, type Destination, type Hop } from "./model";

type Pt = [number, number];
interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface Edge {
  pts: Pt[];
  label: string;
  at: Pt;
  anchor: "start" | "middle";
  tunnel?: boolean;
}
export interface Drawing {
  view: "wide" | "narrow";
  width: number;
  height: number;
  zones: { box: Box; title: string; sub: string }[];
  boxes: Map<string, Box>;
  edges: Edge[];
  /** Per destination, the edge from the Gateway to it. */
  fan: Map<string, Edge>;
}

const cx = (b: Box) => b.x + b.w / 2;
const cy = (b: Box) => b.y + b.h / 2;
/** An arrow stops this short of the box it points at, so the head's tip touches the edge. */
const GAP = 2;

export function wide(): Drawing {
  const boxes = new Map<string, Box>();
  const top = 48;
  const step = 70;
  const h = 54;
  const destBottom = top + step * (DESTINATIONS.length - 1) + h;
  const rowY = (top + destBottom) / 2 - h / 2;
  const xs = [26, 226, 456, 656];
  HOPS.forEach((n, i) => boxes.set(n.id, { x: xs[i], y: rowY, w: 150, h }));
  DESTINATIONS.forEach((d, i) => boxes.set(d.id, { x: 924, y: top + step * i, w: 230, h }));
  const edges: Edge[] = [];
  for (let i = 1; i < HOPS.length; i++) {
    const a = boxes.get(HOPS[i - 1].id) as Box;
    const b = boxes.get(HOPS[i].id) as Box;
    const y = cy(a);
    const x0 = a.x + a.w;
    const x1 = b.x - GAP;
    edges.push({ pts: [[x0, y], [x1, y]], label: HOPS[i].via ?? "", at: [(x0 + x1) / 2, y - 8], anchor: "middle", tunnel: HOPS[i].tunnel });
  }
  const gw = boxes.get("gateway") as Box;
  const trunk = gw.x + gw.w + 28;
  const fan = new Map<string, Edge>();
  for (const d of DESTINATIONS) {
    const b = boxes.get(d.id) as Box;
    const x1 = b.x - GAP;
    fan.set(d.id, { pts: [[gw.x + gw.w, cy(gw)], [trunk, cy(gw)], [trunk, cy(b)], [x1, cy(b)]], label: d.route, at: [(trunk + x1) / 2, cy(b) - 8], anchor: "middle" });
  }
  const zoneH = destBottom + 18 - 10;
  return {
    view: "wide",
    width: 1180,
    height: zoneH + 20,
    zones: [
      { box: { x: 10, y: 10, w: 382, h: zoneH }, title: ZONES.internet.title, sub: ZONES.internet.sub },
      { box: { x: 440, y: 10, w: 730, h: zoneH }, title: ZONES.k3s.title, sub: ZONES.k3s.sub },
    ],
    boxes,
    edges,
    fan,
  };
}

export function narrow(): Drawing {
  const boxes = new Map<string, Box>();
  const x = 120;
  const w = 220;
  const h = 52;
  const gap = 36;
  const internet: Box = { x: 8, y: 8, w: 344, h: 0 };
  let y = internet.y + 32;
  const place = (id: string, dy: number) => {
    boxes.set(id, { x, y, w, h });
    y += h + dy;
  };
  place("visitor", gap);
  place("edge", 0);
  internet.h = y + 16 - internet.y;
  const k3s: Box = { x: 8, y: internet.y + internet.h + gap, w: 344, h: 0 };
  y = k3s.y + 40;
  place("cloudflared", gap);
  place("gateway", 32);
  for (const d of DESTINATIONS) place(d.id, 22);
  y -= 22;
  k3s.h = y + 16 - k3s.y;
  const edges: Edge[] = [];
  for (let i = 1; i < HOPS.length; i++) {
    const a = boxes.get(HOPS[i - 1].id) as Box;
    const b = boxes.get(HOPS[i].id) as Box;
    const y0 = a.y + a.h;
    const y1 = b.y - GAP;
    edges.push({ pts: [[cx(a), y0], [cx(a), y1]], label: HOPS[i].via ?? "", at: [cx(a) + 8, (y0 + y1) / 2 + 4], anchor: "start", tunnel: HOPS[i].tunnel });
  }
  const gw = boxes.get("gateway") as Box;
  const trunk = 20;
  const fan = new Map<string, Edge>();
  for (const d of DESTINATIONS) {
    const b = boxes.get(d.id) as Box;
    const x1 = b.x - GAP;
    fan.set(d.id, { pts: [[gw.x, cy(gw)], [trunk, cy(gw)], [trunk, cy(b)], [x1, cy(b)]], label: d.route, at: [(trunk + x1) / 2, cy(b) - 6], anchor: "middle" });
  }
  return {
    view: "narrow",
    width: 360,
    height: k3s.y + k3s.h + 8,
    zones: [
      { box: internet, title: ZONES.internet.title, sub: ZONES.internet.sub },
      { box: k3s, title: ZONES.k3s.title, sub: ZONES.k3s.subNarrow },
    ],
    boxes,
    edges,
    fan,
  };
}

// ---------- markup ----------

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ESC[c]);
const r1 = (n: number) => String(Math.round(n * 10) / 10);
type Attrs = Record<string, string | number | undefined>;
function el(tag: string, attrs: Attrs, ...children: string[]): string {
  const a = Object.entries(attrs)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => ` ${k}="${esc(typeof v === "number" ? r1(v) : String(v))}"`)
    .join("");
  return children.length ? `<${tag}${a}>${children.join("")}</${tag}>` : `<${tag}${a}/>`;
}
const text = (cls: string, x: number, y: number, s: string, extra: Attrs = {}) => el("text", { class: cls, x, y, ...extra }, esc(s));
const pathD = (pts: Pt[]) => pts.map(([x, y], i) => `${i ? "L" : "M"}${r1(x)} ${r1(y)}`).join(" ");

function edgeMarkup(e: Edge, marker: string): string {
  return (
    el("path", { class: e.tunnel ? "em-edge em-edge--tunnel" : "em-edge", d: pathD(e.pts), "marker-end": `url(#${marker})` }) +
    text("em-edge-label", e.at[0], e.at[1], e.label, { "text-anchor": e.anchor })
  );
}

/** `mark`: the box carries an arrow or a dot at its right; its words centre in the space left of it. */
function boxMarkup(b: Box, label: string, sub: string | undefined, extra: string, mark = false): string {
  const x = mark ? b.x + (b.w - 22) / 2 + 2 : cx(b);
  const lines = sub
    ? text("em-label", x, cy(b) - 6, label) + text("em-sub", x, cy(b) + 14, sub)
    : text("em-label", x, cy(b) + 5, label);
  return el("rect", { x: b.x, y: b.y, width: b.w, height: b.h, rx: 7 }) + lines + extra;
}

function hopMarkup(n: Hop, b: Box): string {
  return el("g", { class: "em-node em-path", "data-node": n.id, "data-tip": n.tip }, boxMarkup(b, n.label, n.sub, ""));
}

function destMarkup(d: Destination, b: Box): string {
  const right = b.x + b.w;
  if (!d.href) {
    // The page the visitor is on: no link (it would only reload or jump), a dot that says "here".
    const here = el("circle", { class: "em-here", cx: right - 15, cy: cy(b), r: 3.5 });
    return el("g", { class: `em-node em-${d.role}`, "data-node": d.id, "aria-current": "page", "data-tip": d.tip }, el("title", {}, esc(`${d.label}: you are here`)), boxMarkup(b, d.label, d.repo, here, true));
  }
  const go = el("path", { class: "em-go", d: `M${r1(right - 17)} ${r1(cy(b) - 5)} l5 5 l-5 5`, "aria-hidden": "true" });
  return el("a", { class: "em-link", href: d.href, "data-node": d.id, "data-tip": d.tip }, el("g", { class: `em-node em-${d.role}` }, boxMarkup(b, d.label, d.repo, go, true)));
}

/** One drawing as an inline <svg>. */
export function svg(dr: Drawing): string {
  const p = dr.view === "wide" ? "em" : "emn";
  const marker = `${p}-arrow`;
  const zones = dr.zones.map((z) =>
    el("g", { class: "em-zone" }, el("rect", { x: z.box.x, y: z.box.y, width: z.box.w, height: z.box.h, rx: 9 }), el("text", { class: "em-zone-title", x: z.box.x + 12, y: z.box.y + 20 }, esc(z.title), el("tspan", { class: "em-zone-sub" }, esc(` ${z.sub}`)))),
  );
  const edges = [...dr.edges, ...dr.fan.values()].map((e) => edgeMarkup(e, marker));
  const dots = DESTINATIONS.map((d) => el("circle", { class: `em-dot em-dot--${d.role}`, id: `${p}-dot-${d.id}`, r: 4 }));
  const nodes = [...HOPS.map((n) => hopMarkup(n, dr.boxes.get(n.id) as Box)), ...DESTINATIONS.map((d) => destMarkup(d, dr.boxes.get(d.id) as Box))];
  return el(
    "svg",
    { class: `entry-map entry-map--${dr.view}`, viewBox: `0 0 ${dr.width} ${dr.height}`, role: "group", "aria-labelledby": `${p}-title ${p}-desc` },
    el("title", { id: `${p}-title` }, esc(TITLE)),
    el("desc", { id: `${p}-desc` }, esc(describe())),
    el("defs", {}, el("marker", { id: marker, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" }, el("path", { class: "em-arrowhead", d: "M0,0 L10,5 L0,10 z" }))),
    ...zones,
    ...edges,
    // Above the edges, under the boxes: a dot sinks into a box and comes out the other side.
    el("g", { class: "em-traffic", "aria-hidden": "true" }, ...dots),
    ...nodes,
  );
}

// ---------- traffic ----------

/**
 * Every 4 s a dot runs from the visitor to one of the pages, each page in turn (16 s round). Its
 * route (offset-path) and timing (keyframes) per drawing, as CSS: the page's CSP allows no style
 * attribute. styles.css shows and runs the dots only when motion is welcome.
 */
export const TRAFFIC = { period: 16, every: 4, travel: 3.2, hop: 0.14 } as const;

function laneCss(dr: Drawing, d: Destination, i: number): string {
  const p = dr.view === "wide" ? "em" : "emn";
  const visitor = dr.boxes.get("visitor") as Box;
  const dest = dr.boxes.get(d.id) as Box;
  // The route: from the visitor's centre along every edge to the page's centre. The pieces between
  // edges run inside a box (hidden): a short hop; the rest of the time is spent on the edges.
  const runs = [...dr.edges, dr.fan.get(d.id) as Edge].map((e) => e.pts);
  const pts: Pt[] = [[cx(visitor), cy(visitor)]];
  const shown: boolean[] = [];
  for (const run of runs) {
    pts.push(run[0]);
    shown.push(false);
    for (const q of run.slice(1)) {
      pts.push(q);
      shown.push(true);
    }
  }
  pts.push([cx(dest), cy(dest)]);
  shown.push(false);
  const lens = shown.map((_, k) => Math.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]));
  const total = lens.reduce((a, b) => a + b, 0);
  const onEdges = lens.reduce((a, l, k) => a + (shown[k] ? l : 0), 0);
  const hidden = shown.filter((s) => !s).length;
  const edgeTime = TRAFFIC.travel - TRAFFIC.hop * hidden;
  const pct = (n: number) => `${Math.round(Math.min(100, Math.max(0, n)) * 100) / 100}%`;
  const start = i * TRAFFIC.every;
  const tp = (s: number) => pct((s / TRAFFIC.period) * 100);
  const frames = [`0%, ${tp(start)} { offset-distance: 0%; opacity: 0; }`, `${tp(start + 0.05)} { opacity: 1; }`];
  let t = start;
  let at = 0;
  lens.forEach((l, k) => {
    t += shown[k] ? (edgeTime * l) / onEdges : TRAFFIC.hop;
    at += l;
    frames.push(`${tp(t)} { offset-distance: ${pct((at / total) * 100)}; }`);
  });
  frames.push(`${tp(start + TRAFFIC.travel + 0.05)}, 100% { offset-distance: 100%; opacity: 0; }`);
  const name = `${p}-tr-${d.id}`;
  return [
    `#${p}-dot-${d.id} { offset-path: path("${pathD(pts)}"); animation-name: ${name}; animation-duration: ${TRAFFIC.period}s; }`,
    `@keyframes ${name} { ${frames.join(" ")} }`,
  ].join("\n");
}

/** The traffic's stylesheet for both drawings (styles.css imports it; the build supplies it). */
export function trafficCss(): string {
  const lanes = [wide(), narrow()].flatMap((dr) => DESTINATIONS.map((d, i) => laneCss(dr, d, i)));
  return ["/* Generated by src/diagram/layout.ts at build time: the routes the entry diagram's traffic runs. */", ...lanes, ""].join("\n");
}
