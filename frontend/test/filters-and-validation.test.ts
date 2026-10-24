import { describe, expect, it } from "vitest";
import { trimmedDesignSystem, validateDesignSystem } from "../app/design-systems/validation";
import {
  filtersFromSearchParams, formValueFromFilters, searchParamsFromForm,
  validateHistoryFilters, withPage,
} from "../app/generations/history-filters";
import { formatTimestamp, phaseLabel, statusLabel } from "../app/generations/generation-format";
import { getClientConfiguration, COGNITO_SCOPES } from "../app/config";
import { vi } from "vitest";

describe("design-system input contract", () => {
  it("accepts boundary lengths and trims an explicit display record", () => {
    expect(validateDesignSystem({ name: "a".repeat(200), description: "b".repeat(1000) })).toEqual({});
    expect(trimmedDesignSystem({ name: "  name  ", description: " description  ", generationContract: "composable-v1" }))
      .toEqual({ name: "name", description: "description", generationContract: "composable-v1" });
    expect(trimmedDesignSystem({ name: "name", description: null })).toEqual({ name: "name", description: "", generationContract: undefined });
    expect(trimmedDesignSystem({ name: "name", description: " " }).description).toBe("");
  });
  it("rejects absent or overlong values without hiding simultaneous errors", () => {
    expect(validateDesignSystem({ name: "", description: null })).toEqual({ name: ["Name is required."] });
    expect(validateDesignSystem({ name: "a".repeat(201), description: "b".repeat(1001) })).toEqual({
      name: ["Name must be 200 characters or fewer."], description: ["Description must be 1,000 characters or fewer."],
    });
  });
});

describe("history filters", () => {
  it("normalizes default and explicit valid URL filters", () => {
    expect(filtersFromSearchParams(new URLSearchParams())).toEqual({ designSystemId: undefined, status: undefined, startDate: undefined, endDate: undefined, page: 1, pageSize: 25, sortDirection: "desc" });
    const filters = filtersFromSearchParams(new URLSearchParams("designSystemId=%20id%20&status=failed&startDate=2026-01-01&endDate=2026-01-02&page=2&pageSize=100&sortDirection=asc"));
    expect(filters).toEqual({ designSystemId: "id", status: "failed", startDate: "2026-01-01", endDate: "2026-01-02", page: 2, pageSize: 100, sortDirection: "asc" });
    const form = formValueFromFilters(filters);
    expect(form).toEqual({ status: "failed", startDate: "2026-01-01", endDate: "2026-01-02", pageSize: "100", sortDirection: "asc" });
    expect(searchParamsFromForm(form).toString()).toBe("status=failed&startDate=2026-01-01&endDate=2026-01-02&pageSize=100&sortDirection=asc");
    expect(validateHistoryFilters(form)).toEqual({});
  });
  it.each(["-1", "0", "1.5", "bad", "Infinity"])("rejects invalid page %s", (page) => {
    expect(filtersFromSearchParams(new URLSearchParams({ page })).page).toBe(1);
  });
  it.each(["-1", "0", "1.5", "bad", "101"])("rejects invalid page size %s", (pageSize) => {
    expect(filtersFromSearchParams(new URLSearchParams({ pageSize })).pageSize).toBe(25);
  });
  it("rejects unknown statuses and reversed dates while preserving URL state", () => {
    expect(filtersFromSearchParams(new URLSearchParams("status=unknown&designSystemId=+&sortDirection=other")).status).toBeUndefined();
    const defaults = formValueFromFilters({});
    expect(defaults).toEqual({ status: "", startDate: "", endDate: "", pageSize: "25", sortDirection: "desc" });
    expect(searchParamsFromForm(defaults).toString()).toBe("");
    expect(validateHistoryFilters(defaults)).toEqual({});
    expect(validateHistoryFilters({ ...defaults, startDate: "2026-02-02" })).toEqual({});
    expect(validateHistoryFilters({ ...defaults, endDate: "2026-01-01" })).toEqual({});
    expect(validateHistoryFilters({ ...defaults, startDate: "2026-02-02", endDate: "2026-01-01" })).toEqual({ endDate: "End date must be on or after the start date." });
    const original = new URLSearchParams("status=failed&page=3");
    expect(withPage(original, 2).toString()).toBe("status=failed&page=2");
    expect(withPage(original, 1).toString()).toBe("status=failed");
    expect(original.toString()).toBe("status=failed&page=3");
  });
});

describe("generation display", () => {
  it("labels pending, active and terminal outcomes", () => {
    expect(statusLabel("succeeded")).toBe("Succeeded");
    expect(phaseLabel(null, "pending")).toBe("Queued");
    expect(phaseLabel(null, "running")).toBe("Running");
    expect(phaseLabel("publication_failed", "failed")).toBe("npm publication failed");
    expect(formatTimestamp(null)).toBe("Not yet");
    expect(formatTimestamp("2026-01-01T12:00:00Z")).toBe(new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "medium" }).format(new Date("2026-01-01T12:00:00Z")));
  });
});

describe("public browser configuration", () => {
  it("normalizes URLs and derives callback ownership from the frontend origin", () => {
    vi.stubEnv("VITE_API_BASE_URL", " https://api.kolibri.example/ ");
    expect(getClientConfiguration()).toEqual({ apiBaseUrl: "https://api.kolibri.example", cognitoDomain: "https://auth.kolibri.example", cognitoClientId: "public-test-client", cognitoRedirectUri: "https://kolibri.example/auth/callback", cognitoLogoutUri: "https://kolibri.example/sign-in?signedOut=1" });
    expect(COGNITO_SCOPES).toBe("openid email profile");
  });
  it.each([undefined, "", "  "])("rejects absent public configuration %s", (value) => {
    vi.stubEnv("VITE_API_BASE_URL", value);
    expect(() => getClientConfiguration()).toThrow("Missing frontend configuration: VITE_API_BASE_URL");
  });
  it.each(["relative", "http://api.example", "ftp://api.example"])("rejects invalid remote URL %s", (value) => {
    vi.stubEnv("VITE_API_BASE_URL", value);
    expect(() => getClientConfiguration()).toThrow(value === "relative" ? "must be an absolute URL" : "must use HTTPS outside localhost");
  });
  it("permits explicit local development without a browser global", () => {
    vi.stubEnv("VITE_API_BASE_URL", "http://localhost:3188");
    const original = globalThis.window;
    vi.stubGlobal("window", undefined);
    try { expect(getClientConfiguration().cognitoRedirectUri).toBe("http://localhost/auth/callback"); }
    finally { vi.stubGlobal("window", original); }
  });
});
