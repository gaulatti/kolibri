import type { ReactNode } from "react";
import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { ApiError } from "../app/api/api-client";
import { dashboardApi, type DashboardDesignSystemHealth, type DashboardReport } from "../app/api/dashboard";
import Home from "../app/routes/home";
import { renderPage } from "./render";

// Keep the real Bleecker dashboard and chart wrappers. The SVG chart engine is
// a consumer-contract fixture because jsdom has no layout or pointer geometry.
// Its inputs and formatter outputs remain observable, rather than claiming a
// visual/browser acceptance result from synthetic geometry.
vi.mock("recharts", () => {
  type Props = {
    children?: ReactNode; data?: unknown; dataKey?: string; name?: string;
    tickFormatter?: (value: number) => unknown;
    formatter?: (value: number, name: string) => unknown;
  };
  const Container = ({ children }: Props) => <div>{children}</div>;
  return {
    ResponsiveContainer: Container,
    LineChart: ({ data, children }: Props) => <div data-testid="line-chart"><output data-testid="line-data">{JSON.stringify(data)}</output>{children}</div>,
    ScatterChart: Container,
    CartesianGrid: () => null,
    Legend: () => null,
    Line: ({ dataKey, name }: Props) => <output data-testid="line-series">{JSON.stringify({ dataKey, name })}</output>,
    Scatter: ({ data, name }: Props) => <output data-testid="scatter-series">{JSON.stringify({ data, name })}</output>,
    XAxis: ({ tickFormatter }: Props) => tickFormatter
      ? <output data-testid="x-ticks">{JSON.stringify([tickFormatter(2.6), tickFormatter(90)])}</output> : null,
    YAxis: ({ tickFormatter }: Props) => tickFormatter
      ? <output data-testid="y-ticks">{JSON.stringify([tickFormatter(1.5), tickFormatter(90)])}</output> : null,
    ZAxis: () => null,
    Tooltip: ({ formatter }: Props) => formatter
      ? <output data-testid="chart-tooltip">{JSON.stringify([formatter(1.5, "fixture"), formatter(90, "fixture")])}</output> : null,
  };
});

const health = (overrides: Partial<DashboardDesignSystemHealth> = {}): DashboardDesignSystemHealth => ({
  id: "healthy", name: "Healthy design", health: "healthy", attentionReason: null,
  latestStatus: "succeeded", latestRunAt: "2026-01-01T00:00:00Z",
  lastSuccessfulAt: "2026-01-01T00:00:00Z", currentVersion: "1.2.3", lastPublishedVersion: null,
  componentCount: 11, componentDelta: 2, warningCount: 1, errorCount: 0, ...overrides,
});
const empty: DashboardReport = {
  generatedAt: "2026-01-02T12:00:00Z", periodDays: 7,
  summary: {
    totalDesignSystems: 0, requiringAttention: 0, generatedRuns: 0,
    successRate: null, failedRuns: 0, medianDurationMs: null,
    p95DurationMs: null, publicationSuccessRate: null,
  },
  designSystems: [], generationVolume: [], performance: [], generationEfficiency: [],
};
const portfolio = (): DashboardReport => ({
  ...structuredClone(empty),
  summary: { ...empty.summary, totalDesignSystems: 5, requiringAttention: 2, generatedRuns: 8,
    successRate: 75, failedRuns: 2, medianDurationMs: 1500, p95DurationMs: 125000 },
  designSystems: [
    health(),
    health({ id: "unproven", name: "Unproven design", health: "unproven", attentionReason: "No successful generation",
      currentVersion: null, componentCount: null, componentDelta: null, warningCount: null, errorCount: null }),
    health({ id: "attention", name: "Attention design", health: "attention", attentionReason: "Latest run failed",
      componentCount: 4, componentDelta: -1, warningCount: 2, errorCount: 1 }),
    health({ id: "zero", name: "Zero design", componentCount: 0, componentDelta: 0, warningCount: 0, errorCount: null }),
    health({ id: "initial", name: "First design", componentCount: 3, componentDelta: null, currentVersion: null }),
  ],
  generationVolume: [{ date: "2026-01-01", counts: [{ designSystemId: "healthy", count: 3 }, { designSystemId: "attention", count: 2 }] }],
  performance: [
    { date: "2026-01-01", medianDurationMs: 1500, p95DurationMs: null },
    { date: "2026-01-02", medianDurationMs: null, p95DurationMs: 90000 },
    { date: "2026-01-03", medianDurationMs: null, p95DurationMs: null },
    { date: "2026-01-04", medianDurationMs: 60000, p95DurationMs: 120000 },
  ],
  generationEfficiency: [
    { runId: "one", designSystemId: "healthy", designSystemName: "Healthy design", packageVersion: "1.0.0",
      componentCount: 11, artifactCount: 4, durationMs: 2400, publishRequested: false },
    { runId: "two", designSystemId: "attention", designSystemName: "Attention design", packageVersion: "1.0.1",
      componentCount: 4, artifactCount: 8, durationMs: 90000, publishRequested: true },
  ],
});

beforeEach(() => {
  vi.spyOn(dashboardApi, "get").mockResolvedValue(structuredClone(empty));
});

it("shows loading and the initial empty portfolio with a working creation action", async () => {
  renderPage(<Home />);
  expect(screen.getByText("Loading portfolio health…")).toBeTruthy();
  expect(await screen.findByText("No Design Systems")).toBeTruthy();
  expect(screen.queryByText("Loading portfolio health…")).toBeNull();
  expect(screen.queryByText("Generation volume")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Create a Design System" }));
  expect(screen.getByTestId("route-location").textContent).toBe("/design-systems/new");
});

it.each([new ApiError("Portfolio denied", 403), new Error("Offline")])
  ("retries portfolio failures while preserving the correct user-facing error %s", async (cause) => {
    vi.mocked(dashboardApi.get).mockRejectedValueOnce(cause);
    renderPage(<Home />);
    expect(await screen.findByText(cause instanceof ApiError ? cause.message : "The portfolio report could not be loaded.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("No Design Systems")).toBeTruthy();
    expect(dashboardApi.get).toHaveBeenCalledTimes(2);
  });

it("renders health, signed component deltas and the immutable report's chart inputs", async () => {
  vi.mocked(dashboardApi.get).mockResolvedValueOnce(portfolio());
  renderPage(<Home />);
  expect(await screen.findByText("11 components (+2)", { exact: false })).toBeTruthy();
  expect(screen.getByText("4 components (-1)", { exact: false })).toBeTruthy();
  expect(screen.getByText("0 components", { exact: false })).toBeTruthy();
  expect(screen.getByText("3 components", { exact: false })).toBeTruthy();
  expect(screen.getByText("Unproven")).toBeTruthy();
  expect(screen.getByText("Needs attention")).toBeTruthy();
  expect(screen.getByText("No successful generation")).toBeTruthy();
  expect(screen.getByText("Not used")).toBeTruthy();
  expect(screen.getByText("2.1 min")).toBeTruthy();
  expect(screen.getByText("75%")).toBeTruthy();

  const lineData = screen.getAllByTestId("line-data").map((node) => JSON.parse(node.textContent!));
  expect(lineData[0][0]).toMatchObject({ designSystem0: 3, designSystem2: 2 });
  expect(lineData[1]).toEqual([
    { date: expect.any(String), median: 1.5, p95: null },
    { date: expect.any(String), median: null, p95: 90 },
    { date: expect.any(String), median: 60, p95: 120 },
  ]);
  expect(screen.getAllByTestId("scatter-series").map((node) => JSON.parse(node.textContent!))).toEqual([
    { name: "Generation", data: [{ components: 11, duration: 2.4, artifacts: 4 }] },
    { name: "Generation + NPM", data: [{ components: 4, duration: 90, artifacts: 8 }] },
  ]);
  expect(screen.getAllByTestId("y-ticks").map((node) => node.textContent)).toContain('["2","90"]');
  expect(screen.getAllByTestId("y-ticks").map((node) => node.textContent)).toContain('["1.5s","1.5m"]');
  expect(screen.getByTestId("x-ticks").textContent).toBe('["3","90"]');
  expect(screen.getAllByTestId("chart-tooltip").some((node) => node.textContent?.includes("1.5m"))).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Attention design" }));
  expect(screen.getByTestId("route-location").textContent).toBe("/design-systems/attention");
});

it.each([
  { p95DurationMs: null, expected: "—" },
  { p95DurationMs: 1500, expected: "1.5 sec" },
])("keeps summary and chart empty states honest for duration $p95DurationMs", async ({ p95DurationMs, expected }) => {
  vi.mocked(dashboardApi.get).mockResolvedValueOnce({
    ...structuredClone(empty), designSystems: [health()],
    summary: { ...empty.summary, totalDesignSystems: 1, p95DurationMs, publicationSuccessRate: 50 },
  });
  renderPage(<Home />);
  expect(await screen.findByText("No completed generations in this period")).toBeTruthy();
  expect(screen.getByText("No generated packages in this period")).toBeTruthy();
  expect(screen.getByText("50%")).toBeTruthy();
  expect(screen.getAllByText(expected).length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("button", { name: "Manage design systems" }));
  expect(screen.getByTestId("route-location").textContent).toBe("/design-systems");
});
