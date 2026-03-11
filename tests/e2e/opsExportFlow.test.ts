import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.describe("Ops Export Flow", () => {
  test("uses export view controls and downloads csv for current view", async ({ page }) => {
    const opsPassword = process.env.OPS_PWD;
    test.skip(!opsPassword, "OPS_PWD is required to run ops export e2e flow");

    await page.addInitScript((password: string) => {
      sessionStorage.setItem("ops_authenticated", "true");
      sessionStorage.setItem("ops_password", password);
    }, opsPassword as string);

    await page.goto("/ops/export");
    await expect(page.getByRole("heading", { name: "Export" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Export current view" })).toBeVisible();

    const emptyState = page.getByText("No signups match the selected view settings.");
    if (await emptyState.isVisible()) {
      await expect(
        page.getByRole("button", { name: "Export current view" })
      ).toBeDisabled();
      return;
    }

    await page.getByLabel("Show Email").uncheck();
    await page.getByLabel("Sort Field").selectOption("arrival");
    await page.getByLabel("Sort Direction").selectOption("asc");

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export current view" }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^signups-export-\d{4}-\d{2}-\d{2}\.csv$/);

    const path = await download.path();
    expect(path).toBeTruthy();
    const csv = await readFile(path as string, "utf8");
    const [header] = csv.split("\n");

    expect(header).toContain("First Name");
    expect(header).toContain("Last Name");
    expect(header).toContain("Phone");
    expect(header).not.toContain("Email");
  });
});
