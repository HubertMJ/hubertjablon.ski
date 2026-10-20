// Draws model.ts: the wide drawing (a row, the Gateway fanning out to the pages), the phone's (a
// column, the fan down the left), and the traffic that runs along them. Markup and CSS as strings for
// scripts/build.mjs, so the page carries the drawing before any script runs and builds no DOM for it.
// Colours, fonts and the animation's switch live in styles.css: classes only here.

import { DESTINATIONS, FEED, FEED_EDGES, HOPS, TITLE, ZONES, describe, type Destination, type FeedBox, type Hop } from "./model";

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
  anchor: "start" | "middle" | "end";
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
  /** The lab's feed (model.ts FEED): off the request path, so no traffic runs it. */
  feed: Edge[];
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
  // The feed: the runner under the Gateway, beside the fan's trunk; a band below for the lab VM and the
  // SIEM, the SIEM under the Cluster API it answers.
  const api = boxes.get("api") as Box;
  const runner: Box = { x: gw.x, y: api.y, w: 150, h };
  const bandY = 10 + zoneH + 20;
  const siem: Box = { x: api.x, y: bandY + 38, w: api.w, h };
  const vm: Box = { x: 26, y: siem.y, w: 200, h };
  boxes.set(FEED.runner.id, runner);
  boxes.set(FEED.siem.id, siem);
  boxes.set(FEED.vm.id, vm);
  const into = cy(siem) - 18;
  const feed: Edge[] = [
    { pts: [[cx(runner), runner.y + h], [cx(runner), into], [siem.x - GAP, into]], label: FEED_EDGES.runner, at: [cx(runner) + 8, bandY - 5], anchor: "start" },
    { pts: [[vm.x + vm.w, cy(vm)], [siem.x - GAP, cy(siem)]], label: FEED_EDGES.vm, at: [(vm.x + vm.w + siem.x) / 2, cy(siem) - 8], anchor: "middle" },
    // Right of the SIEM zone's title, its words to the left.
    { pts: [[siem.x + siem.w - 30, siem.y], [siem.x + siem.w - 30, api.y + h + GAP]], label: FEED_EDGES.api, at: [siem.x + siem.w - 38, bandY - 5], anchor: "end" },
  ];
  const bandH = siem.y + h + 16 - bandY;
  return {
    view: "wide",
    width: 1180,
    height: bandY + bandH + 10,
    zones: [
      { box: { x: 10, y: 10, w: 382, h: zoneH }, title: ZONES.internet.title, sub: ZONES.internet.sub },
      { box: { x: 440, y: 10, w: 730, h: zoneH }, title: ZONES.k3s.title, sub: ZONES.k3s.sub },
      { box: { x: 10, y: bandY, w: 382, h: bandH }, title: ZONES.lab.title, sub: ZONES.lab.sub },
      { box: { x: siem.x - 16, y: bandY, w: 1170 - siem.x + 16, h: bandH }, title: ZONES.siem.title, sub: ZONES.siem.sub },
    ],
    boxes,
    edges,
    fan,
    feed,
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
  // The feed, under the routes: the runner in the cluster, then the SIEM and the lab VM in zones of their own.
  y += 14;
  place(FEED.runner.id, 0);
  k3s.h = y + 16 - k3s.y;
  const siemZone: Box = { x: 8, y: k3s.y + k3s.h + 40, w: 344, h: 0 };
  y = siemZone.y + 32;
  place(FEED.siem.id, 0);
  siemZone.h = y + 16 - siemZone.y;
  const labZone: Box = { x: 8, y: siemZone.y + siemZone.h + 40, w: 344, h: 0 };
  y = labZone.y + 32;
  place(FEED.vm.id, 0);
  labZone.h = y + 16 - labZone.y;
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
  const runner = boxes.get(FEED.runner.id) as Box;
  const siem = boxes.get(FEED.siem.id) as Box;
  const vm = boxes.get(FEED.vm.id) as Box;
  const api = boxes.get("api") as Box;
  const right = siem.x + siem.w + 10;
  const feed: Edge[] = [
    { pts: [[cx(runner), runner.y + h], [cx(runner), siem.y - GAP]], label: FEED_EDGES.runner, at: [cx(runner) + 8, (runner.y + h + siem.y) / 2 + 4], anchor: "start" },
    { pts: [[cx(vm), vm.y], [cx(vm), siem.y + h + GAP]], label: FEED_EDGES.vm, at: [cx(vm) + 8, (siem.y + h + vm.y) / 2 + 4], anchor: "start" },
    // Up the right margin, too narrow for its words.
    { pts: [[siem.x + siem.w, cy(siem)], [right, cy(siem)], [right, cy(api)], [api.x + api.w + GAP, cy(api)]], label: "", at: [right, cy(api)], anchor: "start" },
  ];
  return {
    view: "narrow",
    width: 360,
    height: labZone.y + labZone.h + 8,
    zones: [
      { box: internet, title: ZONES.internet.title, sub: ZONES.internet.sub },
      { box: k3s, title: ZONES.k3s.title, sub: ZONES.k3s.subNarrow },
      { box: siemZone, title: ZONES.siem.title, sub: ZONES.siem.sub },
      { box: labZone, title: ZONES.lab.title, sub: ZONES.lab.subNarrow },
    ],
    boxes,
    edges,
    fan,
    feed,
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
    (e.label ? text("em-edge-label", e.at[0], e.at[1], e.label, { "text-anchor": e.anchor }) : "")
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
  return el("g", { class: "em-node em-path", "data-node": n.id }, boxMarkup(b, n.label, n.sub, ""));
}

function feedMarkup(f: FeedBox, b: Box): string {
  return el("g", { class: `em-node em-${f.role}`, "data-node": f.id }, boxMarkup(b, f.label, f.sub, ""));
}

function destMarkup(d: Destination, b: Box): string {
  const right = b.x + b.w;
  if (!d.href) {
    // The page the visitor is on: no link (it would only reload or jump), a dot that says "here".
    const here = el("circle", { class: "em-here", cx: right - 15, cy: cy(b), r: 3.5 });
    return el("g", { class: `em-node em-${d.role}`, "data-node": d.id, "aria-current": "page" }, el("title", {}, esc(`${d.label}: you are here`)), boxMarkup(b, d.label, d.repo, here, true));
  }
  const go = el("path", { class: "em-go", d: `M${r1(right - 17)} ${r1(cy(b) - 5)} l5 5 l-5 5`, "aria-hidden": "true" });
  return el("a", { class: "em-link", href: d.href, "data-node": d.id }, el("g", { class: `em-node em-${d.role}` }, boxMarkup(b, d.label, d.repo, go, true)));
}

/** One drawing as an inline <svg>. */
export function svg(dr: Drawing): string {
  const p = dr.view === "wide" ? "em" : "emn";
  const marker = `${p}-arrow`;
  const zones = dr.zones.map((z) =>
    el("g", { class: "em-zone" }, el("rect", { x: z.box.x, y: z.box.y, width: z.box.w, height: z.box.h, rx: 9 }), el("text", { class: "em-zone-title", x: z.box.x + 12, y: z.box.y + 20 }, esc(z.title), el("tspan", { class: "em-zone-sub" }, esc(` ${z.sub}`)))),
  );
  const edges = [...dr.edges, ...dr.fan.values(), ...dr.feed].map((e) => edgeMarkup(e, marker));
  const dots = DESTINATIONS.map((d) => el("circle", { class: `em-dot em-dot--${d.role}`, id: `${p}-dot-${d.id}`, r: 4 }));
  const nodes = [
    ...HOPS.map((n) => hopMarkup(n, dr.boxes.get(n.id) as Box)),
    ...DESTINATIONS.map((d) => destMarkup(d, dr.boxes.get(d.id) as Box)),
    ...Object.values(FEED).map((f) => feedMarkup(f, dr.boxes.get(f.id) as Box)),
  ];
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
