import { expect, test, type Page } from "@playwright/test";

// The interactive vLLM manager demo on /work/vllm/: it runs entirely in the page, on seeded data,
// under the same CSP and Trusted Types as production (scripts/serve.mjs). Every test also fails on
// a console error or a page error, a CSP violation included.

const card = (page: Page, alias: string) => page.locator(`.vd-card[data-alias="${alias}"]`);
const statusOf = (page: Page, alias: string) => card(page, alias).locator("[data-status]");
const tab = (page: Page, id: string) => page.locator(`#vd-tab-${id}`).click();

let errors: string[] = [];
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/work/vllm/");
  await expect(page.locator(".vd-tab")).toHaveCount(7);
});
test.afterEach(() => {
  expect(errors).toEqual([]);
});

test("starting a stopped deployment: Starting, a log, then Running, and its card's memory fills", async ({ page }) => {
  const tile = page.locator('.vd-tile[data-k="gpu:3"]');
  await expect(tile).toContainText("0.0 GiB / 96.0 GiB");
  await card(page, "model-b").getByRole("button", { name: "Start" }).click();
  await expect(statusOf(page, "model-b")).toHaveText(/starting/i);
  await expect(card(page, "model-b").locator(".vd-msg--log")).toContainText("manager:");
  await expect(statusOf(page, "model-b")).toHaveText(/running/i, { timeout: 10_000 });
  await expect(tile).toContainText("36.5 GiB / 96.0 GiB");
  await expect(page.locator(".vd-status")).toContainText("model-b is running on GPU 3");
});

test("a start that does not fit evicts the idle lazy instance first, and says so", async ({ page }) => {
  await card(page, "model-b").getByRole("button", { name: "Start" }).click();
  await expect(statusOf(page, "model-b")).toHaveText(/running/i, { timeout: 10_000 });
  await card(page, "model-a-moe").getByRole("button", { name: "Start" }).click();
  await expect(page.locator(".vd-status")).toContainText("Evicted model-b (idle, lazy, least recently used) from GPU 3");
  await expect(statusOf(page, "model-b")).toHaveText(/stopping|stopped/i);
  await expect(statusOf(page, "model-a-moe")).toHaveText(/running/i, { timeout: 12_000 });
  // The estimate became a measurement.
  await expect(card(page, "model-a-moe").locator(".vd-stat").first()).toHaveText(/0\.70$/);
});

test("a start on a card that is too full is refused with 503 before anything stops", async ({ page }) => {
  await card(page, "qwen2.5-7b").getByRole("button", { name: "Start" }).click();
  await expect(page.locator(".vd-status")).toContainText("503: would not fit even after evicting 0");
  await expect(card(page, "qwen2.5-7b").locator(".vd-alert--warn")).toContainText("Nothing was stopped");
  await expect(statusOf(page, "qwen2.5-7b")).toHaveText(/stopped/i);
  await expect(statusOf(page, "qwen3-32b")).toHaveText(/running/i);
  // A blocked card refuses too, until loads are allowed again.
  await card(page, "model-c").getByRole("button", { name: "Start" }).click();
  await expect(page.locator(".vd-status")).toContainText("GPU 2 is blocked for new loads");
  await page.locator('[data-k="unblock:2"]').click();
  await card(page, "model-c").getByRole("button", { name: "Start" }).click();
  await expect(statusOf(page, "model-c")).toHaveText(/starting|running/i);
});

test("a prompt to a stopped model: the gateway cold-starts it, then the answer streams; the page does not move", async ({ page }) => {
  await tab(page, "playground");
  await page.locator("#vd-pg-model").selectOption("model-b");
  await page.getByRole("button", { name: "Write a haiku about GPUs" }).click();
  const send = page.locator('[data-k="pg-send"]');
  await send.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => [document.documentElement.scrollHeight, scrollY]);
  await send.click();
  const box = page.locator(".vd-stream");
  await expect(box).toContainText(": keepalive");
  await expect(page.locator(".vd-stream__meta")).toContainText("Cold start");
  await expect(box.locator(".vd-stream__text")).toContainText("Ninety-six", { timeout: 15_000 });
  const during = await page.evaluate(() => [document.documentElement.scrollHeight, scrollY]);
  await expect(page.locator(".vd-stream__meta")).toHaveText(/^200 · .* · cold start$/, { timeout: 15_000 });
  const after = await page.evaluate(() => [document.documentElement.scrollHeight, scrollY]);
  expect(during).toEqual(before);
  expect(after).toEqual(before);
  const row = page.locator(".vd-req--you").first();
  await expect(row).toContainText("model-b");
  await expect(row).toContainText("cold");
  // Analytics counts it.
  await tab(page, "analytics");
  await expect(page.locator(".vd-tilestat").first()).toContainText("2,001");
});

test("pinning a reserved deployment opens the Conflict dialog; Escape closes it and focus comes back", async ({ page }) => {
  const pin = card(page, "model-c").locator('[data-k="pin:model-c"]');
  await pin.click();
  const dlg = page.getByRole("alertdialog");
  await expect(dlg).toBeVisible();
  await expect(dlg).toContainText("Action rejected");
  await expect(dlg).toContainText("batch-team-x");
  await expect(dlg).toContainText("Remedy:");
  await expect(dlg.getByRole("button", { name: "Acknowledge" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dlg).toHaveCount(0);
  await expect(pin).toBeFocused();
  await expect(pin).toHaveAttribute("aria-pressed", "false");
});

test("booking an empty slot: one that fits is Scheduled, one that does not is Unfulfillable", async ({ page }) => {
  await tab(page, "reservations");
  await page.locator('[data-slot="3:14"]').click();
  const dlg = page.getByRole("dialog", { name: "Book a window" });
  await dlg.getByLabel("Name").fill("e2e-fits");
  await dlg.getByLabel("Deployment").selectOption("model-b");
  await expect(dlg.locator(".vd-fit")).toContainText("Scheduled");
  await dlg.getByRole("button", { name: "Book" }).click();
  await expect(page.locator('.vd-cal__blk[data-res="e2e-fits"]')).toHaveClass(/vd-cal__blk--scheduled/);
  await page.locator('[data-slot="3:16"]').click();
  await dlg.getByLabel("Name").fill("e2e-late");
  await dlg.getByLabel("Deployment").selectOption("model-a-moe");
  await dlg.getByLabel("Start (UTC)").selectOption("15");
  await expect(dlg.locator(".vd-fit")).toContainText("Unfulfillable");
  await dlg.getByRole("button", { name: "Book" }).click();
  await expect(page.locator('.vd-cal__blk[data-res="e2e-late"]')).toHaveClass(/vd-cal__blk--unfulfillable/);
  await expect(page.locator(".vd-status")).toContainText("Unfulfillable");
});

test("no tab, and no open dialog, scrolls the page sideways, at 390 px and at desktop width", async ({ page }) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    for (const id of ["deployments", "playground", "analytics", "reservations", "downloads", "telemetry", "api"]) {
      await tab(page, id);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${id} at ${width}`).toBeLessThanOrEqual(0);
    }
    await tab(page, "deployments");
    await page.locator('[data-k="new-deployment"]').click();
    await expect(page.getByRole("dialog", { name: "New deployment" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `new deployment at ${width}`).toBeLessThanOrEqual(0);
    await page.keyboard.press("Escape");
  }
});

test("a new deployment from the cache is created stopped; Reset brings the demo back", async ({ page }) => {
  await page.locator('[data-k="new-deployment"]').click();
  const dlg = page.getByRole("dialog", { name: "New deployment" });
  await dlg.getByLabel("Model (cached)").selectOption("Qwen/Qwen3-8B");
  await expect(dlg.locator(".vd-fit")).toContainText("Fits GPU 3 now");
  await dlg.getByRole("button", { name: "Create" }).click();
  await expect(statusOf(page, "qwen3-8b")).toHaveText(/stopped/i);
  await page.locator('[data-k="reset"]').click();
  await expect(card(page, "qwen3-8b")).toHaveCount(0);
  await expect(page.locator(".vd-card")).toHaveCount(7);
});

test("the demo's charts are not diagrams: no data-node anywhere in it", async ({ page }) => {
  await tab(page, "telemetry");
  await expect(page.locator(".vd-chart svg")).toHaveCount(12);
  expect(await page.locator("#vdemo [data-node]").count()).toBe(0);
});
