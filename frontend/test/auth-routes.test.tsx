import { StrictMode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { beforeEach, expect, it, vi } from "vitest";
import { ThemeProvider } from "../app/bleecker";
import SignIn, { meta as signInMeta } from "../app/routes/sign-in";
import AuthCallback, { meta as callbackMeta } from "../app/routes/auth-callback";
import ProtectedLayout from "../app/routes/protected-layout";
import NewGeneration, { meta as generationMeta } from "../app/routes/generation-new";

const { auth } = vi.hoisted(() => ({ auth: {
  status: "unauthenticated", user: null as null | { displayName: string },
  signIn: vi.fn(), restoreSession: vi.fn(), completeCallback: vi.fn(), signOut: vi.fn(),
} }));
vi.mock("../app/auth/auth-context", () => ({ useAuth: () => auth }));
beforeEach(() => {
  auth.status = "unauthenticated"; auth.user = null;
  auth.signIn.mockReset().mockResolvedValue(undefined);
  auth.restoreSession.mockReset().mockResolvedValue(undefined);
  auth.completeCallback.mockReset().mockResolvedValue("/design-systems");
  auth.signOut.mockReset();
});
function Location() { const location = useLocation(); return <output data-testid="location">{location.pathname}{location.search}</output>; }
function mounted(element: React.ReactNode, entry = "/sign-in") {
  return render(<MemoryRouter initialEntries={[entry]}><ThemeProvider defaultTheme="light">{element}<Location /></ThemeProvider></MemoryRouter>);
}

it("exposes human-readable browser titles", () => {
  expect(signInMeta({} as never)).toContainEqual({ title: "Sign in | kolibri" });
  expect(callbackMeta({} as never)).toEqual([{ title: "Completing sign-in | kolibri" }]);
  expect(generationMeta({} as never)).toEqual([{ title: "Generate package | kolibri" }]);
});
it.each([["", "/"], ["?returnTo=/generations/run", "/generations/run"], ["?returnTo=//evil.example", "/"]])("starts sign-in with a safe return target %s", async (search, target) => {
  mounted(<SignIn />, `/sign-in${search}`);
  fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
  await waitFor(() => expect(auth.signIn).toHaveBeenCalledWith(target));
});
it("explains expired and explicitly ended sessions", () => {
  mounted(<SignIn />, "/sign-in?reason=session-expired&signedOut=1");
  expect(screen.getByText("Session ended")).toBeTruthy();
  expect(screen.getByText("Signed out")).toBeTruthy();
});
it.each([new Error("Provider unavailable"), "unknown failure"])("makes sign-in retryable after %s", async (cause) => {
  auth.signIn.mockRejectedValueOnce(cause);
  mounted(<SignIn />);
  fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
  expect(await screen.findByText(cause instanceof Error ? cause.message : "Sign-in could not be started.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Continue with Google" }).hasAttribute("disabled")).toBe(false);
});
it("redirects an already authenticated account and provides sign-out", async () => {
  auth.status = "authenticated"; auth.user = { displayName: "Fixture User" };
  mounted(<SignIn />);
  await waitFor(() => expect(screen.getByTestId("location").textContent).toBe("/"));
});
it("finishes a callback once across StrictMode effects", async () => {
  mounted(<StrictMode><AuthCallback /></StrictMode>, "/auth/callback");
  await waitFor(() => expect(screen.getByTestId("location").textContent).toBe("/design-systems"));
  expect(auth.completeCallback).toHaveBeenCalledOnce();
});
it.each([new Error("State mismatch"), "unknown failure"])("renders callback failure %s", async (cause) => {
  auth.completeCallback.mockRejectedValueOnce(cause);
  mounted(<AuthCallback />, "/auth/callback");
  expect(await screen.findByText(cause instanceof Error ? cause.message : "Sign-in could not be completed.")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Return to sign in" }).getAttribute("href")).toBe("/sign-in");
});
it("ignores a callback result after leaving the page", async () => {
  let finish!: (path: string) => void;
  auth.completeCallback.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  const view = mounted(<AuthCallback />, "/auth/callback");
  view.unmount();
  await act(async () => { finish("/design-systems"); });
  expect(auth.completeCallback).toHaveBeenCalledOnce();
});
it("ignores a callback failure after leaving the page", async () => {
  let fail!: (error: Error) => void;
  auth.completeCallback.mockImplementation(() => new Promise((_resolve, reject) => { fail = reject; }));
  const view = mounted(<AuthCallback />, "/auth/callback");
  view.unmount();
  await act(async () => { fail(new Error("late failure")); });
  expect(auth.completeCallback).toHaveBeenCalledOnce();
});
it("restores the exact protected route once and shows its loading boundary", async () => {
  mounted(<Routes><Route element={<ProtectedLayout />}><Route path="/design-systems" element={<p>Private records</p>} /></Route></Routes>, "/design-systems?status=failed");
  expect(screen.getByText("Restoring your session…")).toBeTruthy();
  expect(auth.restoreSession).toHaveBeenCalledWith("/design-systems?status=failed");
  expect(screen.queryByText("Private records")).toBeNull();
});
it("renders the protected outlet only for an authenticated account", () => {
  auth.status = "authenticated"; auth.user = { displayName: "Fixture" };
  mounted(<Routes><Route element={<ProtectedLayout />}><Route path="/design-systems" element={<p>Private records</p>} /></Route></Routes>, "/design-systems");
  expect(screen.getByText("Private records")).toBeTruthy();
  fireEvent.click(screen.getAllByRole("button", { name: "Sign out" })[0]);
  expect(auth.signOut).toHaveBeenCalledOnce();
  expect(auth.restoreSession).not.toHaveBeenCalled();
});
it("returns failed restoration to sign-in with the original query", async () => {
  auth.restoreSession.mockRejectedValueOnce(new Error("Offline"));
  mounted(<ProtectedLayout />, "/design-systems?status=failed");
  await waitFor(() => expect(screen.getByTestId("location").textContent).toBe("/sign-in?returnTo=%2Fdesign-systems%3Fstatus%3Dfailed"));
});
it.each([["", "/design-systems"], ["?designSystemId=a%2Fb", "/design-systems/a%2Fb?tab=generate"]])("preserves legacy generation links %s", async (query, path) => {
  mounted(<Routes><Route path="/generations/new" element={<NewGeneration />} /><Route path="*" element={null} /></Routes>, `/generations/new${query}`);
  await waitFor(() => expect(screen.getByTestId("location").textContent).toBe(path));
});
