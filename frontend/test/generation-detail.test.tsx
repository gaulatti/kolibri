import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import GenerationDetail, { meta } from "../app/routes/generation-detail";
import { designSystemsApi } from "../app/api/design-systems";
import { generationsApi, type GenerationEvent, type GenerationRun } from "../app/api/generations";
import { ApiError } from "../app/api/api-client";
import { renderPage, run, system } from "./render";

const props = { params: { generationId: "run" } } as React.ComponentProps<typeof GenerationDetail>;
const event = (id: string, eventType: GenerationEvent["eventType"], message = id): GenerationEvent => ({ id, eventType, message, createdAt: "2026-01-01T00:00:00Z" });
beforeEach(() => {
  vi.spyOn(designSystemsApi, "get").mockResolvedValue(system);
  vi.spyOn(generationsApi, "get").mockResolvedValue({ ...run });
  vi.spyOn(generationsApi, "streamEvents").mockResolvedValue(undefined);
  vi.spyOn(generationsApi, "downloadArtifact").mockResolvedValue(undefined);
});
function mount(query = "") { return renderPage(<GenerationDetail {...props} />, `/generations/run${query}`); }
it("recovers saved final status and renders authenticated artifact download", async () => {
  expect(meta({} as never)).toEqual([{ title: "Generation progress | kolibri" }]);
  mount();
  expect(screen.getByText("Recovering generation status…")).toBeTruthy();
  expect(await screen.findByText("Succeeded")).toBeTruthy();
  expect(screen.getByText("2 sec")).toBeTruthy();
  expect(screen.getByText("Not requested")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Download package" }));
  await waitFor(() => expect(generationsApi.downloadArtifact).toHaveBeenCalledExactlyOnceWith("run"));
});
it("binds no duplicate download action while an artifact request is in flight", async () => {
  let finish!: () => void;
  vi.mocked(generationsApi.downloadArtifact).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  mount();
  const button = await screen.findByRole("button", { name: "Download package" });
  fireEvent.click(button); fireEvent.click(button);
  expect(generationsApi.downloadArtifact).toHaveBeenCalledOnce();
  expect(button.hasAttribute("disabled")).toBe(true);
  await act(async () => { finish(); });
  expect(button.hasAttribute("disabled")).toBe(false);
});
it.each([new ApiError("Not owner", 403), new Error("Network unavailable")])("does not expose a run when initial recovery fails %s", async (cause) => {
  vi.mocked(generationsApi.get).mockRejectedValueOnce(cause);
  mount();
  expect(await screen.findByText(cause instanceof ApiError ? cause.message : "This generation run could not be loaded.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Download package" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Design Systems" }));
  expect(screen.getByTestId("route-location").textContent).toBe("/design-systems");
});
it.each([new ApiError("Artifact unavailable", 404), new Error("Offline")])("recovers from artifact failure %s without losing saved run metrics", async (cause) => {
  vi.mocked(generationsApi.downloadArtifact).mockRejectedValueOnce(cause);
  mount();
  fireEvent.click(await screen.findByRole("button", { name: "Download package" }));
  expect(await screen.findByText(cause instanceof ApiError ? cause.message : "The artifact could not be downloaded. Please try again.")).toBeTruthy();
  expect(screen.getByText("Run metrics")).toBeTruthy();
});
it.each(["Explicit compiler failure", null])("shows the saved failure and permits a new run: %s", async (failureSummary) => {
  vi.mocked(generationsApi.get).mockResolvedValue({ ...run, status: "failed", failureSummary, artifactAvailable: false, publishRequested: true, publicationFailureSummary: "Registry rejected publication" });
  mount();
  expect(await screen.findByText(failureSummary || "Generation failed. Check the design-system configuration and try again.")).toBeTruthy();
  expect(screen.getByText("Registry rejected publication")).toBeTruthy();
  expect(screen.getByText("No package artifact")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Try another run" }));
  expect(screen.getByTestId("route-location").textContent).toBe("/design-systems/design?tab=generate");
});
it("shows persisted publication time instead of a pending outcome", async () => {
  vi.mocked(generationsApi.get).mockResolvedValue({ ...run, publishRequested: true, publishedAt: "2026-01-01T01:00:00Z" });
  mount();
  expect(await screen.findByText(/^Published /)).toBeTruthy();
});
it("keeps saved status usable if supplementary design-system details fail", async () => {
  vi.mocked(designSystemsApi.get).mockRejectedValueOnce(new Error("Supplementary lookup unavailable"));
  mount();
  expect(await screen.findByText("Succeeded")).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Generation" })).toBeTruthy();
});
it("restores the saved event timeline, deduplicates replay and separates diagnostics", async () => {
  const warning = event("warning", "diagnostic_warning", "Missing optional token");
  const error = event("error", "diagnostic_error", "Invalid component contract");
  vi.mocked(generationsApi.streamEvents).mockImplementationOnce(async (_id, _signal, accept) => {
    accept(event("queued", "queued")); accept(event("render", "generating"));
    accept(warning); accept(warning); accept(error); accept(event("done", "completed"));
  });
  vi.mocked(generationsApi.get).mockResolvedValue({ ...run, warningCount: 1, errorCount: 1 });
  mount();
  expect(await screen.findByText("Generating package")).toBeTruthy();
  fireEvent.click(screen.getByRole("tab", { name: "Diagnostics (2)" }));
  expect(screen.getAllByText("Missing optional token")).toHaveLength(1);
  expect(screen.getByText("Invalid component contract")).toBeTruthy();
  expect(screen.getByTestId("route-location").textContent).toBe("/generations/run?tab=diagnostics");
  fireEvent.click(screen.getByRole("tab", { name: "Summary" }));
  expect(screen.getByTestId("route-location").textContent).toBe("/generations/run");
});
it("shows a final saved status even when the timeline cannot be recovered", async () => {
  vi.mocked(generationsApi.streamEvents).mockRejectedValueOnce(new Error("Stream unavailable"));
  mount();
  expect(await screen.findByText("Final status recovered. The saved event timeline is unavailable.")).toBeTruthy();
  expect(screen.getByText("Succeeded")).toBeTruthy();
});
it("does not display aborts as failed saved-timeline recovery", async () => {
  vi.mocked(generationsApi.streamEvents).mockRejectedValueOnce(new DOMException("Navigation aborted", "AbortError"));
  mount("?tab=diagnostics");
  expect(await screen.findByText("No diagnostics")).toBeTruthy();
  expect(screen.queryByText("Final status recovered. The saved event timeline is unavailable.")).toBeNull();
});
it("renders failed saved timeline events as errors", async () => {
  vi.mocked(generationsApi.get).mockResolvedValue({ ...run, status: "failed", artifactAvailable: false });
  vi.mocked(generationsApi.streamEvents).mockImplementationOnce(async (_id, _signal, accept) => { accept(event("failed", "failed")); });
  mount();
  expect(await screen.findByText("Generation didn't complete")).toBeTruthy();
  expect(screen.getByText("Progress")).toBeTruthy();
});
it.each([
  [null, null, "Not started"], ["2026-01-01T00:00:00Z", null, "In progress"],
  ["2026-01-01T00:00:00Z", "2026-01-01T00:00:00.500Z", "< 1 sec"],
  ["2026-01-01T00:00:00Z", "2026-01-01T00:01:00Z", "1 min"],
  ["2026-01-01T00:00:00Z", "2026-01-01T00:01:01Z", "1 min 1 sec"],
])("formats persisted timing %s %s", async (startedAt, completedAt, expected) => {
  vi.mocked(generationsApi.get).mockResolvedValue({ ...run, startedAt, completedAt });
  mount();
  expect(await screen.findByText(expected!)).toBeTruthy();
});
it("does not let a delayed nonterminal refresh replace a terminal status", async () => {
  let finishOld!: (value: GenerationRun) => void;
  const pending = { ...run, status: "running" as const, completedAt: null, publishRequested: true };
  vi.mocked(generationsApi.get).mockResolvedValueOnce(pending)
    .mockImplementationOnce(() => new Promise((resolve) => { finishOld = resolve; }))
    .mockResolvedValue({ ...run });
  vi.mocked(generationsApi.streamEvents).mockImplementationOnce(async (_id, _signal, accept) => {
    accept(event("render", "generating")); accept(event("done", "completed"));
  });
  mount();
  expect(await screen.findByText("Succeeded")).toBeTruthy();
  await act(async () => { finishOld(pending); });
  expect(screen.getByText("Succeeded")).toBeTruthy();
  expect(screen.queryByText("Running")).toBeNull();
});
it("retains progress after a transient event-triggered refresh failure", async () => {
  vi.mocked(generationsApi.get).mockResolvedValueOnce({ ...run }).mockRejectedValueOnce(new Error("Refresh failed"));
  vi.mocked(generationsApi.streamEvents).mockImplementationOnce(async (_id, _signal, accept) => { accept(event("render", "generating")); });
  mount();
  expect(await screen.findByText("Generating package")).toBeTruthy();
  expect(screen.getByText("Succeeded")).toBeTruthy();
});
it("shows live progress without enabling an incomplete artifact or publication", async () => {
  let accept!: (value: GenerationEvent) => void;
  vi.mocked(generationsApi.get).mockResolvedValue({ ...run, status: "running", completedAt: null, publishRequested: true });
  vi.mocked(generationsApi.streamEvents).mockImplementation((_id, signal, listener) => { accept = listener; return new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new DOMException("Navigation", "AbortError")))); });
  mount();
  expect(await screen.findByText("Running")).toBeTruthy();
  expect(screen.getByText("Pending")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Download package" }).hasAttribute("disabled")).toBe(true);
  await act(async () => { accept(event("render", "generating")); });
  expect(screen.getByText("Generating package")).toBeTruthy();
  fireEvent.click(screen.getByRole("tab", { name: "Diagnostics (0)" }));
  expect(screen.queryByText("No diagnostics")).toBeNull();
});
it("recovers saved status after a dropped live stream", async () => {
  vi.useFakeTimers();
  vi.mocked(generationsApi.get).mockResolvedValueOnce({ ...run, status: "running", completedAt: null }).mockResolvedValue({ ...run });
  vi.mocked(generationsApi.streamEvents).mockRejectedValueOnce(new Error("Connection dropped")).mockResolvedValue(undefined);
  mount();
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  expect(screen.getByText("Live progress was interrupted. Recovering from saved status…")).toBeTruthy();
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  expect(screen.getByText("Succeeded")).toBeTruthy();
  expect(screen.queryByText("Live progress was interrupted. Recovering from saved status…")).toBeNull();
});
it("retries saved-status recovery after an interrupted stream closes without a terminal event", async () => {
  vi.useFakeTimers();
  vi.mocked(generationsApi.get).mockResolvedValueOnce({ ...run, status: "running", completedAt: null }).mockRejectedValueOnce(new Error("Status unavailable")).mockResolvedValue({ ...run });
  mount();
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  expect(screen.getByText("Live progress was interrupted. Recovering from saved status…")).toBeTruthy();
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  expect(generationsApi.get).toHaveBeenCalledTimes(2);
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  expect(screen.getByText("Succeeded")).toBeTruthy();
});
it("ignores late saved status after unmount", async () => {
  let finish!: (value: GenerationRun) => void;
  vi.mocked(generationsApi.get).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const view = mount(); view.unmount();
  await act(async () => { finish(run); });
  expect(generationsApi.streamEvents).not.toHaveBeenCalled();
});
it("ignores late live events and supplementary details after unmount", async () => {
  let accept!: (value: GenerationEvent) => void; let finish!: (value: typeof system) => void;
  vi.mocked(designSystemsApi.get).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  vi.mocked(generationsApi.get).mockResolvedValue({ ...run, status: "running", completedAt: null });
  vi.mocked(generationsApi.streamEvents).mockImplementation((_id, _signal, listener) => { accept = listener; return new Promise(() => {}); });
  const view = mount();
  await screen.findByText("Running"); view.unmount();
  await act(async () => { accept(event("late", "completed")); finish(system); });
  expect(generationsApi.get).toHaveBeenCalledOnce();
});
it("does not apply an event-triggered status refresh after leaving the run", async () => {
  let finish!: (value: GenerationRun) => void;
  vi.mocked(generationsApi.get).mockResolvedValueOnce(run).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  vi.mocked(generationsApi.streamEvents).mockImplementationOnce(async (_id, _signal, accept) => { accept(event("render", "generating")); });
  const view = mount();
  await screen.findByText("Generating package"); view.unmount();
  await act(async () => { finish(run); });
  expect(screen.queryByText("Succeeded")).toBeNull();
});
it("stops recovery when a live stream completes after navigation", async () => {
  let finish!: () => void;
  vi.mocked(generationsApi.get).mockResolvedValue({ ...run, status: "running", completedAt: null });
  vi.mocked(generationsApi.streamEvents).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const view = mount(); await screen.findByText("Running"); view.unmount();
  await act(async () => { finish(); });
  expect(generationsApi.get).toHaveBeenCalledOnce();
});
it("does not report a navigation abort as a broken live connection", async () => {
  vi.mocked(generationsApi.get).mockResolvedValueOnce({ ...run, status: "running", completedAt: null });
  vi.mocked(generationsApi.streamEvents).mockRejectedValueOnce(new DOMException("Navigation", "AbortError"));
  mount();
  expect(await screen.findByText("Running")).toBeTruthy();
  expect(screen.queryByText("Live progress was interrupted. Recovering from saved status…")).toBeNull();
});
it("reconnects using the bounded retry delay before recovering final status", async () => {
  vi.useFakeTimers();
  vi.mocked(generationsApi.get).mockResolvedValueOnce({ ...run, status: "running", completedAt: null }).mockResolvedValueOnce({ ...run, status: "running", completedAt: null }).mockResolvedValue(run);
  mount();
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  expect(generationsApi.get).toHaveBeenCalledOnce();
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  expect(generationsApi.get).toHaveBeenCalledTimes(2);
  await act(async () => { await vi.advanceTimersByTimeAsync(1999); });
  expect(generationsApi.get).toHaveBeenCalledTimes(2);
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(screen.getByText("Succeeded")).toBeTruthy();
});
