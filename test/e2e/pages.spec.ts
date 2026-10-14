import { expect, test } from "@playwright/test";

// The landing page (/) and the detection lab's preview (/lab/), beside the cluster page (/cluster/).

test.describe("landing page and /lab/", () => {
  test("the landing page lists both projects and sends the old single page's links on to /cluster/", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".card")).toHaveCount(2);
    await expect(page.locator(".card--live .card__title a")).toHaveAttribute("href", "/cluster/");
    await expect(page.locator(".card--preview .card__title a")).toHaveAttribute("href", "/lab/");
    await page.goto("/#verify");
    await expect(page).toHaveURL(/\/cluster\/#verify$/);
    await page.goto("/#about");
    await expect(page).toHaveURL(/\/#about$/);
  });

  test("/lab/ renames every copy by default; picking a copy redraws the panel and never scrolls the page", async ({ page }) => {
    await page.goto("/lab/");
    await expect(page.locator(".lab-rename__box")).not.toBeChecked();
    await page.locator(".lab-picker").scrollIntoViewIfNeeded();
    const y = await page.evaluate(() => scrollY);
    await page.evaluate(() => document.querySelector<HTMLButtonElement>('.lab-picker__btn[data-n="4"]')?.click());
    await expect(page.locator(".lab-incident")).toHaveAttribute("data-open", "true");
    await expect(page.locator(".lab-kv__row[data-changed=true]")).toHaveCount(2);
    expect(await page.evaluate(() => scrollY)).toBe(y);
    await page.evaluate(() => document.querySelector<HTMLInputElement>(".lab-rename__box")?.click());
    await expect(page.locator(".lab-kv__row[data-changed=true]")).toHaveCount(1);
    expect(await page.evaluate(() => scrollY)).toBe(y);
  });
});

// The Gateway sends only /, /lab and /site-assets to this image (self-defending-portfolio,
// cluster/infra/site/httproute.yaml); anything else a page loads would be answered by the cluster page.
test("every page loads its scripts and styles from /site-assets/ only", async ({ page }) => {
  for (const path of ["/", "/lab/"]) {
    const local: string[] = [];
    page.on("request", (r) => {
      const u = new URL(r.url());
      if (u.origin === "http://127.0.0.1:4290" && r.resourceType() !== "document") local.push(u.pathname);
    });
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const outside = local.filter((p) => !p.startsWith("/site-assets/") && p !== "/favicon.svg");
    expect(outside, `${path} requests outside /site-assets/`).toEqual([]);
    page.removeAllListeners("request");
  }
});

// "The way in" diagram: every word clear of the boxes it is not in, every box name 10 units from its
// edges, every box inside its zone, and no horizontal scroll, at desktop and phone width.
test("the entry diagram's words fit their boxes and nothing runs past the page", async ({ page }) => {
  await page.goto("/");
  const problems = await page.evaluate(() => {
    const out: string[] = [];
    for (const svg of document.querySelectorAll<SVGSVGElement>("svg.entry-map")) {
      if (getComputedStyle(svg).display === "none") continue;
      const rects = [...svg.querySelectorAll<SVGRectElement>(".em-node rect")].map((e) => e.getBBox());
      const zones = [...svg.querySelectorAll<SVGRectElement>(".em-zone rect")].map((e) => e.getBBox());
      for (const t of svg.querySelectorAll<SVGTextElement>("text")) {
        const b = t.getBBox();
        for (const r of rects) {
          const inside = b.x >= r.x && b.x + b.width <= r.x + r.width && b.y >= r.y && b.y + b.height <= r.y + r.height;
          const overlaps = b.x < r.x + r.width && b.x + b.width > r.x && b.y < r.y + r.height && b.y + b.height > r.y;
          if (overlaps && !inside) out.push(`"${t.textContent}" crosses a box`);
          if (inside && t.classList.contains("em-label") && Math.min(b.x - r.x, r.x + r.width - b.x - b.width) < 10) out.push(`"${t.textContent}" is under 10 from its box's edge`);
        }
      }
      for (const r of rects) if (!zones.some((z) => r.x >= z.x && r.x + r.width <= z.x + z.width)) out.push("a box outside its zone");
    }
    if (document.documentElement.scrollWidth > document.documentElement.clientWidth) out.push("horizontal scroll");
    return out;
  });
  expect(problems).toEqual([]);
});
