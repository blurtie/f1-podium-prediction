import { expect, test } from "@playwright/test";

test("dashboard exposes layered Spa statistics and keyboard disclosures", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Weekend Conditions" })).toBeVisible();
  await expect(page.locator('[data-testid="weather-available"], [data-testid="weather-unavailable"]')).toBeVisible();
  await expect(page.getByText("CONTEXT ONLY — NOT A MODEL INPUT")).toBeVisible();

  await expect(page.getByRole("heading", { name: "Full Field Probability" })).toBeVisible();
  await expect(page.locator(".probability-row:not(.field-header):visible")).toHaveCount(6);
  const fieldDisclosure = page.locator(".field-table-wrap .table-disclosure summary");
  await fieldDisclosure.focus();
  await expect(fieldDisclosure).toBeFocused();
  expect(await fieldDisclosure.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe("none");
  await page.keyboard.press("Enter");
  await expect(page.locator(".probability-row:not(.field-header):visible")).toHaveCount(22);

  await expect(page.getByRole("heading", { name: "Team Outlook" })).toBeVisible();
  await expect(page.getByText("EXPECTED PODIUM SLOTS").first()).toBeVisible();
  await expect(page.getByText("ekspektasi slot, bukan probabilitas").first()).toBeVisible();

  await expect(page.locator(".history-stat")).toHaveCount(5);
  await expect(page.getByText("POLE → PODIUM", { exact: true })).toBeVisible();
  await expect(page.getByText(/95% CI/).first()).toBeVisible();

  await expect(page.getByRole("heading", { name: "Spa Contender Formbook" })).toBeVisible();
  await expect(page.locator(".formbook-row:not(.field-header):visible")).toHaveCount(6);
  const formbookDisclosure = page.locator(".formbook-section .table-disclosure summary");
  await formbookDisclosure.focus();
  await page.keyboard.press(" ");
  await expect(page.locator(".formbook-row:not(.field-header):visible")).toHaveCount(22);

  const markers = page.locator(".track-marker");
  await expect(markers).toHaveCount(3);
  const trackBox = await page.locator(".track-visual").boundingBox();
  expect(trackBox).not.toBeNull();
  for (const marker of await markers.all()) {
    const markerBox = await marker.boundingBox();
    expect(markerBox).not.toBeNull();
    expect(markerBox!.x).toBeGreaterThanOrEqual(trackBox!.x);
    expect(markerBox!.x + markerBox!.width).toBeLessThanOrEqual(trackBox!.x + trackBox!.width);
  }
});

test("post-qualifying output shows before, after, and percentage-point delta", async ({ page }) => {
  await page.goto("/#qualifying");
  const calculate = page.getByRole("button", { name: "CALCULATE POST-QUALIFYING PODIUM" });
  await calculate.scrollIntoViewIfNeeded();
  await calculate.click();
  await expect(page.locator('[data-testid="post-qualifying-driver"]')).toHaveCount(3, { timeout: 40_000 });
  await expect(page.locator(".podium-change").first()).toContainText("→");
  await expect(page.locator(".podium-change .delta").first()).toContainText("pp");
});

test("mobile layout keeps the page bounded while tables remain scrollable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const dimensions = await page.evaluate(() => ({
    pageWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.pageWidth).toBeLessThanOrEqual(dimensions.viewportWidth);

  const tableDimensions = await page.locator(".field-table-wrap .responsive-table").evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
  }));
  expect(tableDimensions.scrollWidth).toBeGreaterThan(tableDimensions.clientWidth);
  await expect(page.locator(".probability-row:not(.field-header):visible")).toHaveCount(6);
  await expect(page.locator(".track-marker")).toHaveCount(3);
});
