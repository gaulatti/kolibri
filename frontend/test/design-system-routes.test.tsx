import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { designSystemsApi, type DesignSystem } from "../app/api/design-systems";
import { ApiError } from "../app/api/api-client";
import { generationsApi } from "../app/api/generations";
import Index, { meta as indexMeta } from "../app/routes/design-systems-index";
import New, { meta as newMeta } from "../app/routes/design-system-new";
import Edit, { meta as editMeta } from "../app/routes/design-system-edit";
import Detail, { meta as detailMeta } from "../app/routes/design-system-detail";
import { renderPage, runtime, system, pagination } from "./render";

beforeEach(() => {
  vi.spyOn(designSystemsApi, "list").mockResolvedValue([]);
  vi.spyOn(designSystemsApi, "get").mockResolvedValue({ ...system });
  vi.spyOn(designSystemsApi, "create").mockResolvedValue({ ...system });
  vi.spyOn(designSystemsApi, "update").mockResolvedValue({ ...system });
  vi.spyOn(designSystemsApi, "delete").mockResolvedValue(undefined);
  vi.spyOn(designSystemsApi, "getRuntimeConfiguration").mockResolvedValue({ ...runtime });
  vi.spyOn(generationsApi, "history").mockResolvedValue({ items: [], pagination });
});
const params = { params: { designSystemId: "design" } } as React.ComponentProps<typeof Edit>;
const detailParams = { params: { designSystemId: "design" } } as React.ComponentProps<typeof Detail>;
function recordPage(Component: typeof Edit | typeof Detail) { return Component === Edit ? <Edit {...params} /> : <Detail {...detailParams} />; }
it("labels browser destinations consistently", () => {
  expect(indexMeta({} as never)[0].title).toBe("Design Systems | kolibri");
  expect(newMeta({} as never)[0].title).toBe("New design system | kolibri");
  expect(editMeta({} as never)[0].title).toBe("Edit design system | kolibri");
  expect(detailMeta({} as never)[0].title).toBe("Design system | kolibri");
});
it("shows an empty owned collection and navigates to creation", async () => {
  renderPage(<Index />, "/design-systems");
  expect(screen.getByText("Loading design systems…")).toBeTruthy();
  fireEvent.click(await screen.findByRole("button", { name: "Create a design system" }));
  expect(screen.getByTestId("route-location").textContent).toBe("/design-systems/new");
});
it.each([null, "unexpected", {}, { notice: 4 }, { notice: "Design system created." }])("handles navigation notice %j and lists owned records", async (state) => {
  vi.mocked(designSystemsApi.list).mockResolvedValueOnce([{ ...system, description: null }, { ...system, id: "other", name: "Other Design" }]);
  renderPage(<Index />, { pathname: "/design-systems", state });
  expect(await screen.findByText("Other Design")).toBeTruthy();
  if (state && typeof state === "object" && typeof state.notice === "string") expect(screen.getByText(state.notice)).toBeTruthy();
  fireEvent.click(screen.getAllByRole("button", { name: "View" })[0]);
  expect(screen.getByTestId("route-location").textContent).toContain("/design-systems/design");
});
it.each([new ApiError("Not owner", 403), new Error("Network offline")])("retries a failed design collection %s", async (cause) => {
  vi.mocked(designSystemsApi.list).mockRejectedValueOnce(cause);
  renderPage(<Index />);
  expect(await screen.findByText(cause instanceof ApiError ? cause.message : "Your design systems could not be loaded. Please try again.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText("Create your first design system")).toBeTruthy();
});
it("creates a record and carries its success notice to the owned detail route", async () => {
  renderPage(<New />, "/design-systems/new");
  fireEvent.change(document.getElementById("name")!, { target: { value: "Fixture Design" } });
  fireEvent.click(screen.getByRole("button", { name: "Create design system" }));
  await waitFor(() => expect(screen.getByTestId("route-location").textContent).toBe("/design-systems/design:Design system created."));
  expect(designSystemsApi.create).toHaveBeenCalledWith({ name: "Fixture Design", description: "", generationContract: "composable-v1" });
});
it("updates a loaded record and preserves its contract", async () => {
  renderPage(<Edit {...params} />, "/design-systems/design/edit");
  expect(screen.getByText("Loading design system…")).toBeTruthy();
  await screen.findByText("Edit Fixture Design");
  fireEvent.change(document.getElementById("name")!, { target: { value: "Renamed" } });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(() => expect(screen.getByTestId("route-location").textContent).toBe("/design-systems/design:Design system updated."));
  expect(designSystemsApi.update).toHaveBeenCalledWith("design", { name: "Renamed", description: "Fixture description", generationContract: "composable-v1" });
});
it("requires confirmation before deleting a design system", async () => {
  renderPage(<Edit {...params} />);
  await screen.findByText("Edit Fixture Design");
  fireEvent.click(screen.getByRole("button", { name: "Delete design system" }));
  expect(designSystemsApi.delete).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("alertdialog")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Delete design system" }));
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  await waitFor(() => expect(screen.getByTestId("route-location").textContent).toBe("/design-systems:Design system deleted."));
});
it("does not dismiss a deletion in flight when its backdrop is clicked", async () => {
  let finish!: () => void;
  vi.mocked(designSystemsApi.delete).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  renderPage(<Edit {...params} />);
  await screen.findByText("Edit Fixture Design");
  fireEvent.click(screen.getByRole("button", { name: "Delete design system" }));
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  fireEvent.click(document.querySelector("dialog")!);
  expect(document.querySelector("dialog")?.hasAttribute("open")).toBe(true);
  await act(async () => { finish(); });
});
it.each([new ApiError("Cannot delete", 409), new Error("Offline")])("retains the record after deletion failure %s", async (cause) => {
  vi.mocked(designSystemsApi.delete).mockRejectedValueOnce(cause);
  renderPage(<Edit {...params} />);
  await screen.findByText("Edit Fixture Design");
  fireEvent.click(screen.getByRole("button", { name: "Delete design system" }));
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  expect(await screen.findByText(cause instanceof ApiError ? cause.message : "The design system could not be deleted.")).toBeTruthy();
});
it.each([Edit, Detail])("shows the owned record loading error without exposing a stale form", async (Component) => {
  vi.mocked(designSystemsApi.get).mockRejectedValueOnce(new ApiError("Not accessible", 404));
  renderPage(recordPage(Component));
  expect(await screen.findByText("Not accessible")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Return to Design Systems" }));
  expect(screen.getByTestId("route-location").textContent).toBe("/design-systems");
});
it.each([Edit, Detail])("normalizes an unexpected record loading failure", async (Component) => {
  vi.mocked(designSystemsApi.get).mockRejectedValueOnce(new Error("Offline"));
  renderPage(recordPage(Component));
  expect(await screen.findByText("This design system could not be loaded.")).toBeTruthy();
});
it.each([Edit, Detail])("ignores late record loading after unmount", async (Component) => {
  let finish!: (value: DesignSystem) => void;
  vi.mocked(designSystemsApi.get).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const view = renderPage(recordPage(Component));
  view.unmount();
  await act(async () => { finish(system); });
  expect(designSystemsApi.update).not.toHaveBeenCalled();
});
it.each([Edit, Detail])("ignores a late record failure after unmount", async (Component) => {
  let fail!: (error: Error) => void;
  vi.mocked(designSystemsApi.get).mockImplementationOnce(() => new Promise((_resolve, reject) => { fail = reject; }));
  const view = renderPage(recordPage(Component));
  view.unmount();
  await act(async () => { fail(new Error("Late failure")); });
  expect(screen.queryByText("Design system unavailable")).toBeNull();
});
it("switches configuration, credentials, history and generation using shareable tab URLs", async () => {
  renderPage(<Detail {...detailParams} />, { pathname: "/design-systems/design", state: { notice: "Saved record" } });
  expect(await screen.findByText("Saved record")).toBeTruthy();
  expect(await screen.findByRole("button", { name: "Generate package" })).toBeTruthy();
  fireEvent.click(screen.getByRole("tab", { name: "Configuration" }));
  expect(await screen.findByText("Package configuration")).toBeTruthy();
  expect(screen.getByTestId("route-location").textContent).toContain("?tab=configuration");
  fireEvent.click(screen.getByRole("tab", { name: "Credentials" }));
  expect(await screen.findByText("Figma token")).toBeTruthy();
  fireEvent.click(screen.getByRole("tab", { name: "History" }));
  expect(await screen.findByText("No generation runs found")).toBeTruthy();
  fireEvent.click(screen.getByRole("tab", { name: "Generate" }));
  expect(screen.getByTestId("route-location").textContent).toContain("/design-systems/design");
  expect(screen.getByTestId("route-location").textContent).not.toContain("?tab=");
});
it("routes incomplete configuration and missing publication credentials to their own tabs", async () => {
  vi.mocked(designSystemsApi.getRuntimeConfiguration).mockResolvedValueOnce({ ...runtime, generationConfigured: false }).mockResolvedValue({ ...runtime, npmTokenConfigured: false });
  renderPage(<Detail {...detailParams} />, "/design-systems/design");
  fireEvent.click(await screen.findByRole("button", { name: "Complete configuration" }));
  expect(screen.getByTestId("route-location").textContent).toBe("/design-systems/design?tab=configuration");
  fireEvent.click(screen.getByRole("tab", { name: "Generate" }));
  fireEvent.click(await screen.findByRole("button", { name: "Add npm token" }));
  expect(screen.getByTestId("route-location").textContent).toBe("/design-systems/design?tab=credentials");
});
it.each([null, "unexpected", {}, { notice: 4 }])("uses default description and normalizes invalid detail tab/notice %j", async (state) => {
  vi.mocked(designSystemsApi.get).mockResolvedValueOnce({ ...system, description: null });
  renderPage(<Detail {...detailParams} />, { pathname: "/design-systems/design?tab=unexpected", state });
  expect(await screen.findByText("Configure, generate, and review this design-system package.")).toBeTruthy();
});
