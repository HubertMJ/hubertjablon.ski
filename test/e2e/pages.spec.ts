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

  test("About lives here alone: the whole text and the tools; the old #skills link lands on them", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#about .prose p")).toHaveCount(4);
    await expect(page.locator("#about .prose p").first()).toHaveText(/ I love automating things: if I have done something twice, the third time a script does it\.$/);
    await expect(page.locator("#about .skills li").first()).toHaveText("Kubernetes (k3s)");
    await expect(page.locator('a[href="/cluster/#about"]')).toHaveCount(0);
    await page.goto("/#skills");
    await expect(page).toHaveURL(/\/#skills$/);
    await expect(page.locator("#skills")).toBeInViewport();
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

test("moving between the landing page and /lab/ slides like switching desktops: a page opened comes in from the right, going back slides the other way; the header stays", async ({ page }) => {
  await page.goto("/");
  // Read after theme.ts's own pagereveal listener has named the direction.
  await page.addInitScript(() => {
    addEventListener("pagereveal", (e) => {
      const vt = (e as Event & { viewTransition?: { types: Set<string> } | null }).viewTransition;
      setTimeout(() => ((window as unknown as { vt: string }).vt = vt ? [...vt.types].join(",") || "fade" : "none"));
    });
  });
  const vt = () => page.waitForFunction(() => (window as unknown as { vt?: string }).vt).then((h) => h.jsonValue());
  await Promise.all([page.waitForURL("**/lab/"), page.click('a[href="/lab/"]')]);
  expect(await vt()).toBe("forward");
  expect(await page.locator(".site-header").evaluate((el) => getComputedStyle(el).viewTransitionName)).toBe("site-header");
  await Promise.all([page.waitForURL((u) => u.pathname === "/"), page.goBack()]);
  expect(await vt()).toBe("backward");
  // Forward again is a page opened; home by the logo is a way back.
  await Promise.all([page.waitForURL("**/lab/"), page.goForward()]);
  expect(await vt()).toBe("forward");
  await Promise.all([page.waitForURL((u) => u.pathname === "/"), page.locator(".site-header a").first().click()]);
  expect(await vt()).toBe("backward");
  // Reduced motion: no transition at all.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await Promise.all([page.waitForURL("**/lab/"), page.click('a[href="/lab/"]')]);
  expect(await vt()).toBe("none");
});

test("without cross-document view transitions (Firefox) the page slides by hand: opened from the right, home the other way, back included", async ({ page }) => {
  await page.addInitScript(() => {
    delete (Window.prototype as unknown as { onpagereveal?: unknown }).onpagereveal;
    delete (window as unknown as { CSSViewTransitionRule?: unknown }).CSSViewTransitionRule;
    const seen: string[] = [];
    (window as unknown as { slides: string[] }).slides = seen;
    new MutationObserver(() => {
      for (const c of document.documentElement.classList) if (c.startsWith("slide-") && !seen.includes(c)) seen.push(c);
    }).observe(document, { attributes: true, subtree: true, attributeFilter: ["class"] });
  });
  const slides = () => page.evaluate(() => (window as unknown as { slides: string[] }).slides);
  await page.goto("/");
  await page.locator('a[href="/lab/"]').first().scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => scrollY);
  await page.click('a[href="/lab/"]');
  expect(await slides()).toEqual(["slide-out-forward"]);
  await page.waitForURL("**/lab/");
  await expect.poll(slides).toEqual(["slide-in-forward"]);
  await expect.poll(() => page.evaluate(() => document.documentElement.className.includes("slide-"))).toBe(false);
  await Promise.all([page.waitForURL((u) => u.pathname === "/"), page.goBack()]);
  await expect.poll(slides).toContain("slide-in-backward-soft");
  // Back where the visitor left: the slide itself never scrolls.
  expect(Math.abs((await page.evaluate(() => scrollY)) - before)).toBeLessThan(8);
});

test("@firefox Firefox slides by hand: a page opened comes in from the right, going back the other way", async ({ page }) => {
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { slides: string[] }).slides = seen;
    new MutationObserver(() => {
      for (const c of document.documentElement.classList) if (c.startsWith("slide-") && !seen.includes(c)) seen.push(c);
    }).observe(document, { attributes: true, subtree: true, attributeFilter: ["class"] });
  });
  const slides = () => page.evaluate(() => (window as unknown as { slides: string[] }).slides);
  await page.goto("/");
  await page.click('a[href="/lab/"]');
  expect(await slides()).toEqual(["slide-out-forward"]);
  await page.waitForURL("**/lab/");
  await expect.poll(slides).toEqual(["slide-in-forward"]);
  await page.click('.site-header a[href="/"]');
  expect(await slides()).toContain("slide-out-backward");
  await page.waitForURL((u) => u.pathname === "/");
  await expect.poll(slides).toEqual(["slide-in-backward"]);
  // The browser's back button: back to /lab/, then back home.
  await Promise.all([page.waitForURL("**/lab/"), page.goBack()]);
  await Promise.all([page.waitForURL((u) => u.pathname === "/"), page.goBack()]);
  await expect.poll(slides).toContain("slide-in-backward-soft");
});
