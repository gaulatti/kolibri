import { fireEvent, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { renderPage } from "./render";
import { ApplicationFrame } from "../app/components/app-shell";
import { LoadingState } from "../app/components/loading-state";
import { RouterButton } from "../app/components/router-button";
import { PageHeading } from "../app/design-systems/page-heading";
import NotFound from "../app/routes/not-found";
import shellStory from "../app/components/application-shell.stories";
import foundationsStory from "../app/components/bleecker-foundations.stories";
import routes from "../app/routes";

vi.mock("../app/auth/auth-context", () => ({ useAuth: () => ({ user: null, signOut: vi.fn() }) }));

it("renders the public shell without account controls", () => {
  renderPage(<ApplicationFrame><p>Public content</p></ApplicationFrame>);
  expect(screen.getByText("Public content")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
  expect(document.querySelector('a[href="/sign-in"]')?.textContent).toContain("kolibri");
});
it("renders account navigation and delegates sign-out without putting identity in URLs", () => {
  const signOut = vi.fn();
  renderPage(<ApplicationFrame user={{ displayName: "" }} onSignOut={signOut}><p>Private content</p></ApplicationFrame>);
  fireEvent.click(screen.getAllByRole("button", { name: "Sign out" })[0]);
  expect(signOut).toHaveBeenCalledOnce();
  fireEvent.click(screen.getAllByRole("link", { name: "Design Systems" })[0]);
  expect(screen.getByTestId("route-location").textContent).toBe("/design-systems");
});
it("keeps loading and page-heading controls accessible", () => {
  renderPage(<><LoadingState /><PageHeading title="Example" description="Description" action={{ label: "Open record", to: "/design-systems/design" }} /><RouterButton to="/design-systems" type="reset">Back</RouterButton></>);
  expect(screen.getByText("Loading")).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Example" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Open record" }));
  expect(screen.getByTestId("route-location").textContent).toBe("/design-systems/design");
});
it("shows a recoverable not-found route", () => {
  renderPage(<NotFound />);
  expect(screen.getByText("The address doesn't match a kolibri page.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Design Systems" }));
  expect(screen.getByTestId("route-location").textContent).toBe("/design-systems");
});
it("keeps the shipped component fixtures renderable against real Bleecker", () => {
  const Shell = shellStory.component;
  const view = renderPage(<Shell />);
  expect(screen.getByText("Everything is organized")).toBeTruthy();
  view.unmount();
  const Foundations = foundationsStory.component;
  renderPage(<Foundations />);
  expect(screen.getByRole("button", { name: "Save design system" })).toBeTruthy();
  expect((document.getElementById("story-name") as HTMLInputElement).value).toBe("Primary Design System");
});
it("registers the owned route hierarchy and catch-all", () => {
  expect(routes.map((route) => route.path)).toEqual(["sign-in", "auth/callback", undefined, "*"]);
  expect(routes[2].children?.some((route) => route.path === "design-systems/:designSystemId/history/report")).toBe(true);
});
