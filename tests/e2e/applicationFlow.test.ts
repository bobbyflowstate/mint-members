import { test, expect } from "@playwright/test";

test.describe("Application Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should display landing page with CTA", async ({ page }) => {
    // Check hero section
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("Reserve Your Spot")).toBeVisible();
    
    // Check expectations section
    await expect(page.getByText("Reservation Fee")).toBeVisible();
    await expect(page.getByText("WhatsApp Required")).toBeVisible();
  });

  test("should navigate to apply page", async ({ page }) => {
    await page.click("text=Reserve Your Spot");
    await expect(page).toHaveURL("/apply");
    await expect(page.getByText("Apply to Join")).toBeVisible();
  });

  test("should show form validation errors", async ({ page }) => {
    await page.goto("/apply");
    
    // Try to submit empty form
    await page.click("text=Submit Application");
    
    // Should show validation errors
    await expect(page.getByText("First name is required")).toBeVisible();
  });

  test("should fill out application form", async ({ page }) => {
    await page.goto("/apply");
    
    // Fill personal info
    await page.fill('input[name="firstName"]', "Test");
    await page.fill('input[name="lastName"]', "User");
    await page.fill('input[name="email"]', "test@example.com");
    await page.fill('input[name="phone"]', "+14155551234");
    
    // Check dates are pre-filled
    await expect(page.locator('input[name="arrival"]')).toHaveValue(/2025-08-22/);
    await expect(page.locator('input[name="departure"]')).toHaveValue(/2025-09-01/);
    
    // Select dietary preference
    await page.selectOption('select[name="dietaryPreference"]', "vegetarian");
  });

  test("should show early departure warning", async ({ page }) => {
    await page.goto("/apply");
    
    // Set departure before cutoff
    await page.fill('input[name="departure"]', "2025-08-30");
    
    // Should show warning
    await expect(page.getByText("Early Departure Requires Approval")).toBeVisible();
  });
});

test.describe("Ops Portal", () => {
  test("should display ops dashboard", async ({ page }) => {
    await page.goto("/ops");
    
    await expect(page.getByText("Ops Dashboard")).toBeVisible();
    await expect(page.getByText("Pending Reviews")).toBeVisible();
    await expect(page.getByText("Recent Activity")).toBeVisible();
  });

  test("should navigate to review queue", async ({ page }) => {
    await page.goto("/ops");
    await page.click("text=Review Queue");
    
    await expect(page).toHaveURL("/ops/review");
    await expect(page.getByRole("heading", { name: "Review Queue" })).toBeVisible();
  });

  test("should navigate to event logs", async ({ page }) => {
    await page.goto("/ops");
    await page.click("text=Event Logs");
    
    await expect(page).toHaveURL("/ops/logs");
    await expect(page.getByRole("heading", { name: "Event Logs" })).toBeVisible();
  });
});

test.describe("Error Pages", () => {
  test("should display success page", async ({ page }) => {
    await page.goto("/apply/success");
    
    await expect(page.getByText("Payment Successful")).toBeVisible();
    await expect(page.getByText("WhatsApp")).toBeVisible();
  });

  test("should display error page", async ({ page }) => {
    await page.goto("/apply/error");
    
    await expect(page.getByText("Payment Cancelled")).toBeVisible();
    await expect(page.getByText("Try Again")).toBeVisible();
  });
});
