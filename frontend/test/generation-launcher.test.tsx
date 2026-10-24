import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { GenerationLauncher } from "../app/generations/generation-launcher";
import { designSystemsApi, type RuntimeConfiguration } from "../app/api/design-systems";
import { generationsApi } from "../app/api/generations";
import { ApiError } from "../app/api/api-client";
import { renderPage, runtime, system } from "./render";

beforeEach(() => {
  vi.spyOn(designSystemsApi, "getRuntimeConfiguration").mockResolvedValue({ ...runtime });
  vi.spyOn(generationsApi, "start").mockResolvedValue({ runId: "queued-run", status: "pending" });
});
function mount() {
  const configure = vi.fn(); const credentials = vi.fn();
  const view = renderPage(<GenerationLauncher designSystem={system} onConfigure={configure} onCredentials={credentials} />);
  return { ...view, configure, credentials };
}
it("requires complete settings before offering generation", async () => {
  vi.mocked(designSystemsApi.getRuntimeConfiguration).mockResolvedValueOnce({ ...runtime, generationConfigured: false, packageName: null });
  const view = mount();
  expect(screen.getByText("Loading configuration…")).toBeTruthy();
  fireEvent.click(await screen.findByRole("button", { name: "Complete configuration" }));
  expect(view.configure).toHaveBeenCalledOnce();
  expect(screen.getByText("Not configured")).toBeTruthy();
  expect(generationsApi.start).not.toHaveBeenCalled();
});
it("requires an npm credential before allowing publication", async () => {
  vi.mocked(designSystemsApi.getRuntimeConfiguration).mockResolvedValueOnce({ ...runtime, npmTokenConfigured: false });
  const view = mount();
  const toggle = await screen.findByRole("switch", { name: "Publish to npm" });
  expect(toggle.hasAttribute("disabled")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Add npm token" }));
  expect(view.credentials).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "Generate package" }));
  await waitFor(() => expect(generationsApi.start).toHaveBeenCalledWith("design", false));
  await waitFor(() => expect(screen.getByTestId("route-location").textContent).toBe("/generations/queued-run"));
});
it("publishes only after an explicit per-run selection and suppresses concurrent submissions", async () => {
  let finish!: (result: { runId: string; status: "pending" }) => void;
  vi.mocked(generationsApi.start).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  mount();
  fireEvent.click(await screen.findByRole("switch", { name: "Publish to npm" }));
  expect(screen.getByText("Publication enabled")).toBeTruthy();
  const button = screen.getByRole("button", { name: "Generate and publish" });
  fireEvent.submit(button.closest("form")!); fireEvent.submit(button.closest("form")!);
  expect(generationsApi.start).toHaveBeenCalledExactlyOnceWith("design", true);
  await act(async () => { finish({ runId: "queued-run", status: "pending" }); });
  expect(screen.getByTestId("route-location").textContent).toBe("/generations/queued-run");
});
it.each([new ApiError("Configuration rejected", 422), new Error("Offline")])("permits retry after generation failure %s", async (cause) => {
  vi.mocked(generationsApi.start).mockRejectedValueOnce(cause);
  mount();
  fireEvent.click(await screen.findByRole("button", { name: "Generate package" }));
  expect(await screen.findByText(cause instanceof ApiError ? cause.message : "Generation could not be started.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Generate package" }));
  await waitFor(() => expect(generationsApi.start).toHaveBeenCalledTimes(2));
});
it.each([new ApiError("Not owner", 403), new Error("Offline")])("shows runtime configuration failure %s", async (cause) => {
  vi.mocked(designSystemsApi.getRuntimeConfiguration).mockRejectedValueOnce(cause);
  mount();
  expect(await screen.findByText(cause instanceof ApiError ? cause.message : "Configuration could not be loaded.")).toBeTruthy();
});
it("does not offer generation for an empty configuration response", async () => {
  vi.mocked(designSystemsApi.getRuntimeConfiguration).mockResolvedValueOnce(null as unknown as RuntimeConfiguration);
  mount();
  await waitFor(() => expect(screen.queryByText("Loading configuration…")).toBeNull());
  expect(screen.queryByRole("button", { name: "Generate package" })).toBeNull();
});
it("ignores configuration responses after unmount", async () => {
  let finish!: (configuration: RuntimeConfiguration) => void;
  vi.mocked(designSystemsApi.getRuntimeConfiguration).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const view = mount(); view.unmount();
  await act(async () => { finish(runtime); });
  expect(generationsApi.start).not.toHaveBeenCalled();
});
it("ignores configuration failures after unmount", async () => {
  let fail!: (cause: Error) => void;
  vi.mocked(designSystemsApi.getRuntimeConfiguration).mockImplementationOnce(() => new Promise((_resolve, reject) => { fail = reject; }));
  const view = mount(); view.unmount();
  await act(async () => { fail(new Error("Late failure")); });
  expect(screen.queryByText("Generation unavailable")).toBeNull();
});
