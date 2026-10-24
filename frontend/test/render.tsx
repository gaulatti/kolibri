import { render } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { ThemeProvider } from "../app/bleecker";

export function LocationOutput() {
  const location = useLocation();
  return <output data-testid="route-location">{location.pathname}{location.search}{location.state?.notice ? `:${location.state.notice}` : ""}</output>;
}
export function renderPage(element: React.ReactNode, entry: string | { pathname: string; state: unknown } = "/") {
  return render(<MemoryRouter initialEntries={[entry]}><ThemeProvider defaultTheme="light">{element}<LocationOutput /></ThemeProvider></MemoryRouter>);
}
export const system = { id: "design", name: "Fixture Design", description: "Fixture description", lastPublishedVersion: null, generationContract: "composable-v1" as const, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-02T00:00:00Z" };
export const runtime = { designSystemId: "design", figmaFileKey: "file", packageName: "@fixture/design", packageVersion: "1.0.0", npmRegistry: "https://registry.example", figmaAccessTokenConfigured: true, npmTokenConfigured: true, generationConfigured: true };
export const pagination = { page: 1, pageSize: 25, totalItems: 0, totalPages: 1, hasPreviousPage: false, hasNextPage: false };
export const run = { id: "run", designSystemId: "design", status: "succeeded" as const, startedAt: "2026-01-01T00:00:00Z", completedAt: "2026-01-01T00:00:02Z", artifactCount: 3, tokenCount: 4, componentCount: 5, warningCount: 0, errorCount: 0, packageName: "@fixture/design", packageVersion: "1.0.1", generationContract: "composable-v1" as const, publishRequested: false, publishedAt: null, publicationFailureSummary: null, artifactAvailable: true, failureSummary: null, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:02Z" };
