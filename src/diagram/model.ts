// "The way in" (landing page, #entry): what a request passes on its way to each page, as data.
// scripts/build.mjs draws it into the page (layout.ts: a wide and a phone drawing, and the stylesheet
// that moves the traffic along it); a unit test holds README.md's diagram to the same routes.

/** A box's colour: the path every request takes, this site's pages, the self-defending cluster's, the detection lab's. */
export type Role = "path" | "site" | "project" | "lab";

export interface Hop {
  id: string;
  label: string;
  sub?: string;
  /** The edge into this box from the one before it. */
  via?: string;
  /** Drawn dashed: the tunnel is dialled out from inside, not a port open to the internet. */
  tunnel?: boolean;
  zone: "internet" | "k3s";
}

export interface Destination {
  id: string;
  label: string;
  /** The repository it is built from (the box's small line). */
  repo: string;
  role: Exclude<Role, "path">;
  /** The path the Gateway routes here (the edge's label). */
  route: string;
  /** Where a click goes; none for the page the visitor is on. */
  href?: string;
}

/** Visitor to Gateway, in order. */
export const HOPS: Hop[] = [
  { id: "visitor", label: "Visitor", zone: "internet" },
  { id: "edge", label: "Cloudflare edge", sub: "TLS · WAF", via: "HTTPS", zone: "internet" },
  { id: "cloudflared", label: "cloudflared ×2", sub: "no inbound port", via: "tunnel", tunnel: true, zone: "k3s" },
  { id: "gateway", label: "Cilium Gateway", sub: "routes by path", via: "HTTPS", zone: "k3s" },
];

/** Where the Gateway sends each path, top to bottom. */
export const DESTINATIONS: Destination[] = [
  { id: "home", label: "This site", repo: "hubertjablon.ski", role: "site", route: "/" },
  { id: "lab", label: "Detection lab", repo: "detection-lab", role: "lab", route: "/lab/", href: "/lab/" },
  { id: "cluster", label: "Self-defending cluster", repo: "self-defending-portfolio", role: "project", route: "/cluster/", href: "/cluster/" },
  { id: "api", label: "Cluster API", repo: "self-defending-portfolio", role: "project", route: "/cluster/api", href: "/cluster/#verify" },
];

/**
 * Off the request path: where the run /lab/ shows comes from. The detection lab runs once a day, as a
 * CronJob in the cluster (synthetic events) and on an isolated VM (a real run); both write to the SIEM,
 * whose run documents the Cluster API serves read-only. Drawn below the routes, without traffic.
 */
export interface FeedBox {
  id: string;
  label: string;
  sub: string;
  role: Exclude<Role, "path" | "site">;
}

export const FEED: Record<"runner" | "vm" | "siem", FeedBox> = {
  runner: { id: "lab-runner", label: "Lab runner", sub: "daily CronJob", role: "lab" },
  vm: { id: "lab-vm", label: "Lab VM", sub: "a real run, daily", role: "lab" },
  siem: { id: "siem", label: "SIEM + lab validator", sub: "findings → run document", role: "project" },
};

/** The feed's edges' words: into the SIEM, and the run document up to the API. */
export const FEED_EDGES = { runner: "synthetic events", vm: "Sysmon events", api: "lab runs, read-only" } as const;

export const ZONES = {
  internet: { title: "INTERNET", sub: "" },
  k3s: { title: "K3S01", sub: "one VM · Cilium · Argo CD from git", subNarrow: "one VM · Cilium" },
  siem: { title: "SIEM01", sub: "own VM · append-only" },
  lab: { title: "LAB VM", sub: "own VM · egress to the SIEM only", subNarrow: "own VM · isolated" },
} as const;

export const TITLE = "How a request reaches this site";

/** The drawing in words, for a screen reader. */
export function describe(): string {
  const dests = DESTINATIONS.map((d) => `${d.route} to ${d.label.toLowerCase()} (repository ${d.repo})`);
  return (
    "A visitor reaches the Cloudflare edge over HTTPS; a Cloudflare Tunnel carries the request to two cloudflared " +
    "replicas inside the k3s01 VM, which opens no inbound port; the Cilium Gateway routes it by path: " +
    `${dests.join(", ")}. Every box but this site's is a link to its page. Off the request path, the detection lab ` +
    "runs once a day: a CronJob in the cluster sends synthetic events and an isolated VM a real run's Sysmon events " +
    "to the SIEM on its own VM, whose validator writes the run document the Cluster API serves to /lab/, read-only."
  );
}
