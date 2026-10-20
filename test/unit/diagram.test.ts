import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { narrow, svg, trafficCss, wide } from "../../src/diagram/layout";
import { DESTINATIONS, FEED, FEED_EDGES, HOPS } from "../../src/diagram/model";

const readme = readFileSync(join(__dirname, "../../README.md"), "utf8");
const mermaid = readme.split("## How a request reaches it")[1].split("```")[1];

describe("the way in (landing page diagram)", () => {
  it("README's diagram shows every route and every page the model draws", () => {
    for (const d of DESTINATIONS) {
      expect(mermaid, d.route).toContain(`"${d.route}`);
    }
    for (const label of ["Visitor", "Cloudflare edge", "cloudflared ×2", "Cilium Gateway", "This site", "Detection lab"]) expect(mermaid).toContain(label);
    expect(HOPS.map((h) => h.label)).toEqual(["Visitor", "Cloudflare edge", "cloudflared ×2", "Cilium Gateway"]);
  });

  it("the detection lab is its own project, in a colour of its own", () => {
    const lab = DESTINATIONS.find((d) => d.id === "lab");
    expect(lab?.repo).toBe("detection-lab");
    expect(lab?.role).toBe("lab");
    // Three destination colours read on the drawing: this site, the cluster, the lab.
    expect(new Set(DESTINATIONS.map((d) => d.role))).toEqual(new Set(["site", "project", "lab"]));
    for (const dr of [wide(), narrow()]) {
      const s = svg(dr);
      expect(s).toContain(`class="em-node em-lab"`);
      expect(s).toContain(`em-dot--lab`);
    }
  });

  it("every page but this one is a link to it; the page you are on is not a link", () => {
    for (const dr of [wide(), narrow()]) {
      const s = svg(dr);
      expect(s).not.toMatch(/ style=|<style|<script|href="#/);
      for (const d of DESTINATIONS) {
        if (d.href) expect(s).toContain(`<a class="em-link" href="${d.href}" data-node="${d.id}">`);
        else expect(s).toContain(`data-node="${d.id}" aria-current="page"`);
      }
    }
    expect(DESTINATIONS.find((d) => d.route === "/")?.href).toBeUndefined();
    expect(DESTINATIONS.find((d) => d.route === "/lab/")?.href).toBe("/lab/");
  });

  it("below the routes, the lab's feed: runner and VM into the SIEM, the SIEM's run documents up to the API; no traffic runs it", () => {
    for (const f of Object.values(FEED)) expect(mermaid).toContain(f.label);
    for (const label of Object.values(FEED_EDGES)) expect(mermaid).toContain(`"${label}"`);
    for (const dr of [wide(), narrow()]) {
      const s = svg(dr);
      for (const f of Object.values(FEED)) expect(s).toContain(`class="em-node em-${f.role}" data-node="${f.id}"`);
      expect(dr.feed).toHaveLength(3);
      expect(dr.feed.every((e) => e.feed)).toBe(true);
      expect((s.match(/class="em-edge em-edge--feed"/g) ?? []).length).toBe(3);
      // The feed's last edge ends at the Cluster API's box.
      const api = dr.boxes.get("api");
      const end = dr.feed[2].pts.at(-1);
      expect(api && end && end[0] >= api.x && end[0] <= api.x + api.w + 2 && end[1] >= api.y && end[1] <= api.y + api.h + 2).toBe(true);
    }
    expect(trafficCss()).not.toContain("lab-vm");
  });

  it("the traffic has a route and keyframes for every page in both drawings", () => {
    const css = trafficCss();
    for (const p of ["em", "emn"]) for (const d of DESTINATIONS) {
      expect(css).toContain(`#${p}-dot-${d.id} { offset-path: path("M`);
      expect(css).toContain(`@keyframes ${p}-tr-${d.id} {`);
    }
  });
});
