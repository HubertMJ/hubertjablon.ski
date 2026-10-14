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
