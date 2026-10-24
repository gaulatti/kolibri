import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const transactionKey = "kolibri.oauth.transaction";
const browser = globalThis.window;
let assign: ReturnType<typeof vi.fn>;
let client: typeof import("../app/auth/cognito-auth.client").cognitoAuth;
let fetchMock: ReturnType<typeof vi.fn>;
const jwt = (claims: unknown) => `header.${btoa(JSON.stringify(claims)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")}.signature`;
const tokens = (overrides: Record<string, unknown> = {}) => ({ access_token: "fixture-access", refresh_token: "fixture-refresh", expires_in: 3600, token_type: "Bearer", ...overrides });

beforeEach(async () => {
  vi.resetModules();
  assign = vi.fn();
  vi.stubGlobal("window", { location: { origin: "https://kolibri.example", assign }, sessionStorage: browser.sessionStorage });
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  client = (await import("../app/auth/cognito-auth.client")).cognitoAuth;
});
afterEach(() => {
  vi.stubGlobal("window", browser);
});

async function authorize(returnTo?: string) {
  await client.signIn(returnTo);
  const url = new URL(String(assign.mock.calls.at(-1)?.[0]));
  return new URL(`https://kolibri.example/auth/callback?state=${url.searchParams.get("state")}&code=fixture-code`);
}
async function signedIn(overrides: Record<string, unknown> = {}) {
  const callback = await authorize("/design-systems/current");
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => tokens(overrides) });
  expect(await client.completeCallback(callback)).toBe("/design-systems/current");
}

describe("Cognito authorization boundary", () => {
  it("uses PKCE, state and the owned frontend callback for explicit Google sign-in", async () => {
    expect(client.snapshot()).toEqual({ status: "unauthenticated", user: null });
    await client.signIn();
    const url = new URL(String(assign.mock.calls[0][0]));
    const transaction = JSON.parse(browser.sessionStorage.getItem(transactionKey)!);
    expect(url.origin).toBe("https://auth.kolibri.example");
    expect(url.pathname).toBe("/oauth2/authorize");
    expect(url.searchParams.get("identity_provider")).toBe("Google");
    expect(url.searchParams.get("prompt")).toBe("select_account");
    expect(url.searchParams.get("client_id")).toBe("public-test-client");
    expect(url.searchParams.get("redirect_uri")).toBe("https://kolibri.example/auth/callback");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("state")).toBe(transaction.state);
    expect(transaction.returnTo).toBe("/design-systems");
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(transaction.verifier));
    const challenge = btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(url.searchParams.get("code_challenge")).toBe(challenge);
    expect(url.searchParams.has("code_verifier")).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(["https://evil.example", "//evil.example"])("contains unsafe return target %s", async (path) => {
    await authorize(path);
    expect(JSON.parse(browser.sessionStorage.getItem(transactionKey)!).returnTo).toBe("/design-systems");
  });
  it("restores through silent authorization rather than selecting an identity provider", async () => {
    await client.restoreSession("/generations/run?tab=events");
    const url = new URL(String(assign.mock.calls[0][0]));
    expect(url.searchParams.get("prompt")).toBe("none");
    expect(url.searchParams.has("identity_provider")).toBe(false);
    expect(JSON.parse(browser.sessionStorage.getItem(transactionKey)!).returnTo).toBe("/generations/run?tab=events");
  });
  it.each([null, "{invalid", JSON.stringify({ state: "other" })])("rejects absent, malformed or mismatched transaction %s", async (value) => {
    if (value !== null) browser.sessionStorage.setItem(transactionKey, value);
    await expect(client.completeCallback(new URL("https://kolibri.example/auth/callback?state=expected&code=code"))).rejects.toThrow("could not be verified");
    expect(browser.sessionStorage.getItem(transactionKey)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("expires the transaction and consumes it even on a failed callback", async () => {
    const callback = await authorize();
    const transaction = JSON.parse(browser.sessionStorage.getItem(transactionKey)!);
    transaction.createdAt = Date.now() - 600_001;
    browser.sessionStorage.setItem(transactionKey, JSON.stringify(transaction));
    await expect(client.completeCallback(callback)).rejects.toThrow("request expired");
    expect(browser.sessionStorage.getItem(transactionKey)).toBeNull();
  });
  it("routes expired silent sessions to sign-in, preserving a safe return path", async () => {
    const callback = await authorize("/generations/run?tab=events");
    callback.searchParams.set("error", "login_required");
    expect(await client.completeCallback(callback)).toBe("/sign-in?reason=session-expired&returnTo=%2Fgenerations%2Frun%3Ftab%3Devents");
    expect(client.snapshot().status).toBe("unauthenticated");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("fails explicit OAuth rejection without creating a session", async () => {
    const callback = await authorize();
    callback.searchParams.set("error", "access_denied");
    await expect(client.completeCallback(callback)).rejects.toThrow("could not complete sign-in");
    expect(client.snapshot().status).toBe("unauthenticated");
  });
  it("requires the returned authorization code", async () => {
    const callback = await authorize();
    callback.searchParams.delete("code");
    await expect(client.completeCallback(callback)).rejects.toThrow("authorization code");
  });
  it("rejects token-exchange transport failure", async () => {
    const callback = await authorize();
    fetchMock.mockResolvedValueOnce({ ok: false });
    await expect(client.completeCallback(callback)).rejects.toThrow("could not establish a session");
  });
  it.each([{ access_token: "" }, { expires_in: Number.NaN }])("rejects malformed token responses %j", async (bad) => {
    const callback = await authorize();
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => tokens(bad) });
    await expect(client.completeCallback(callback)).rejects.toThrow("invalid session");
    expect(client.snapshot().status).toBe("unauthenticated");
  });
  it("exchanges the code with its verifier and consumes the callback once", async () => {
    const callback = await authorize("/dashboard");
    const transaction = JSON.parse(browser.sessionStorage.getItem(transactionKey)!);
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => tokens({ id_token: jwt({ name: "Fixture Person", email: "fixture@example.invalid" }) }) });
    const listener = vi.fn();
    const unsubscribe = client.subscribe(listener);
    expect(await client.completeCallback(callback)).toBe("/dashboard");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://auth.kolibri.example/oauth2/token");
    expect(init.method).toBe("POST");
    expect(init.body.get("code_verifier")).toBe(transaction.verifier);
    expect(init.body.get("redirect_uri")).toBe("https://kolibri.example/auth/callback");
    expect(client.snapshot()).toEqual({ status: "authenticated", user: { displayName: "Fixture Person", email: "fixture@example.invalid" } });
    expect(await client.getAccessToken()).toBe("fixture-access");
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
    client.clearSession();
    expect(listener).toHaveBeenCalledOnce();
    await expect(client.completeCallback(callback)).rejects.toThrow("could not be verified");
  });
});

describe("in-memory session lifetime", () => {
  it("requires authentication before an API request", async () => {
    await expect(client.getAccessToken()).rejects.toThrow("Authentication is required");
  });
  it.each([
    [undefined, "kolibri user", undefined],
    [jwt({ email: "fixture@example.invalid" }), "fixture@example.invalid", "fixture@example.invalid"],
    [jwt({ name: 4, email: true }), "kolibri user", undefined],
    ["invalid", "kolibri user", undefined],
    ["header.invalid!data.signature", "kolibri user", undefined],
  ])("derives a bounded identity from optional display claims", async (idToken, displayName, email) => {
    await signedIn({ id_token: idToken });
    expect(client.snapshot()).toEqual({ status: "authenticated", user: { displayName, email } });
  });
  it("clears an expired session without a refresh token", async () => {
    await signedIn({ expires_in: 1, refresh_token: undefined });
    await expect(client.getAccessToken()).rejects.toThrow("Your session expired");
    expect(client.snapshot().status).toBe("unauthenticated");
  });
  it("refreshes before expiry and retains identity and refresh credentials when not rotated", async () => {
    await signedIn({ expires_in: 1, id_token: jwt({ name: "Fixture" }) });
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "refreshed", expires_in: 3600, token_type: "Bearer" }) });
    expect(await client.getAccessToken()).toBe("refreshed");
    expect(fetchMock.mock.calls[1][1].body.get("refresh_token")).toBe("fixture-refresh");
    expect(client.snapshot()).toEqual({ status: "authenticated", user: { displayName: "Fixture", email: undefined } });
  });
  it("clears the session when refresh is rejected", async () => {
    await signedIn({ expires_in: 1 });
    fetchMock.mockResolvedValueOnce({ ok: false });
    await expect(client.getAccessToken()).rejects.toThrow("Your session expired");
    expect(client.snapshot().status).toBe("unauthenticated");
  });
  it("does not return a refreshed token after a subscriber revokes that session", async () => {
    await signedIn({ expires_in: 1 });
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => tokens({ access_token: "refreshed" }) });
    const unsubscribe = client.subscribe((snapshot) => { if (snapshot.status === "authenticated") client.clearSession(); });
    await expect(client.getAccessToken()).rejects.toThrow("Your session expired");
    unsubscribe();
  });
  it("clears transaction and memory before redirecting sign-out to the owned callback", async () => {
    await signedIn();
    browser.sessionStorage.setItem(transactionKey, "leftover");
    client.signOut();
    const url = new URL(String(assign.mock.calls.at(-1)?.[0]));
    expect(url.pathname).toBe("/logout");
    expect(url.searchParams.get("logout_uri")).toBe("https://kolibri.example/sign-in?signedOut=1");
    expect(url.searchParams.get("client_id")).toBe("public-test-client");
    expect(browser.sessionStorage.getItem(transactionKey)).toBeNull();
    expect(client.snapshot().status).toBe("unauthenticated");
  });
});
