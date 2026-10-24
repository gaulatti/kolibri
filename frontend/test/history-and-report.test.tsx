import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { generationsApi, type GenerationHistoryItem, type GenerationStatus } from "../app/api/generations";
import { designSystemsApi } from "../app/api/design-systems";
import { reportsApi, type GenerationHistoryReport } from "../app/api/reports";
import { ApiError } from "../app/api/api-client";
import { DesignSystemHistory } from "../app/routes/generation-history";
import Report, { meta } from "../app/routes/generation-history-report";
import { HistoryFilterForm } from "../app/generations/history-filter-form";
import { PaginationControls } from "../app/generations/pagination-controls";
import { renderPage, run, system, pagination } from "./render";

const report: GenerationHistoryReport = {
  title: "Generation History Report", generatedAt: "2026-01-02T00:00:00Z",
  appliedFilters: { designSystemId: "design", text: null, status: null, startDate: null, endDate: null, sortDirection: "desc", page: 1, pageSize: 25 },
  columns: [
    { key: "designSystem", label: "Design system" }, { key: "packageName", label: "Package" },
    { key: "packageVersion", label: "Version" }, { key: "status", label: "Status" },
    { key: "startedAt", label: "Started" }, { key: "completedAt", label: "Completed" },
    { key: "componentCount", label: "Components" }, { key: "tokenCount", label: "Tokens" },
    { key: "artifactCount", label: "Artifacts" }, { key: "warningCount", label: "Warnings" },
    { key: "errorCount", label: "Errors" }, { key: "artifactAvailable", label: "Available" },
  ], pagination, rows: [],
};
beforeEach(() => {
  vi.spyOn(designSystemsApi, "get").mockResolvedValue(system);
  vi.spyOn(generationsApi, "history").mockResolvedValue({ items: [], pagination });
  vi.spyOn(generationsApi, "downloadArtifact").mockResolvedValue(undefined);
  vi.spyOn(reportsApi, "generationHistory").mockResolvedValue(structuredClone(report));
});
const props = { params: { designSystemId: "design" } } as React.ComponentProps<typeof Report>;
it("shows an empty generation history and its report navigation", async () => {
  renderPage(<DesignSystemHistory designSystemId="design" />, "/design-systems/design?tab=history");
  expect(screen.getByText("Loading history…")).toBeTruthy();
  expect(await screen.findByText("No generation runs found")).toBeTruthy();
  expect(screen.getByText("Start a generation and its progress, metrics, and artifact will appear here.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "View report" }));
  expect(screen.getByTestId("route-location").textContent).toBe("/design-systems/design/history/report");
});
it("rejects reversed URL dates before requesting history", async () => {
  renderPage(<DesignSystemHistory designSystemId="design" />, "/design-systems/design?tab=history&startDate=2026-02-01&endDate=2026-01-01");
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "End date must be on or after the start date.");
  expect(generationsApi.history).not.toHaveBeenCalled();
});
it("rejects an invalid date range selected in the actual filter controls", async () => {
  renderPage(<DesignSystemHistory designSystemId="design" />, "/design-systems/design?tab=history&startDate=2026-01-01&endDate=2026-01-02");
  await screen.findByText("No generation runs found");
  fireEvent.click(screen.getByRole("button", { name: "Started after" }));
  fireEvent.click(await screen.findByRole("button", { name: "Sat Jan 03 2026" }));
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "End date must be on or after the start date.");
  expect(screen.getByTestId("route-location").textContent).toContain("startDate=2026-01-01");
  expect(generationsApi.history).toHaveBeenCalledOnce();
});
it("clears filters, updates ordering and preserves report URL filters", async () => {
  renderPage(<DesignSystemHistory designSystemId="design" />, "/design-systems/design?tab=history&status=failed&startDate=2026-01-01&endDate=2026-01-02");
  expect(await screen.findByText("No runs match these filters. Reset them to see all runs.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Sort ascending" }));
  expect(screen.getByTestId("route-location").textContent).toContain("sortDirection=asc");
  fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
  expect(screen.getByTestId("route-location").textContent).not.toContain("status=failed");
  fireEvent.click(screen.getByRole("button", { name: "Reset view" }));
  expect(screen.getByTestId("route-location").textContent).toBe("/design-systems/design?tab=history");
});
it.each([new ApiError("Not owner", 403), new Error("Offline")])("retries history transport failure %s", async (cause) => {
  vi.mocked(generationsApi.history).mockRejectedValueOnce(cause);
  renderPage(<DesignSystemHistory designSystemId="design" />);
  expect(await screen.findByText(cause instanceof ApiError ? cause.message : "History could not be loaded.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText("No generation runs found")).toBeTruthy();
});
it("renders status, durations, metrics and per-run artifact availability", async () => {
  const start = "2026-01-01T00:00:00Z";
  const intervals = [null, 500, 2000, 60000, 61000, null];
  const items: GenerationHistoryItem[] = intervals.map((duration, index) => ({
    ...run, id: `run-${index}`, designSystemName: "Fixture Design", status: (["pending", "running", "succeeded", "failed"] as GenerationStatus[])[index % 4],
    startedAt: index === 0 ? null : start, completedAt: duration === null ? null : new Date(Date.parse(start) + duration).toISOString(), artifactAvailable: index !== 0,
  }));
  vi.mocked(generationsApi.history).mockResolvedValueOnce({ items, pagination: { ...pagination, totalItems: 6 } });
  renderPage(<DesignSystemHistory designSystemId="design" />);
  expect(await screen.findByText("6 matching runs")).toBeTruthy();
  expect(screen.getAllByText("In progress").length).toBe(2);
  expect(screen.getByText("< 1 sec")).toBeTruthy(); expect(screen.getByText("2 sec")).toBeTruthy();
  expect(screen.getByText("1 min")).toBeTruthy(); expect(screen.getByText("1 min 1 sec")).toBeTruthy();
  expect(screen.getAllByRole("button", { name: "Download" })).toHaveLength(5);
  fireEvent.click(screen.getAllByRole("button", { name: "Download" })[0]);
  await waitFor(() => expect(generationsApi.downloadArtifact).toHaveBeenCalledWith("run-1"));
  fireEvent.click(screen.getAllByRole("button", { name: "View run" })[0]);
  expect(screen.getByTestId("route-location").textContent).toBe("/generations/run-0");
});
it.each([new ApiError("Artifact missing", 404), new Error("Offline")])("retains history after artifact failure %s", async (cause) => {
  vi.mocked(generationsApi.history).mockResolvedValueOnce({ items: [{ ...run, designSystemName: system.name }], pagination: { ...pagination, totalItems: 1 } });
  vi.mocked(generationsApi.downloadArtifact).mockRejectedValueOnce(cause);
  renderPage(<DesignSystemHistory designSystemId="design" />);
  fireEvent.click(await screen.findByRole("button", { name: "Download" }));
  expect(await screen.findByText(cause instanceof ApiError ? cause.message : "The artifact could not be downloaded.")).toBeTruthy();
});
it("offers no other download action while the selected artifact is in flight", async () => {
  let finish!: () => void;
  vi.mocked(generationsApi.history).mockResolvedValueOnce({ items: [{ ...run, designSystemName: system.name }, { ...run, id: "other", designSystemName: system.name }], pagination: { ...pagination, totalItems: 2 } });
  vi.mocked(generationsApi.downloadArtifact).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  renderPage(<DesignSystemHistory designSystemId="design" />);
  const buttons = await screen.findAllByRole("button", { name: "Download" });
  fireEvent.click(buttons[0]); fireEvent.click(buttons[1]);
  expect(generationsApi.downloadArtifact).toHaveBeenCalledOnce();
  expect(buttons.every((button) => button.hasAttribute("disabled"))).toBe(true);
  await act(async () => { finish(); });
  expect(buttons.every((button) => !button.hasAttribute("disabled"))).toBe(true);
});
it("links a filtered report and supports native pagination without losing the history tab", async () => {
  vi.mocked(generationsApi.history).mockResolvedValue({ items: [{ ...run, designSystemName: system.name }], pagination: { ...pagination, totalItems: 30, totalPages: 2, hasNextPage: true } });
  renderPage(<DesignSystemHistory designSystemId="design" />, "/design-systems/design?tab=history&status=failed");
  await screen.findByText("30 matching runs");
  fireEvent.click(screen.getByTitle("Next page"));
  expect(screen.getByTestId("route-location").textContent).toContain("tab=history&status=failed&page=2");
  fireEvent.click(screen.getByRole("button", { name: "View report" }));
  expect(screen.getByTestId("route-location").textContent).toContain("/history/report?status=failed&page=2");
});
it("has an accessible empty pagination state", () => {
  renderPage(<PaginationControls pagination={pagination} onPage={vi.fn()} />);
  expect(screen.queryByRole("navigation", { name: "Pagination" })).toBeNull();
});
it("connects native row-count selection to filter application", async () => {
  const apply = vi.fn(); const reset = vi.fn();
  renderPage(<HistoryFilterForm value={{ status: "", startDate: "", endDate: "", pageSize: "25", sortDirection: "desc" }} errors={{}} onApply={apply} onReset={reset} />);
  const selects = screen.getAllByRole("combobox");
  await userEvent.click(selects.at(-1)!);
  await userEvent.click(await screen.findByRole("option", { name: "10 rows" }));
  expect(apply).toHaveBeenCalledWith({ status: "", startDate: "", endDate: "", pageSize: "10", sortDirection: "desc" });
  fireEvent.click(screen.getByRole("button", { name: "Reset view" }));
  expect(reset).toHaveBeenCalledOnce();
});

it("reports a complete saved operational view, including empty results", async () => {
  expect(meta({} as never)).toEqual([{ title: "Generation History Report | kolibri" }]);
  renderPage(<Report {...props} />, "/design-systems/design/history/report");
  expect(screen.getByText("Generating onscreen report…")).toBeTruthy();
  expect(await screen.findByText("No results")).toBeTruthy();
  expect(screen.getByText("Newest first")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Change filters" }));
  expect(screen.getByTestId("route-location").textContent).toBe("/design-systems/design?tab=history");
});
it.each([new ApiError("Report denied", 403), new Error("Offline")])("retries report failure %s", async (cause) => {
  vi.mocked(reportsApi.generationHistory).mockRejectedValueOnce(cause);
  renderPage(<Report {...props} />);
  expect(await screen.findByText(cause instanceof ApiError ? cause.message : "The generation history report could not be loaded.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText("No results")).toBeTruthy();
});
it("renders all report column kinds and paginates the unchanged saved filters", async () => {
  vi.mocked(reportsApi.generationHistory).mockResolvedValueOnce({ ...report,
    appliedFilters: { ...report.appliedFilters, text: "fixture", status: "failed", startDate: "2026-01-01", endDate: "2026-01-02", sortDirection: "asc" },
    rows: [{ ...run, designSystem: system.name }, { ...run, designSystem: system.name, packageName: "@fixture/second", status: "pending", startedAt: null, completedAt: null, artifactAvailable: false }],
    pagination: { ...pagination, totalItems: 30, totalPages: 2, hasNextPage: true },
  });
  renderPage(<Report {...props} />, "/design-systems/design/history/report?status=failed");
  expect(await screen.findByText("Oldest first")).toBeTruthy();
  expect(screen.getByText("@fixture/second")).toBeTruthy();
  expect(screen.getAllByText("Not yet")).toHaveLength(2);
  expect(screen.getByText("Yes")).toBeTruthy(); expect(screen.getByText("No")).toBeTruthy();
  fireEvent.click(screen.getByTitle("Next page"));
  expect(screen.getByTestId("route-location").textContent).toContain("status=failed&page=2");
  fireEvent.click(screen.getByRole("button", { name: "Change filters" }));
  expect(screen.getByTestId("route-location").textContent).toContain("?tab=history&status=failed&page=2");
});
it("keeps the report authoritative when supplementary design-system lookup fails", async () => {
  vi.mocked(designSystemsApi.get).mockRejectedValueOnce(new Error("Unavailable"));
  renderPage(<Report {...props} />);
  expect(await screen.findByText("No results")).toBeTruthy();
  expect(screen.getByText("Current design system")).toBeTruthy();
});
it("ignores supplementary report details arriving after unmount", async () => {
  let finish!: (value: typeof system) => void;
  vi.mocked(designSystemsApi.get).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const view = renderPage(<Report {...props} />);
  await screen.findByText("No results");
  view.unmount();
  await act(async () => { finish(system); });
  expect(screen.queryByText(system.name)).toBeNull();
});
it("renders a bounded placeholder for an absent report cell", async () => {
  vi.mocked(reportsApi.generationHistory).mockResolvedValueOnce({ ...report, rows: [{ ...run, designSystem: system.name, packageName: null as unknown as string }], pagination: { ...pagination, totalItems: 1 } });
  renderPage(<Report {...props} />);
  expect(await screen.findByText("—")).toBeTruthy();
});
