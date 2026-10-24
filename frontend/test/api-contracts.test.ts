import { beforeEach, describe, expect, it, vi } from "vitest";
import { cognitoAuth } from "../app/auth/cognito-auth.client";
import { ApiError, apiError, apiRequest, authenticatedFetch } from "../app/api/api-client";
import { designSystemsApi } from "../app/api/design-systems";
import { generationsApi, historyQuery } from "../app/api/generations";
import { dashboardApi } from "../app/api/dashboard";
import { reportsApi } from "../app/api/reports";

let transport: ReturnType<typeof vi.fn>;
beforeEach(() => {
  transport = vi.fn();
  vi.stubGlobal("fetch", transport);
  vi.spyOn(cognitoAuth, "getAccessToken").mockResolvedValue("fixture-access");
});
const response = (body: unknown, status = 200, headers: HeadersInit = {}) => new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

describe("authenticated transport", () => {
  it("adds authorization and prevents shared browser caches or credential cookies", async () => {
    transport.mockResolvedValueOnce(response({ id: "result" }));
    expect(await apiRequest("/v1/example")).toEqual({ id: "result" });
    const [url, init] = transport.mock.calls[0];
    expect(url).toBe("https://api.kolibri.example/v1/example");
    expect(init.headers.get("Authorization")).toBe("Bearer fixture-access");
    expect(init.headers.get("Accept")).toBe("application/json");
    expect(init.headers.has("Content-Type")).toBe(false);
    expect(init.credentials).toBe("omit");
    expect(init.cache).toBe("no-store");
  });
  it("preserves explicit content negotiation while defaulting JSON bodies", async () => {
    transport.mockResolvedValue(response(null, 204));
    expect(await apiRequest("/v1/example", { method: "POST", body: "{}" })).toBeUndefined();
    expect(transport.mock.calls[0][1].headers.get("Content-Type")).toBe("application/json");
    await authenticatedFetch("/v1/example", { body: "text", headers: { Accept: "text/event-stream", "Content-Type": "text/plain" } });
    expect(transport.mock.calls[1][1].headers.get("Accept")).toBe("text/event-stream");
    expect(transport.mock.calls[1][1].headers.get("Content-Type")).toBe("text/plain");
  });
  it("invalidates rejected authentication and propagates typed field errors", async () => {
    const clear = vi.spyOn(cognitoAuth, "clearSession");
    transport.mockResolvedValueOnce(response({ message: "Expired", errors: [{ field: "name", messages: ["Required"] }] }, 401));
    const error = await apiRequest("/v1/example").catch((error: ApiError) => error);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ message: "Expired", status: 401, fieldErrors: { name: ["Required"] } });
    expect(clear).toHaveBeenCalledOnce();
  });
  it("does not send a request without an access token", async () => {
    vi.mocked(cognitoAuth.getAccessToken).mockRejectedValueOnce(new Error("Authentication is required"));
    await expect(apiRequest("/v1/example")).rejects.toThrow("Authentication is required");
    expect(transport).not.toHaveBeenCalled();
  });
  it.each([{}, { message: "" }])("uses a bounded message when the error payload has none", async (body) => {
    expect(await apiError(response(body, 422))).toMatchObject({ message: "The request could not be completed.", status: 422, fieldErrors: {} });
  });
  it.each([null, "unexpected", 4])("does not treat scalar error payload %j as a field-error document", async (body) => {
    expect(await apiError(response(body, 500))).toMatchObject({ message: "The request could not be completed. Please try again.", status: 500 });
  });
  it("handles non-JSON transport failures and directly constructed errors", async () => {
    expect(await apiError(new Response("gateway unavailable", { status: 502 }))).toMatchObject({ status: 502, fieldErrors: {} });
    expect(new ApiError("Conflict", 409).fieldErrors).toEqual({});
  });
});

describe("application HTTP contracts", () => {
  it("keeps every design-system method owner-scoped and encodes path identifiers", async () => {
    transport.mockImplementation(async () => response({ id: "record" }));
    const input = { name: "Design", description: "Example", generationContract: "composable-v1" as const };
    await designSystemsApi.list();
    await designSystemsApi.get("a/b");
    await designSystemsApi.create(input);
    await designSystemsApi.update("a/b", input);
    await designSystemsApi.delete("a/b");
    await designSystemsApi.getRuntimeConfiguration("a/b");
    await designSystemsApi.setRuntimeConfiguration("a/b", { figmaFileKey: "file", packageName: "@fixture/design" });
    await designSystemsApi.setRuntimeCredentials("a/b", { figmaAccessToken: "fixture-not-a-real-credential" });
    expect(transport.mock.calls.map(([url, init]) => [new URL(url).pathname, init.method || "GET"])).toEqual([
      ["/v1/design-systems", "GET"], ["/v1/design-systems/a%2Fb", "GET"],
      ["/v1/design-systems", "POST"], ["/v1/design-systems/a%2Fb", "PATCH"],
      ["/v1/design-systems/a%2Fb", "DELETE"], ["/v1/design-systems/a%2Fb/runtime-configuration", "GET"],
      ["/v1/design-systems/a%2Fb/runtime-configuration", "PATCH"], ["/v1/design-systems/a%2Fb/runtime-credentials", "PUT"],
    ]);
    expect(JSON.parse(transport.mock.calls[2][1].body)).toEqual(input);
    expect(JSON.parse(transport.mock.calls[7][1].body)).toEqual({ figmaAccessToken: "fixture-not-a-real-credential" });
  });
  it("requests explicit generation publication and normalizes artifact availability", async () => {
    transport.mockImplementation(async () => response({ id: "run", artifactReference: "private-reference", status: "succeeded" }));
    await generationsApi.start("design");
    await generationsApi.start("design", true);
    expect(JSON.parse(transport.mock.calls[0][1].body)).toEqual({ designSystemId: "design", publishToNpm: false });
    expect(JSON.parse(transport.mock.calls[1][1].body)).toEqual({ designSystemId: "design", publishToNpm: true });
    expect(await generationsApi.get("a/b")).toEqual({ id: "run", status: "succeeded", artifactAvailable: true });
    transport.mockResolvedValueOnce(response({ id: "run", artifactReference: null }));
    expect((await generationsApi.get("run")).artifactAvailable).toBe(false);
  });
  it("preserves all history filters and shares them with reports", async () => {
    transport.mockImplementation(async () => response({ items: [] }));
    const filters = { designSystemId: "a/b", text: "hello world", status: "failed" as const, startDate: "2026-01-01", endDate: "2026-01-02", page: 2, pageSize: 10, sortDirection: "asc" as const };
    const query = historyQuery(filters);
    expect(Object.fromEntries(new URLSearchParams(query))).toEqual({ designSystemId: "a/b", text: "hello world", status: "failed", startDate: "2026-01-01", endDate: "2026-01-02", page: "2", pageSize: "10", sortDirection: "asc" });
    expect(historyQuery({})).toBe("page=1&pageSize=25&sortDirection=desc");
    await generationsApi.history(filters);
    await reportsApi.generationHistory(filters);
    await dashboardApi.get();
    expect(transport.mock.calls.map(([url]) => new URL(url).pathname)).toEqual(["/v1/generations", "/v1/reports/generation-history", "/v1/dashboard"]);
    expect(new URL(transport.mock.calls[1][0]).searchParams.get("text")).toBe("hello world");
  });
});

describe("generation events", () => {
  const event = { id: "event", eventType: "generating", message: "Rendering", createdAt: "2026-01-01T00:00:00Z" };
  const stream = (chunks: string[]) => new ReadableStream<Uint8Array>({ start(controller) { for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk)); controller.close(); } });
  it("consumes split UTF-8/SSE records, ignores keepalives and malformed data, and flushes the final record", async () => {
    const second = { ...event, id: "final", message: "Café" };
    transport.mockResolvedValueOnce(new Response(stream([`:keepalive\n\ndata: {invalid}\n\ndata: ${JSON.stringify(event).slice(0, 15)}`, `${JSON.stringify(event).slice(15)}\r\n\r\ndata: ${JSON.stringify(second)}`])));
    const listener = vi.fn();
    await generationsApi.streamEvents("a/b", new AbortController().signal, listener);
    expect(listener.mock.calls).toEqual([[event], [second]]);
    expect(transport.mock.calls[0][1].headers.get("Accept")).toBe("text/event-stream");
  });
  it.each([null, 4, {}, { ...event, id: 4 }, { ...event, eventType: "unknown" }, { ...event, message: null }, { ...event, createdAt: null }])("ignores malformed event %j", async (candidate) => {
    transport.mockResolvedValueOnce(new Response(stream([`data: ${JSON.stringify(candidate)}\n\n`])));
    const listener = vi.fn();
    await generationsApi.streamEvents("run", new AbortController().signal, listener);
    expect(listener).not.toHaveBeenCalled();
  });
  it("releases the reader after abort without reading another event", async () => {
    const controller = new AbortController();
    controller.abort();
    const body = stream([`data: ${JSON.stringify(event)}\n\n`]);
    transport.mockResolvedValueOnce(new Response(body));
    const listener = vi.fn();
    await generationsApi.streamEvents("run", controller.signal, listener);
    expect(listener).not.toHaveBeenCalled();
    expect(body.locked).toBe(false);
  });
  it("reports HTTP errors and missing streaming support", async () => {
    transport.mockResolvedValueOnce(response({ message: "Forbidden" }, 403));
    await expect(generationsApi.streamEvents("run", new AbortController().signal, vi.fn())).rejects.toThrow("Forbidden");
    transport.mockResolvedValueOnce(new Response(null));
    await expect(generationsApi.streamEvents("run", new AbortController().signal, vi.fn())).rejects.toThrow("Progress streaming is unavailable");
  });
});

describe("private artifact download", () => {
  it("opens a validated HTTPS presigned response without persisting credentials", async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function(this: HTMLAnchorElement) {
      expect(this.href).toBe("https://artifacts.example/package.zip");
      expect(this.download).toBe("");
      expect(this.rel).toBe("noopener");
    });
    transport.mockResolvedValueOnce(response({ kind: "presigned", downloadUrl: "https://artifacts.example/package.zip", expiresInSeconds: 300 }));
    await generationsApi.downloadArtifact("run");
    expect(click).toHaveBeenCalledOnce();
    expect(document.querySelector("a")).toBeNull();
  });
  it.each([null, "url", {}, { kind: "other", downloadUrl: "https://example/", expiresInSeconds: 300 },
    { kind: "presigned", downloadUrl: 42, expiresInSeconds: 300 },
    { kind: "presigned", downloadUrl: "https://example/", expiresInSeconds: 1.5 },
    { kind: "presigned", downloadUrl: "https://example/", expiresInSeconds: 59 },
    { kind: "presigned", downloadUrl: "https://example/", expiresInSeconds: 901 },
    { kind: "presigned", downloadUrl: "http://example/", expiresInSeconds: 300 },
    { kind: "presigned", downloadUrl: "invalid", expiresInSeconds: 300 },
  ])("refuses malformed private artifact authorization %j", async (value) => {
    transport.mockResolvedValueOnce(response(value));
    await expect(generationsApi.downloadArtifact("run")).rejects.toThrow("artifact download response is invalid");
  });
  it.each([['attachment; filename="package.zip"', "package.zip"], [null, "kolibri-generation-run.zip"], ['attachment; filename="../unsafe.zip"', "kolibri-generation-run.zip"]])("downloads bytes using a safe filename for %s", async (header, name) => {
    vi.useFakeTimers();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:fixture") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function(this: HTMLAnchorElement) {
      expect(this.download).toBe(name);
      expect(this.href).toBe("blob:fixture");
    });
    transport.mockResolvedValueOnce(new Response("zip bytes", { headers: header ? { "Content-Disposition": header } : {} }));
    await generationsApi.downloadArtifact("run");
    expect(click).toHaveBeenCalledOnce();
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
    const downloaded = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob;
    expect(downloaded.size).toBe(9);
    expect(downloaded.type).toBe("text/plain;charset=utf-8");
    expect(await downloaded.text()).toBe("zip bytes");
    vi.advanceTimersByTime(1000);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:fixture");
  });
  it("propagates artifact authorization failure", async () => {
    transport.mockResolvedValueOnce(response({ message: "Not owned" }, 403));
    await expect(generationsApi.downloadArtifact("run")).rejects.toThrow("Not owned");
  });
});
