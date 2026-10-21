import { expect, test } from "@playwright/test";

// This repository serves only the landing page (/). The detection lab (/lab/) and the cluster
// (/cluster/) come from other repositories' images; the Gateway serves them at those same-origin
// paths. For the slide tests, scripts/serve.mjs --e2e stands them in with this site's own head, so a
// cross-document transition to one runs under the real stylesheet and scripts, exactly as it does
// live (a real served page, so it works in Firefox too, where route interception misses navigations).

test.describe("landing page", () => {
  test("the landing page lists both projects and sends the old single page's links on to /cluster/", async ({ page }) => {
    await page.goto("/");
    // Five equal project cards, in order: the two live ones, then three systems from work (under /work/).
    await expect(page.locator("#projects .card")).toHaveCount(5);
    expect(await page.locator("#projects .card__title a").evaluateAll((as) => as.map((a) => a.getAttribute("href")))).toEqual(["/cluster/", "/lab/", "/work/vllm/", "/work/bridge/", "/work/flota/"]);
    await expect(page.locator("#projects .card__status")).toHaveText(["Live", "Live", "Mock-up", "How it works", "Tool"]);
    expect(await page.locator("#projects .card__actions a:last-child").evaluateAll((as) => as.slice(2).map((a) => a.textContent))).toEqual(["Open the mock-up", "How it works", "How it works"]);
    await expect(page.locator("#work")).toHaveCount(0);
    await expect(page.locator('.site-nav a[href="#work"]')).toHaveCount(0);
    // Both projects are live now, so match each card by its link, not its status class.
    await expect(page.locator('.card--live .card__title a[href="/cluster/"]')).toHaveCount(1);
    await expect(page.locator('.card--live .card__title a[href="/lab/"]')).toHaveCount(1);
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

});

// The Gateway sends only / and /site-assets to this image (self-defending-portfolio,
// cluster/infra/site/httproute.yaml); anything else a page loads would be answered by the cluster page.
test("every page loads its scripts and styles from /site-assets/ only", async ({ page }) => {
  for (const path of ["/"]) {
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
// edges, every box inside its zone, no arrow through a box, no label on a line or another label, and
// no horizontal scroll, at desktop and phone width.
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
      // No arrow runs through a box: it leaves one at its edge and stops at the next one's.
      for (const e of svg.querySelectorAll<SVGPathElement>(".em-edge")) {
        for (let l = 0; l <= e.getTotalLength(); l += 2) {
          const p = e.getPointAtLength(l);
          if (rects.some((r) => p.x > r.x + 1 && p.x < r.x + r.width - 1 && p.y > r.y + 1 && p.y < r.y + r.height - 1)) {
            out.push(`an arrow runs through a box at ${Math.round(p.x)},${Math.round(p.y)}`);
            break;
          }
        }
      }
      // Edge labels clear of each other and of the lines.
      const labels = [...svg.querySelectorAll<SVGTextElement>(".em-edge-label")].map((t) => [t.textContent, t.getBBox()] as const);
      for (const [i, [a, ba]] of labels.entries()) {
        for (const [b, bb] of labels.slice(i + 1)) if (ba.x < bb.x + bb.width && ba.x + ba.width > bb.x && ba.y < bb.y + bb.height && ba.y + ba.height > bb.y) out.push(`"${a}" overlaps "${b}"`);
        for (const e of svg.querySelectorAll<SVGPathElement>(".em-edge")) {
          for (let l = 0; l <= e.getTotalLength(); l += 2) {
            const p = e.getPointAtLength(l);
            if (p.x > ba.x && p.x < ba.x + ba.width && p.y > ba.y && p.y < ba.y + ba.height) {
              out.push(`"${a}" sits on a line`);
              break;
            }
          }
        }
      }
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
  await expect.poll(slides).toContain("slide-in-backward");
  // Back where the visitor left: the slide itself never scrolls.
  expect(Math.abs((await page.evaluate(() => scrollY)) - before)).toBeLessThan(8);
  // A box in "The way in" diagram (an <a> inside the SVG) slides the same way.
  await page.goto("/");
  await page.evaluate(() => ((window as unknown as { slides: string[] }).slides.length = 0));
  await page.locator('svg.entry-map:visible a[data-node="lab"]').click();
  expect(await slides()).toEqual(["slide-out-forward"]);
  await page.waitForURL("**/lab/");
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
  await expect.poll(slides).toContain("slide-in-backward");
});

// "The way in" diagram, drawn from src/diagram at build time: a dot runs each route (CSS only, not
// with reduced motion), every page but this one is a link that slides its page in, and the page itself
// never moves.
test.describe("the way in", () => {
  const visible = "svg.entry-map:visible";
  const dots = (page: import("@playwright/test").Page) =>
    page.locator(`${visible} .em-dot`).evaluateAll((ds) => ds.map((d) => `${getComputedStyle(d).display}:${d.getAnimations().map((a) => a.playState).join(",")}`));

  test("a dot runs each route; none with reduced motion", async ({ page }) => {
    await page.goto("/");
    // One dot per page the Gateway routes to: this site, the lab, the /work/ pages, the cluster and its API.
    expect(await dots(page)).toEqual(Array(5).fill("inline:running"));
    // It moves: two looks a moment apart see it somewhere else.
    const at = () => page.locator(`${visible} .em-dot`).first().evaluate((d) => d.getBoundingClientRect().x);
    await page.locator(visible).scrollIntoViewIfNeeded();
    await page.waitForTimeout(900);
    const x0 = await at();
    await page.waitForTimeout(400);
    expect(await at()).not.toBe(x0);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();
    expect(await dots(page)).toEqual(Array(5).fill("none:"));
  });

  test("every box but this page's opens its page, sliding in from the right; this page's is not a link", async ({ page }) => {
    // The lab and the cluster come from other repositories' images: stand-ins with this site's head,
    // so the cross-document transition to each runs as it does live.
    await page.goto("/");
    await page.addInitScript(() => {
      addEventListener("pagereveal", (e) => {
        const vt = (e as Event & { viewTransition?: { types: Set<string> } | null }).viewTransition;
        setTimeout(() => ((window as unknown as { vt: string }).vt = vt ? [...vt.types].join(",") || "fade" : "none"));
      });
    });
    const want: Record<string, RegExp> = { lab: /\/lab\/$/, cluster: /\/cluster\/$/, api: /\/cluster\/#verify$/ };
    for (const [node, url] of Object.entries(want)) {
      await page.goto("/");
      const link = page.locator(`${visible} a[data-node="${node}"]`);
      await link.scrollIntoViewIfNeeded();
      await Promise.all([page.waitForURL(url), link.click()]);
      expect(await page.waitForFunction(() => (window as unknown as { vt?: string }).vt).then((h) => h.jsonValue()), node).toBe("forward");
    }
    await page.goto("/");
    const here = page.locator(`${visible} [data-node="home"]`);
    await expect(here).toHaveAttribute("aria-current", "page");
    expect(await here.evaluate((g) => g.closest("a"))).toBeNull();
    await here.scrollIntoViewIfNeeded();
    const y = await page.evaluate(() => scrollY);
    await here.click();
    await page.waitForTimeout(300);
    expect(page.url()).toMatch(/\/$/);
    expect(await page.evaluate(() => scrollY)).toBe(y);
  });

  test("the page loads where it starts, without a console error, inline style or policy violation", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.addInitScript(() => {
      addEventListener("securitypolicyviolation", (e) => console.error(`CSP: ${e.violatedDirective} ${e.blockedURI}`));
    });
    for (const path of ["/"]) {
      const res = await page.goto(path);
      expect(res?.headers()["content-security-policy"]).toContain("require-trusted-types-for 'script'");
      await page.waitForTimeout(1200);
      expect(await page.evaluate(() => scrollY), `${path} scrolled by itself`).toBe(0);
      // As served (a script may still set a size through the CSSOM, which the CSP allows).
      expect(await res?.text(), `${path} inline styles`).not.toMatch(/<style|\sstyle=/);
    }
    expect(errors).toEqual([]);
  });
});

// ASCII mode, the site's hidden terminal look (src/ascii): off by default, on by a link or by typing
// "ascii", remembered across visits; the entry diagram becomes a character drawing that fits the page.
test("ASCII mode: a link turns it on, the diagram is drawn in characters, typing ascii turns it off and it is remembered", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => { if (r.status() >= 400 && !/\/(cluster|lab)\//.test(r.url())) errors.push(`${r.status()} ${r.url()}`); });
  await page.goto("/");
  await expect(page.locator("html")).not.toHaveClass(/ascii/);
  await expect(page.locator("pre.ascii-dg")).toHaveCount(0);
  await page.goto("/?ascii=1");
  await expect(page.locator("html")).toHaveClass(/ascii/);
  const dg = page.locator("pre.ascii-dg:not([hidden])");
  await expect(dg).toHaveCount(1);
  await expect(dg).toContainText("Cloudflare edge");
  await expect(dg).toContainText("Detection lab");
  await expect(dg).toContainText("Work pages");
  await expect(page.locator(".ascii-banner")).toBeVisible();
  // Sized once its font is in (a frame later at most).
  await expect.poll(() => dg.evaluate((el) => el.scrollWidth <= (el.parentElement as HTMLElement).clientWidth + 1)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  // With a pointer that hovers, a box's short words pop up beside it.
  if (test.info().project.name === "desktop") {
    await dg.evaluate((pre) => pre.scrollIntoView({ block: "center", behavior: "instant" }));
    const at = await dg.evaluate((pre) => {
      const lines = (pre.textContent ?? "").split("\n");
      const r = lines.findIndex((l) => l.includes("Cloudflare edge"));
      const c = lines[r].indexOf("Cloudflare edge") + 3;
      const rect = pre.getBoundingClientRect();
      return { x: rect.left + ((c + 0.5) / [...lines[0]].length) * rect.width, y: rect.top + ((r + 0.5) / (lines.length - 1)) * rect.height };
    });
    await page.mouse.move(at.x, at.y);
    await expect(page.locator(".ascii-tip:not([hidden])")).toContainText("Cloudflare terminates TLS");
    await page.mouse.move(1, 1);
    await expect(page.locator(".ascii-tip:not([hidden])")).toHaveCount(0);
  }
  await page.keyboard.type("ascii");
  await expect(page.locator("html")).not.toHaveClass(/ascii/);
  await expect(page.locator("pre.ascii-dg, .ascii-bg, .ascii-banner")).toHaveCount(0);
  await page.goto("/");
  await expect(page.locator("html")).not.toHaveClass(/ascii/);
  // On a phone: five taps on the title turn it on, five on the banner (which hides the title here) turn it off.
  for (let i = 0; i < 5; i++) await page.locator("main h1").click();
  await expect(page.locator("html")).toHaveClass(/ascii/);
  await expect(page.locator("main h1")).toHaveClass(/ascii-said/);
  for (let i = 0; i < 5; i++) await page.locator(".ascii-banner").click();
  await expect(page.locator("html")).not.toHaveClass(/ascii/);
  expect(errors).toEqual([]);
});
