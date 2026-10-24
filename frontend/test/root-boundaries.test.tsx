import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { renderPage } from "./render";
import App, { ErrorBoundary, HydrateFallback, Layout, meta } from "../app/root";

// The application owns its document and fallback content. These four adapters
// represent framework-provided document slots, which need a full route manifest
// in the running server; the application's UI and authentication provider stay real.
vi.mock("react-router", async (original) => ({
  ...await original<typeof import("react-router")>(),
  Meta: () => <meta name="framework-meta" content="present" />,
  Links: () => <link rel="stylesheet" href="/fixture.css" />,
  Scripts: () => <script src="/fixture.js" />,
  ScrollRestoration: () => <script data-scroll-restoration="present" />,
  Outlet: () => <p>Current route content</p>,
}));

it("owns the document language, theme persistence and framework document slots", () => {
  const html = renderToStaticMarkup(<Layout><main>Application document</main></Layout>);
  expect(html).toContain('<html lang="en"');
  expect(html).toContain('name="viewport"');
  expect(html).toContain('name="framework-meta"');
  expect(html).toContain('href="/fixture.css"');
  expect(html).toContain('src="/fixture.js"');
  expect(html).toContain("kolibri-theme");
  expect(html).toContain("Application document");
  expect(meta({} as never)).toContainEqual({ title: "kolibri" });
});
it("places route content inside the real authentication provider", () => {
  render(<App />);
  expect(screen.getByText("Current route content")).toBeTruthy();
});
it("offers an accessible hydration loading state", () => {
  renderPage(<HydrateFallback />);
  expect(screen.getByText("Opening kolibri…")).toBeTruthy();
});
it.each([
  [new Error("Internal detail"), "Something went wrong", "kolibri could not open this page. Please try again."],
  [{ status: 404, statusText: "Not Found", internal: false, data: "Missing" }, "404", "The requested page could not be found."],
  [{ status: 500, statusText: "Service unavailable", internal: false, data: "Failure" }, "Error", "Service unavailable"],
  [{ status: 500, statusText: "", internal: false, data: "Failure" }, "Error", "kolibri could not open this page. Please try again."],
])("shows a bounded recoverable route error %s", (error, title, details) => {
  const props = { error } as React.ComponentProps<typeof ErrorBoundary>;
  renderPage(<ErrorBoundary {...props} />);
  expect(screen.getByText(details as string)).toBeTruthy();
  expect(screen.getAllByText(title as string).length).toBeGreaterThan(0);
  expect(screen.getByRole("link", { name: "Design Systems" }).getAttribute("href")).toBe("/design-systems");
  expect(screen.queryByText("Internal detail")).toBeNull();
});
