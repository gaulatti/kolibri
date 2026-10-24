import { webcrypto } from "node:crypto";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

Object.defineProperty(globalThis, "crypto", { configurable: true, value: webcrypto });
Object.defineProperty(window, "matchMedia", {
  configurable: true,
  value: (query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {}, dispatchEvent: () => false,
  }),
});
class ResizeObserverFixture {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverFixture);
Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
  configurable: true,
  value(this: HTMLDialogElement) { this.setAttribute("open", ""); },
});
Object.defineProperty(HTMLDialogElement.prototype, "close", {
  configurable: true,
  value(this: HTMLDialogElement) { this.removeAttribute("open"); this.dispatchEvent(new Event("close")); },
});
Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value() {} });
Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", { configurable: true, value() { return false; } });
Object.defineProperty(HTMLElement.prototype, "setPointerCapture", { configurable: true, value() {} });
Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", { configurable: true, value() {} });
beforeEach(() => {
  vi.stubEnv("VITE_API_BASE_URL", "https://api.kolibri.example");
  vi.stubEnv("VITE_COGNITO_DOMAIN", "https://auth.kolibri.example");
  vi.stubEnv("VITE_COGNITO_CLIENT_ID", "public-test-client");
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.useRealTimers();
  window.sessionStorage.clear();
});
