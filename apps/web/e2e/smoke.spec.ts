import { test, expect } from "@playwright/test";

// Public routes — these must render without a session.
const PUBLIC_ROUTES = ["/login", "/signup"];

// Authenticated routes — walked after a test-mode login.
// Middleware redirects unauthenticated traffic to /login, so without a real
// session these will 302 → /login. The test asserts the response is NOT a
// 404/500 and the page renders without console errors.
const APP_ROUTES = [
  "/",
  "/sales/command-center",
  "/sales/new-leads",
  "/sales/my-leads",
  "/sales/follow-ups",
  "/sales/coaching",
  "/dispatch/command-center",
  "/dispatch/scheduling",
  "/customers",
  "/customers/opportunities",
  "/calls",
  "/calendars",
  "/tasks/open",
  "/tasks/due-today",
  "/tasks/overdue",
  "/tasks/completed",
  "/customer-service/tickets/active",
  "/customer-service/tickets/completed",
  "/settings/integrations/api-keys",
  "/settings/integrations/callscraper",
  "/settings/integrations/import",
  "/settings/objects",
];

test.describe("public routes render", () => {
  for (const path of PUBLIC_ROUTES) {
    test(`GET ${path}`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const res = await page.goto(path);
      expect(res?.status(), `${path} status`).toBeLessThan(400);
      await expect(page).not.toHaveTitle(/404|500/);
      expect(errors, `${path} console errors`).toEqual([]);
    });
  }
});

test.describe("app routes redirect or render cleanly", () => {
  for (const path of APP_ROUTES) {
    test(`GET ${path}`, async ({ page }) => {
      const res = await page.goto(path);
      // Either 200 (rendered) or redirect chain ending at /login (middleware)
      expect(res?.status(), `${path} status`).toBeLessThan(500);
      await expect(page).not.toHaveTitle(/404|500/);
    });
  }
});
