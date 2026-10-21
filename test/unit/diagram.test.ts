import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { narrow, svg, trafficCss, wide } from "../../src/diagram/layout";
import { DESTINATIONS, HOPS } from "../../src/diagram/model";

const readme = readFileSync(join(__dirname, "../../README.md"), "utf8");
const mermaid = readme.split("## How a request reaches it")[1].split("```")[1];

describe("the way in (landing page diagram)", () => {
  it("README's diagram shows every route and every page the model draws", () => {
    for (const d of DESTINATIONS) {
      expect(mermaid, d.route).toContain(`"${d.route}`);
    }
    for (const label of ["Visitor", "Cloudflare edge", "cloudflared ×2", "Cilium Gateway", "This site", "Detection lab", "Work pages"]) expect(mermaid).toContain(label);
    expect(HOPS.map((h) => h.label)).toEqual(["Visitor", "Cloudflare edge", "cloudflared ×2", "Cilium Gateway"]);
  });

  it("the detection lab is its own project, in a colour of its own", () => {
    const lab = DESTINATIONS.find((d) => d.id === "lab");
    expect(lab?.repo).toBe("detection-lab");
    expect(lab?.role).toBe("lab");
    // Four destination colours read on the drawing: this site, the cluster, the lab, the /work/ pages.
    expect(new Set(DESTINATIONS.map((d) => d.role))).toEqual(new Set(["site", "project", "lab", "work"]));
    for (const dr of [wide(), narrow()]) {
      const s = svg(dr);
      expect(s).toContain(`class="em-node em-lab"`);
      expect(s).toContain(`em-dot--lab`);
    }
  });

  it("the /work/ pages are their own path, from their own repository, in a colour of their own", () => {
    const work = DESTINATIONS.find((d) => d.id === "work");
    expect(work).toMatchObject({ route: "/work/", repo: "work-mockups", role: "work", href: "/work/vllm/" });
    for (const dr of [wide(), narrow()]) {
      const s = svg(dr);
      expect(s).toContain(`class="em-node em-work"`);
      expect(s).toContain(`em-dot--work`);
      expect(dr.fan.get("work")?.label).toBe("/work/");
    }
    expect(mermaid).toContain('GW -- "/work/" --> WORK');
  });

  it("every page but this one is a link to it; the page you are on is not a link", () => {
    for (const dr of [wide(), narrow()]) {
      const s = svg(dr);
      expect(s).not.toMatch(/ style=|<style|<script|href="#/);
      for (const d of DESTINATIONS) {
        if (d.href) expect(s).toContain(`<a class="em-link" href="${d.href}" data-node="${d.id}" data-tip="`);
        else expect(s).toContain(`data-node="${d.id}" aria-current="page"`);
      }
      // Every box carries its sentence for ASCII mode's popup.
      expect(s.match(/data-node="/g)?.length).toBe(s.match(/data-tip="[^"]+"/g)?.length);
    }
    expect(DESTINATIONS.find((d) => d.route === "/")?.href).toBeUndefined();
    expect(DESTINATIONS.find((d) => d.route === "/lab/")?.href).toBe("/lab/");
  });

  it("the traffic has a route and keyframes for every page in both drawings", () => {
    const css = trafficCss();
    for (const p of ["em", "emn"]) for (const d of DESTINATIONS) {
      expect(css).toContain(`#${p}-dot-${d.id} { offset-path: path("M`);
      expect(css).toContain(`@keyframes ${p}-tr-${d.id} {`);
    }
  });
});
