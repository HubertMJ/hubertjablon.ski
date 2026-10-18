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
    for (const label of ["Visitor", "Cloudflare edge", "cloudflared ×2", "Cilium Gateway", "This site", "Detection lab"]) expect(mermaid).toContain(label);
    expect(HOPS.map((h) => h.label)).toEqual(["Visitor", "Cloudflare edge", "cloudflared ×2", "Cilium Gateway"]);
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

  it("the traffic has a route and keyframes for every page in both drawings", () => {
    const css = trafficCss();
    for (const p of ["em", "emn"]) for (const d of DESTINATIONS) {
      expect(css).toContain(`#${p}-dot-${d.id} { offset-path: path("M`);
      expect(css).toContain(`@keyframes ${p}-tr-${d.id} {`);
    }
  });
});
