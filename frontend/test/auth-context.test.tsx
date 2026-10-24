import { act, fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "../app/auth/auth-context";
import { cognitoAuth, type AuthSnapshot } from "../app/auth/cognito-auth.client";

it("publishes authenticated state and delegates account actions without storing tokens", async () => {
  vi.spyOn(cognitoAuth, "snapshot").mockReturnValue({ status: "unauthenticated", user: null });
  let emit: (snapshot: AuthSnapshot) => void = () => {};
  const unsubscribe = vi.fn();
  vi.spyOn(cognitoAuth, "subscribe").mockImplementation((listener) => { emit = listener; return unsubscribe; });
  const signIn = vi.spyOn(cognitoAuth, "signIn").mockResolvedValue();
  const restore = vi.spyOn(cognitoAuth, "restoreSession").mockResolvedValue();
  const complete = vi.spyOn(cognitoAuth, "completeCallback").mockResolvedValue("/design-systems");
  const signOut = vi.spyOn(cognitoAuth, "signOut").mockReturnValue();
  function Consumer() {
    const auth = useAuth();
    return <><output>{auth.status}:{auth.user?.displayName}</output>
      <button onClick={() => void auth.signIn("/design-systems")}>Sign in</button>
      <button onClick={() => void auth.restoreSession("/generations/run")}>Restore</button>
      <button onClick={() => void auth.completeCallback(new URL("https://kolibri.example/auth/callback"))}>Complete</button>
      <button onClick={auth.signOut}>Sign out</button>
    </>;
  }
  const view = render(<AuthProvider><Consumer /></AuthProvider>);
  expect(screen.getByRole("status").textContent).toBe("unauthenticated:");
  act(() => emit({ status: "authenticated", user: { displayName: "Fixture User" } }));
  expect(screen.getByRole("status").textContent).toBe("authenticated:Fixture User");
  fireEvent.click(screen.getByText("Sign in")); fireEvent.click(screen.getByText("Restore"));
  fireEvent.click(screen.getByText("Complete")); fireEvent.click(screen.getByText("Sign out"));
  expect(signIn).toHaveBeenCalledWith("/design-systems");
  expect(restore).toHaveBeenCalledWith("/generations/run");
  expect(complete).toHaveBeenCalledWith(new URL("https://kolibri.example/auth/callback"));
  expect(signOut).toHaveBeenCalledOnce();
  view.unmount();
  expect(unsubscribe).toHaveBeenCalledOnce();
});

it("rejects use outside the authentication provider", () => {
  function MissingProvider() { useAuth(); return null; }
  expect(() => render(<MissingProvider />)).toThrow("useAuth must be used inside AuthProvider");
});
